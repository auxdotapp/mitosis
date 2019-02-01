import {Message} from '../message/message';
import {Mitosis} from '../mitosis';
import {RemotePeer} from '../peer/remote-peer';
import {IRole, RoleType} from './interface';
import {sendIntroduction} from './task/send-introduction';

export class Newbie implements IRole {

  public onTick(mitosis: Mitosis): void {
    sendIntroduction(mitosis);
  }

  public onMessage(mitosis: Mitosis, message: Message): void {
  }

  public requiresPeer(remotePeer: RemotePeer): boolean {
    return remotePeer.hasRole(RoleType.SIGNAL);
  }
}
