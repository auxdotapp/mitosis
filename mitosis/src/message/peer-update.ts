import {RemotePeer} from '../peer/remote-peer';
import {RemotePeerTable} from '../peer/remote-peer-table';
import {Address} from './address';
import {IPeerUpdateEntry, MessageSubject} from './interface';
import {Message} from './message';

export class PeerUpdate extends Message {
  protected _body: Array<IPeerUpdateEntry>;

  public constructor(sender: Address, receiver: Address, remotePeers: RemotePeerTable, allRemotePeers: RemotePeerTable) {
    const body = remotePeers
      .map(
        (peer: RemotePeer) => {
          return {
            peerId: peer.getId(),
            roles: peer.getRoles(),
            quality: peer.getMeter().getPeerUpdateQuality(allRemotePeers)
          };
        });
    super(sender, receiver, MessageSubject.PEER_UPDATE, body);
  }

  public getBody(): Array<IPeerUpdateEntry> {
    return this._body;
  }
}
