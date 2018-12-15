import {filter} from 'rxjs/operators';
import {Mitosis} from './mitosis';
import {ConnectionState, IConnection} from './mitosis/connection/interface';
import {RemotePeer} from './mitosis/mesh/remote-peer';
import {ChurnType} from './mitosis/mesh/routing-table';

class App {
  private _mitosis: Mitosis;

  constructor() {
    this._mitosis = new Mitosis();
    this.listenOnInbox();
    this.listenOnPeerChurn();

    this.listenOnSubmitForm();

    document.querySelector('.clients ul')
      .insertAdjacentHTML('afterbegin',
        `<li>${this._mitosis.getMyAddress().getId()} (me)</li>`
      );
  }

  private listenOnSubmitForm() {
    document.querySelector('.send-message form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form: HTMLFormElement = ev.currentTarget as HTMLFormElement;
      const msg = (form.elements.namedItem('message') as HTMLInputElement).value;
      const receiver = (form.elements.namedItem('receiver') as HTMLInputElement).value;

      if (receiver === '*') {
        this.broadcastMessage(msg);
      } else {
        this.sendMessage(receiver, msg);
      }
    });
  }

  private sendMessage(peerId: string, message: string) {
    if (!this._mitosis.getRoutingTable().getPeerById(peerId)) {
      return;
    }
    this._mitosis.sendMessageTo(peerId, message);
    document.querySelector('.messages ul')
      .insertAdjacentHTML('beforeend',
        `<li class="outgoing"><span class="receiver">-> ${peerId}</span>: ${message}</li>`
      );
  }

  private broadcastMessage(message: string) {
    this._mitosis.getRoutingTable().getPeers().forEach((peer) => {
      this.sendMessage(peer.getId(), message);
    });
  }

  private listenOnInbox() {
    this._mitosis.getInbox()
      .subscribe((message) => {
        document.querySelector('.messages ul')
          .insertAdjacentHTML('beforeend',
            `
                    <li class="incoming">
                      <span class="originator">
                          <- ${message.getSender().getId()}
                      </span>: ${message.getBody()}
                      </li>
                  `
          );
      });
  }

  private listenOnPeerChurn() {
    this._mitosis.getRoutingTable().observePeerChurn()
      .pipe(
        filter(ev => ev.type === ChurnType.ADDED)
      )
      .subscribe(
        ev => this.addPeer(ev.peer)
      );

    this._mitosis.getRoutingTable().observePeerChurn()
      .pipe(
        filter(ev => ev.type === ChurnType.REMOVED)
      )
      .subscribe(
        ev => this.removePeer(ev.peer)
      );
  }

  private addPeer(peer: RemotePeer) {
    document.querySelector('.clients ul')
      .insertAdjacentHTML('beforeend',
        `
                <li id="client_${peer.getId()}">
                   ${peer.getId()} (<span class="connections">0</span>)
                </li>
              `
      );
    this.listenOnPeerConnectionChurn(peer);
  }

  private removePeer(peer: RemotePeer) {
    const peerEl = document.getElementById(`client_${peer.getId()}`);
    peerEl.remove();
  }

  private updateConnections(peer: RemotePeer) {
    const peerEl = document.getElementById(`client_${peer.getId()}`);
    const peerConnectionsEl = peerEl.querySelector('.connections');
    const openConnections = peer.getConnectionTable().filterByStates(ConnectionState.OPEN);
    peerConnectionsEl.innerHTML = peer.getConnectionTable().length.toString();
    if (openConnections.length > 0) {
      peerEl.classList.add('connected');
    } else {
      peerEl.classList.remove('connected');
    }
  }

  private listenOnPeerConnectionChurn(peer: RemotePeer) {
    peer.observeChurn()
      .subscribe(ev => {
        this.updateConnections(peer);
        this.listenOnConnectionChanges(peer, ev.connection);
      });
  }

  private listenOnConnectionChanges(peer: RemotePeer, connection: IConnection) {
    connection.observeStateChange().subscribe(
      ev => this.updateConnections(peer)
    );
  }
}

const app = new App();
