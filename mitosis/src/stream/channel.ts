import {Subject} from 'rxjs';
import {IObservableMapEvent, ObservableMap} from '../util/observable-map';
import {IMediaStream} from './interface';
import {Provider} from './provider';

export class Channel {

  private readonly _id: string;
  private readonly _providerPerId: ObservableMap<string, Provider>;

  public constructor(id: string) {
    this._id = id;
    this._providerPerId = new ObservableMap();
  }

  public isActive(): boolean {
    return this._providerPerId
      .asTable()
      .has(
        provider => provider.isActive()
      );
  }

  public getId(): string {
    return this._id;
  }

  public getActiveProvider(): Provider {
    return this._providerPerId
      .asTable()
      .find(
        provider => provider.isActive()
      );
  }

  public addProvider(provider: Provider): void {
    this._providerPerId.set(provider.getPeerId(), provider);
  }

  public getProvider(peerId: string): Provider {
    return this._providerPerId.get(peerId);
  }

  public getMediaStream(): IMediaStream {
    return this._providerPerId
      .asTable()
      .filter(
        provider => provider.isActive()
      )
      .map(
        provider => provider.getStream()
      )
      .pop();
  }

  public observeProviderChurn(): Subject<IObservableMapEvent<Provider>> {
    return this._providerPerId.observe();
  }

  public destroy(): void {
    this._providerPerId
      .forEach(
        provider => provider.destroy()
      );
    this._providerPerId.destroy();
  }
}