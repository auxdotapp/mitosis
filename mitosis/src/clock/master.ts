import {AbstractClock} from './clock';
import {ForkedClock} from './forked';
import {IClock} from './interface';

export class MasterClock extends AbstractClock implements IClock {

  private _masterCancelId: any;
  private _speed: number;

  public constructor(speed: number = 1000) {
    super();
    this._speed = speed;
  }

  public fork(): IClock {
    const forked = new ForkedClock(this);
    forked.start();
    return forked;
  }

  public setSpeed(speed: number) {
    this._speed = speed;
    if (this.isRunning()) {
      this.pauseClock();
      this.startClock();
    }
  }

  public startClock(speed?: number): void {
    if (speed) {
      this._speed = speed;
    }
    this._masterCancelId = setInterval(this.tick.bind(this), this._speed);
  }

  public getPrecisionTimestamp(): number {
    if (performance && typeof performance.now === 'function') {
      return performance.now();
    } else if (Date && typeof Date.now === 'function') {
      return Date.now();
    } else {
      return this.getTick();
    }
  }

  public pauseClock(): void {
    clearInterval(this._masterCancelId);
  }

  public getSpeed(): number {
    return this._speed;
  }
}
