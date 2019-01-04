import {Simulation} from '../simulation';
import {AbstractInstruction} from './instruction';
import {IInstruction} from './interface';

export class RemoveConnection extends AbstractInstruction implements IInstruction {

  public execute(simulation: Simulation): void {
  }
}