import {ConnectionState} from '../connection/interface';
import {RemotePeer} from '../mesh/remote-peer';
import {PeerManager} from '../mesh/peer-manager';
import {Address} from '../message/address';
import {MessageSubject} from '../message/interface';
import {Message} from '../message/message';
import {PeerUpdate} from '../message/peer-update';
import {RoleUpdate} from '../message/role-update';
import {Mitosis} from '../mitosis';
import {IRole, RoleType} from './interface';

import {satisfyConnectionGoal} from './task/satisfy-connection-goal';

export class Signal implements IRole {

  public onTick(mitosis: Mitosis): void {
    satisfyConnectionGoal(mitosis);
  }

  private getRouters(peerManager: PeerManager): Array<RemotePeer> {
    return peerManager
      .getPeers()
      .filter(
        remotePeer => {
          return remotePeer.hasRole(RoleType.ROUTER) &&
            remotePeer.getConnectionTable()
              .filterDirect()
              .filterByStates(ConnectionState.OPEN)
              .length;
        }
      );
  }

  private promoteNewbie(newbieAddress: Address, routers: Array<RemotePeer>, mitosis: Mitosis): void {
    const existingPeer = mitosis.getPeerManager()
      .getPeers()
      .find(remotePeer => remotePeer.getId() === newbieAddress.getId());

    const roles = [RoleType.PEER];
    if (routers.length === 0) {
      existingPeer.getRoles().push(RoleType.ROUTER);
      routers.push(existingPeer);
      roles.push(RoleType.ROUTER);
    }
    const roleUpdate = new RoleUpdate(
      mitosis.getMyAddress(),
      newbieAddress,
      roles
    );
    mitosis.getPeerManager().sendMessage(roleUpdate);
  }

  private sendExistingRouters(address: Address, routers: Array<RemotePeer>, mitosis: Mitosis): void {
    const tableUpdate = new PeerUpdate(
      mitosis.getMyAddress(),
      address,
      routers
    );
    mitosis.getPeerManager().sendMessage(tableUpdate);
  }

  public onMessage(message: Message, mitosis: Mitosis): void {
    const sender = message.getSender();
    const routers = this.getRouters(mitosis.getPeerManager());
    const senderIsRouter = routers.find(peer => peer.getId() === sender.getId());

    if (!senderIsRouter && message.getSubject() === MessageSubject.INTRODUCTION) {
      this.promoteNewbie(sender, routers, mitosis);
      this.sendExistingRouters(sender, routers, mitosis);
    } else if (senderIsRouter && message.getSubject() === MessageSubject.PEER_UPDATE) {
      this.sendExistingRouters(sender, routers, mitosis);
    }
  }
}
