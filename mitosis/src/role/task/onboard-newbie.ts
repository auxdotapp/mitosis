import {ConfigurationMap} from '../../configuration';
import {ConnectionState} from '../../connection/interface';
import {Address} from '../../message/address';
import {MessageSubject} from '../../message/interface';
import {Message} from '../../message/message';
import {PeerUpdate} from '../../message/peer-update';
import {RoleUpdate} from '../../message/role-update';
import {Mitosis} from '../../mitosis';
import {RemotePeerTable} from '../../peer/remote-peer-table';
import {RoleType} from '../interface';

function promoteToRoles(address: Address, roles: Array<RoleType>, mitosis: Mitosis): void {
  const existingPeer = mitosis
    .getPeerManager()
    .getPeerById(address.getId());

  existingPeer.setRoles(roles);

  const roleUpdate = new RoleUpdate(
    mitosis.getMyAddress(),
    address,
    roles
  );
  mitosis.getPeerManager().sendMessage(roleUpdate);
}

function sendExistingRouters(address: Address, routers: RemotePeerTable, mitosis: Mitosis): void {
  const tableUpdate = new PeerUpdate(
    mitosis.getMyAddress(),
    address,
    routers,
    mitosis.getPeerManager().getPeerTable()
  );
  mitosis.getPeerManager().sendMessage(tableUpdate);
}

export function onboardNewbie(mitosis: Mitosis, message: Message): void {
  const sender = message.getSender();
  const routers = mitosis
    .getPeerManager()
    .getPeerTable()
    .filterByRole(RoleType.ROUTER)
    .filterConnections(
      table => table
        .filterDirect()
        .filterByStates(ConnectionState.OPEN, ConnectionState.OPENING)
    );
  const senderIsRouter = routers.filter(peer => peer.getId() === sender.getId()).length;

  if (message.getSubject() === MessageSubject.INTRODUCTION) {
    if (senderIsRouter || routers.length < ConfigurationMap.getDefault().MAX_ROUTERS_PER_SIGNAL) {
      promoteToRoles(sender, [RoleType.PEER, RoleType.ROUTER], mitosis);
    } else {
      promoteToRoles(sender, [RoleType.PEER], mitosis);
    }
    sendExistingRouters(sender, routers, mitosis);
  }
}
