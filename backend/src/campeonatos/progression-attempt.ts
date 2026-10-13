import {createOperationAttempts,type OperationStorage,type OperationAttempt} from '../shared/operation-attempt'
import {progressionIntent,type ProgressionIntent} from './progression-contract'
export type ProgressionAttempt=OperationAttempt<ProgressionIntent>
export function createProgressionAttempts(storage:OperationStorage){return createOperationAttempts('progression','progressão',progressionIntent,storage)}
