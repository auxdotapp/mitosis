import {
  Address,
  ConnectionNegotiationType,
  IClock,
  IConnection,
  IConnectionMeter,
  IWebRTCConnectionOptions,
  Logger,
  Message,
  MessageSubject,
  NegotiationState
} from 'mitosis';
import {MockConnection} from './mock';

export class WebRTCMockConnection extends MockConnection implements IConnection {

  private _lastOffer = 1;
  private _lastAnswer = 1;
  private _initiator = true;
  protected _meter: IConnectionMeter;

  private createOffer(mitosisId: string) {
    this._negotiationState = NegotiationState.WAITING_FOR_OFFER;
    this._client.getClock().setTimeout(() => {
      const offer = {
        type: 'offer',
        sdp: this._lastOffer++
      };
      const body = Object.assign(offer, this.getAdditionalOfferPayload());
      Logger.getLogger(mitosisId)
        .debug(`webrtc offer for ${this.getAddress().getId()} ready`, JSON.stringify(offer));
      const offerMsg = new Message(
        this.getMyAddress(),
        new Address(this.getAddress().getId()),
        MessageSubject.CONNECTION_NEGOTIATION,
        body
      );
      this._negotiationState = NegotiationState.WAITING_FOR_ANSWER;
      this._client.addConnection(
        this._options.mitosisId,
        this._address.getId(),
        this._address.getLocation(),
        this);
      this.onMessage(offerMsg);
    }, this.getConnectionDelay());
  }

  protected createAnswer(mitosisId: string, options: IWebRTCConnectionOptions) {
    this._negotiationState = NegotiationState.WAITING_FOR_ANSWER;
    this._initiator = false;
    this._client.getClock().setTimeout(() => {
      const answer = {
        type: 'answer',
        sdp: this._lastAnswer++
      };
      Logger.getLogger(mitosisId)
        .debug(`webrtc answer for ${this.getAddress().getId()} ready`, JSON.stringify(answer));
      const answerMsg = new Message(
        this.getMyAddress(),
        new Address(this.getAddress().getId()),
        MessageSubject.CONNECTION_NEGOTIATION,
        answer
      );
      this._negotiationState = NegotiationState.WAITING_FOR_ESTABLISH;
      this._client.addConnection(
        this._options.mitosisId,
        this._address.getId(),
        this._address.getLocation(),
        this);
      this.onMessage(answerMsg);
    }, this.getConnectionDelay());
  }

  protected openClient(): void {
    if (!this._options) {
      throw  new Error('webrtc cannot be opened without options');
    }
    if (this._options.payload) {
      switch (this._options.payload.type) {
        case ConnectionNegotiationType.OFFER:
          Logger.getLogger(this._options.mitosisId).debug(`create answer for ${this._address.getId()}`, this);
          this.createAnswer(this._options.mitosisId, this._options);
          break;
        case ConnectionNegotiationType.ANSWER:
          Logger.getLogger(this._options.mitosisId).debug(`establish connection to ${this._address.getId()}`, this);
          this.establish(this._options);
          break;
        default:
          Logger.getLogger(this._options.mitosisId).debug(`payload type ${this._options.payload.type} not found`, this);
          throw new Error(
            `webrtc options unsupported ${this._options.payload.type}`
          );
      }
    } else {
      this.createOffer(this._options.mitosisId);
    }
  }

  protected getAdditionalOfferPayload(): { [key: string]: any } {
    return {};
  }

  protected getMyAddress(): Address {
    return new Address(this._options.mitosisId, this.getAddress().getProtocol(), this.getId());
  }

  public isInitiator(): boolean {
    return this._initiator;
  }

  public establish(options: IWebRTCConnectionOptions) {
    const answer = options.payload;
    Logger.getLogger(this._options.mitosisId)
      .debug(`webrtc answer for ${this.getAddress().getId()} negotiating`, JSON.stringify(answer));
    this._client.getClock().setTimeout(() => {
      this._client.establishConnection(this._address.getId(), this._options.mitosisId, this._address.getLocation());
    }, this.getConnectionDelay());
  }
}
