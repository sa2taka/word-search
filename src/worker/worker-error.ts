import type { ErrorCode } from '../shared/types';

export class WorkerError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'WorkerError';
    this.code = code;
  }
}
