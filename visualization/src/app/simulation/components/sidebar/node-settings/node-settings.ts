import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {Protocol} from 'mitosis';
import {MockConnection, MockMediaStream, Node} from 'mitosis-simulation';
import {SimulationNodeModel} from '../../../src/simulation-node-model';

@Component({
  selector: 'app-node-settings',
  templateUrl: './node-settings.html',
  styleUrls: ['./node-settings.scss'],
})
export class NodeSettingsComponent implements OnInit, OnChanges {
  @Input()
  public selectedNode: SimulationNodeModel;

  public wssDelay: number;
  public webRTCDelay: number;

  constructor() {
  }

  private updateDelayForProtocol(protocol: Protocol, delay: number) {
    this.selectedNode
      .getMitosis()
      .getPeerManager()
      .getPeerTable()
      .forEach((peer) => {
        peer.getConnectionTable()
          .forEach((c) => {
            if (c.getAddress().getProtocol() === protocol) {
              (c as MockConnection).setDelay(delay);
            }
          });
      });
  }

  private initNode() {
    this.selectedNode
      .getMitosis()
      .getPeerManager()
      .getPeerTable()
      .forEach((peer) => {
        peer.getConnectionTable()
          .forEach((c) => {
            if (c.getAddress().getProtocol() === Protocol.WEBRTC_DATA) {
              this.webRTCDelay = (c as MockConnection).getDelay();
            }
            if (c.getAddress().getProtocol() === Protocol.WEBSOCKET) {
              this.wssDelay = (c as MockConnection).getDelay();
            }
          });
      });
  }

  public updateWssDelay(delay: number) {
    this.updateDelayForProtocol(Protocol.WEBSOCKET, delay);
  }

  public updateWebRtcDelay(delay: number) {
    this.updateDelayForProtocol(Protocol.WEBRTC_STREAM, delay);
  }

  public getRoles() {
    if (this.selectedNode) {
      return this.selectedNode.getMitosis().getRoleManager().getRoles();
    } else {
      return [];
    }
  }

  public startStream(): void {
    this.selectedNode
      .getMitosis()
      .getStreamManager()
      .setLocalStream(new MockMediaStream());
  }

  public stopStream(): void {
    this.selectedNode
      .getMitosis()
      .getStreamManager()
      .unsetLocalStream();
  }

  public isStreaming(): boolean {
    return this.selectedNode
      .getMitosis()
      .getStreamManager()
      .getChannelTable()
      .has(
        channel => channel.isActive()
      );
  }

  ngOnInit(): void {
    this.initNode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedNode && changes.selectedNode.currentValue) {
      this.initNode();
    }
  }
}