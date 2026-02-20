import type { WorkerRequest, WorkerResponse } from '../shared/types';
import { WorkerError } from './worker-error';

export type PostResponse = (response: WorkerResponse) => void;

type Handler<T extends WorkerRequest> = (
  request: T,
  postResponse: PostResponse,
) => Promise<void> | void;

export type HandlerMap = {
  [K in WorkerRequest['type']]: Handler<Extract<WorkerRequest, { type: K }>>;
};

function extractRequestId(request: WorkerRequest): string | undefined {
  if (request.type === 'SEARCH' || request.type === 'CANCEL') {
    return request.requestId;
  }
  return undefined;
}

export function createDispatcher(
  handlers: HandlerMap,
  postResponse: PostResponse,
): (request: WorkerRequest) => Promise<void> {
  return async (request: WorkerRequest) => {
    const handler = handlers[request.type];
    try {
      await (handler as Handler<typeof request>)(request, postResponse);
    } catch (error: unknown) {
      const requestId = extractRequestId(request);
      const isWorkerError = error instanceof WorkerError;
      postResponse({
        type: 'ERROR',
        ...(requestId !== undefined && { requestId }),
        code: isWorkerError ? error.code : 'SQL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
