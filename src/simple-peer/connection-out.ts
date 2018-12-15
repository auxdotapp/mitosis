import * as SimplePeer from 'simple-peer';
import {Connection} from './connection';

export class ConnectionOut extends Connection {
  private _offer: SimplePeer.SignalData = {};

  constructor(opts = {}) {
    super({
      initiator: true,
      trickle: false
    }, opts);
  }

  public establish(answer: { type: string, sdp: any }) {
    this._signalData = null;
    this.connection.signal(answer);
    return this.waitForSignal();
  }

  public getOffer() {
    return this._offer;
  }

  protected onSignal(data: SimplePeer.SignalData): void {
    this._offer = data;
  }
}
