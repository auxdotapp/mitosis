import {filter} from 'rxjs/operators';
import {IClock} from '../clock/interface';
import {ConfigurationMap} from '../configuration';
import {ConnectionTable} from '../connection/connection-table';
import {ConnectionState, IConnection, Protocol} from '../connection/interface';
import {ViaConnection} from '../connection/via';
import {ChurnType} from '../interface';
import {Logger} from '../logger/logger';
import {RemotePeerTable} from '../peer/remote-peer-table';
import {RoleType} from '../role/interface';
import {ObservableMap} from '../util/observable-map';
import {IConnectionEventType, IConnectionMeter, IConnectionMeterEvent} from './connection-meter/interface';
import {ViaConnectionMeter} from './connection-meter/via-connection-meter';
import {IMeter} from './interface';
import {RouterAliveHighscore} from './router-alive-highscore';

export class RemotePeerMeter implements IMeter {

  private readonly _clock: IClock;
  private readonly _remotePeerId: string;
  private readonly _connectionsPerAddress: ObservableMap<string, IConnection>;
  private _punishedConnections = 0;
  private _protectedConnections = 0;
  private _routerAliveHighScore: RouterAliveHighscore;

  constructor(connectionsPerAddress: ObservableMap<string, IConnection>, remotePeerId: string, clock: IClock) {
    this._connectionsPerAddress = connectionsPerAddress;
    this._remotePeerId = remotePeerId;
    this._clock = clock;
    this._routerAliveHighScore = new RouterAliveHighscore();
    this.listenOnConnectionChurn();
  }

  private listenOnConnectionChurn() {
    this._connectionsPerAddress
      .observe()
      .pipe(
        filter(ev => ev.type === ChurnType.ADDED)
      )
      .subscribe((ev) => {
        (ev.value.getMeter() as IConnectionMeter)
          .observe()
          .subscribe(
            this.listenOnConnectionMeter.bind(this)
          );
      });
  }

  private listenOnConnectionMeter(event: IConnectionMeterEvent) {
    switch (event.type) {
      case IConnectionEventType.PUNISHED:
        Logger.getLogger(event.connection.getAddress().getId())
          .info(`punish connection to ${event.connection.getAddress().getId()}`, event.connection);
        this._punishedConnections++;
        this._clock.setTimeout(() => {
          this._punishedConnections--;
        }, ConfigurationMap.getDefault().CONNECTION_METER_PUNISHMENT_TIME);
        break;
      case IConnectionEventType.UNPUNISHED:
        break;
      case IConnectionEventType.PROTECTED:
        this._protectedConnections++;
        break;
      case IConnectionEventType.UNPROTECTED:
        this._protectedConnections--;
        break;
    }
  }

  private getConnectionTable(): ConnectionTable {
    return ConnectionTable.fromIterable(this._connectionsPerAddress.values());
  }

  public getLastSeen(): number {
    return this.getConnectionTable()
      .map(
        connection => (connection.getMeter() as IConnectionMeter).getLastSeen()
      )
      .reduce(
        (previous, current) => Math.min(previous, current),
        0
      );
  }

  public lastSeenIsExpired(): boolean {
    const unExpiredConnection = this.getConnectionTable()
      .find(
        connection => (connection.getMeter() as IConnectionMeter).isLastSeenExpired() === false
      );
    return !unExpiredConnection;
  }

  // returns value between 0 and 1 which is the average tq of all connections
  public getAverageConnectionQuality(remotePeers: RemotePeerTable): number {
    const measuredConnections = this.getConnectionTable()
      .filterByProtocol(Protocol.WEBRTC_DATA, Protocol.WEBSOCKET, Protocol.WEBSOCKET_UNSECURE, Protocol.VIA)
      .filterByStates(ConnectionState.OPEN);

    if (measuredConnections.length === 0) {
      return ConfigurationMap.getDefault().DEFAULT_QUALITY;
    }

    const quality = measuredConnections
      .map(
        connection => connection.getMeter().getQuality(remotePeers)
      )
      .reduce(
        (previous, current) => previous + current,
        0
      );
    return quality / measuredConnections.length;
  }

  public getBestConnectionQuality(remotePeers: RemotePeerTable): number {
    return this.getConnectionTable()
      .map(
        connection => connection.getMeter().getQuality(remotePeers)
      )
      .reduce(
        (previous, current) => Math.max(previous, current),
        0
      );
  }

