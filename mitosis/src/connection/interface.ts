import {Subject} from 'rxjs';
import {Address} from '../message/address';
import {Protocol} from '../message/interface';
import {Message} from '../message/message';
import {ViaConnection} from './via';
import {WebRTCConnection} from './webrtc';
import {WebSocketConnection} from './websocket';

export type IConnectionConstructor = new(address: Address, options?: IConnectionOptions) => IConnection;

export const ProtocolConnectionMap: Map<Protocol, IConnectionConstructor> = new Map();
ProtocolConnectionMap.set(Protocol.WEBSOCKET, WebSocketConnection);
ProtocolConnectionMap.set(Protocol.WEBSOCKET_UNSECURE, WebSocketConnection);
ProtocolConnectionMap.set(Protocol.WEBRTC, WebRTCConnection);
ProtocolConnectionMap.set(Protocol.VIA, ViaConnection);

export interface IConnectionOptions {
  protocol: Protocol;
  mitosisId?: string;
  payload?: any;
}

export interface IWebRTCConnectionOptions extends IConnectionOptions {
  protocol: Protocol.WEBRTC;
  payload?: IWebRTCConnectionOptionsPayload;
}

export enum WebRTCConnectionOptionsPayloadType {
  OFFER = 'offer',
  ANSWER = 'answer'
}

export interface IWebRTCConnectionOptionsPayload {
  type: WebRTCConnectionOptionsPayloadType;
  sdp: string;
}

export enum ConnectionState {
  OPEN = 'open',
  CONNECTING = 'connecting',
  CLOSED = 'closed',
  ERROR = 'error'
}

export interface IConnection {

  getQuality(): number;

  getAddress(): Address;

  open(): Promise<IConnection>;

  close(): void;

  send(message: Message): void;

  observeMessageReceived(): Subject<Message>;

  observeStateChange(): Subject<ConnectionState>;

  getState(): ConnectionState;
}