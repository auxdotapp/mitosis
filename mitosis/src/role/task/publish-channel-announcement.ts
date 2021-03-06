import {ConnectionState} from '../../connection/interface';
import {Address} from '../../message/address';
import {ChannelAnnouncement} from '../../message/channel-announcement';
import {IChannelAnnouncement} from '../../message/interface';
import {Mitosis} from '../../mitosis';
import {RoleType} from '../interface';

export function publishChannelAnnouncement(mitosis: Mitosis): void {
  const announcements: Array<IChannelAnnouncement> = mitosis
    .getStreamManager()
    .getChannelTable()
    .filter(
      channel => channel
        .getProviderTable()
        .has(
        provider => provider.isSource() && provider.isLive() && provider.isActive()
      )
    )
    .map(
      channel => {
        const announcement = channel.asAnnouncement();
        const myId = mitosis.getMyAddress().getId();
        const iAmProvider = announcement.providers.find(provider => provider.peerId === myId);
        const capacity = mitosis.getStreamManager().getMyCapacity();
        if (iAmProvider) {
          iAmProvider.capacity = capacity;
        } else {
          announcement.providers.push(
            {
              peerId: myId,
              capacity: capacity
            }
          );
        }
        return announcement;
      }
    );

  if (announcements.length === 0) {
    return;
  }

  const directPeers = mitosis
    .getPeerManager()
    .getPeerTable()
    .filterByRole(RoleType.PEER)
    .filterConnections(
      table => table
        .filterDirect()
        .filterByStates(ConnectionState.OPEN)
    );

  directPeers
    .forEach(peer => {
      const channelAnnouncement = new ChannelAnnouncement(
        mitosis.getMyAddress(),
        new Address(peer.getId()),
        announcements
      );
      mitosis.getPeerManager().sendMessage(channelAnnouncement);
    });
}