  // returns 1 if peer reported too few connections and at least one connection is protected, else 0
  public getConnectionProtection(): 0 | 1 {
    // TODO: Use role specific configuration for this remote peer
    const unsatisfied = this.getConnectionTable().filterByProtocol(Protocol.VIA).length <
      ConfigurationMap.get(RoleType.PEER).DIRECT_CONNECTIONS_GOAL_MIN;
    if (unsatisfied) {
      if (this._protectedConnections > 0) {
        return 1;
      }
    }
    return 0;
  }

  // is used to find a PeerX were the probability is the highest that a connection can be opened
  // based on the feedback of direct connected peers who were reporting PeerX as their direct neighbor
  // the more peers reporting PeerX the lowest the probability that a connection can be opened
  public getConnectionSaturation(remotePeers: RemotePeerTable): number {
    const viaConnectionCount = remotePeers
      .countConnections(
        table => table
          .filterByProtocol(Protocol.VIA)
          .filterByLocation(this._remotePeerId)
      );

    const directConnectionCount = remotePeers
      .filterById(this._remotePeerId)
      .countConnections(
        table => table
          .filterDirectData()
      );

    const connectionCount = viaConnectionCount + directConnectionCount;

    // TODO: Use role specific configuration for this remote peer
    const configuration = ConfigurationMap.getDefault();
    const saturation = ((configuration.DIRECT_CONNECTIONS_MAX - connectionCount) / configuration.DIRECT_CONNECTIONS_GOAL_MAX);
    return Math.min(Math.max(0, saturation), 1);
  }

  // returns value between 0 and 1. When no connection is punished it returns 1, when all are punished 0
  public getAverageConnectionPunishment(): number {
    const directConnections = this._connectionsPerAddress
      .asTable()
      .filter(
        connection => connection
          .getAddress()
          .isProtocol(Protocol.WEBRTC_DATA, Protocol.WEBSOCKET_UNSECURE, Protocol.WEBSOCKET)
      );
    const punishedConnectionCount = directConnections.length - this._punishedConnections;
    if (directConnections.length === 0) {
      return 0;
    }
    return punishedConnectionCount / directConnections.length;
  }

  // returns the quality of this peer that is reported to our direct connections
  public getPeerUpdateQuality(remotePeers: RemotePeerTable): number {
    return this.getBestConnectionQuality(remotePeers) * this.getConnectionSaturation(remotePeers) * this.getRouterLinkQuality();
  }

  public getAverageRouterLinkQuality(remotePeers: RemotePeerTable): number {
    const connectionTable: ConnectionTable = ConnectionTable.fromIterable(this._connectionsPerAddress.values());

    const directConnections = connectionTable.filterDirectData();

    if (directConnections.length > 0) {
      return this.getRouterLinkQuality();
    }

    const viaConnections = connectionTable.filterByProtocol(Protocol.VIA);

    if (viaConnections.length === 0) {
      return 0;
    }

    return viaConnections
      .map(
        (connection: ViaConnection) =>
          (connection.getMeter() as ViaConnectionMeter).getRouterLinkQuality(remotePeers)
      )
      .reduce(
        (previous: number, current: number) => previous + current, 0
      ) / viaConnections.length;
  }

  public getRouterLinkQuality(): number {
    const routerLinkQuality = this.getRouterAliveHighScore().getAverageRanking();
    if (routerLinkQuality === 0) {
      return ConfigurationMap.getDefault().DEFAULT_QUALITY;
    }
    return routerLinkQuality;
  }

  public getAcquisitionQuality(remotePeers: RemotePeerTable): number {
    const routerQuality = this.getAverageRouterLinkQuality(remotePeers);
    const connectionQuality = this.getAverageConnectionQuality(remotePeers);
    const saturation = this.getConnectionSaturation(remotePeers);
    return routerQuality * connectionQuality * saturation;
  }

  public getRouterAliveHighScore(): RouterAliveHighscore {
    return this._routerAliveHighScore;
  }

  /*
   * TODO
   * is it a good idea to have the protection quality aka newbie bonus as a quality vector?
   * It is good to protect the peer so she is not cleaned up immediately but maybe not as a general quality
   * because it only has the meaning that he is new
   */
  public getQuality(remotePeers: RemotePeerTable): number {
    return this.getAverageConnectionQuality(remotePeers) * (this.getAverageConnectionPunishment() + this.getConnectionProtection());
  }

  public start(): void {
  }

  public stop(): void {
    this._clock.stop();
  }
}
