import { describe, test, expect, vi } from 'vitest';
import type { WorkerRequest } from '../shared/types';
import { createDispatcher, type HandlerMap } from './dispatcher';
import { WorkerError } from './worker-error';

function createStubHandlers(
  overrides: Partial<HandlerMap> = {},
): HandlerMap {
  return {
    INIT: vi.fn(),
    SEARCH: vi.fn(),
    CANCEL: vi.fn(),
    CHECK_UPDATE: vi.fn(),
    UPDATE_DB: vi.fn(),
    RESET_DB: vi.fn(),
    ...overrides,
  };
}

describe('createDispatcher', () => {
  test('when receiving INIT request, should call INIT handler with request and postResponse', async () => {
    const initHandler = vi.fn();
    const postResponse = vi.fn();
    const dispatch = createDispatcher(
      createStubHandlers({ INIT: initHandler }),
      postResponse,
    );

    const request: WorkerRequest = { type: 'INIT', metaUrl: '/dict.meta.json' };
    await dispatch(request);

    expect(initHandler).toHaveBeenCalledWith(request, postResponse);
  });

  test('when receiving SEARCH request, should call SEARCH handler with request and postResponse', async () => {
    const searchHandler = vi.fn();
    const postResponse = vi.fn();
    const dispatch = createDispatcher(
      createStubHandlers({ SEARCH: searchHandler }),
      postResponse,
    );

    const request: WorkerRequest = {
      type: 'SEARCH',
      mode: 'contains',
      lang: 'ja',
      query: 'test',
      limit: 50,
      offset: 0,
      requestId: 'req-1',
    };
    await dispatch(request);

    expect(searchHandler).toHaveBeenCalledWith(request, postResponse);
  });

  test('when handler rejects with WorkerError, should post ERROR with the error code', async () => {
    const initHandler = vi.fn().mockRejectedValue(
      new WorkerError('DB_OPEN_FAILED', 'Cannot open DB'),
    );
    const postResponse = vi.fn();
    const dispatch = createDispatcher(
      createStubHandlers({ INIT: initHandler }),
      postResponse,
    );

    await dispatch({ type: 'INIT', metaUrl: '/meta.json' });

    expect(postResponse).toHaveBeenCalledWith({
      type: 'ERROR',
      code: 'DB_OPEN_FAILED',
      message: 'Cannot open DB',
    });
  });

  test('when handler rejects with plain Error, should post ERROR with SQL_ERROR fallback code', async () => {
    const initHandler = vi.fn().mockRejectedValue(new Error('unexpected'));
    const postResponse = vi.fn();
    const dispatch = createDispatcher(
      createStubHandlers({ INIT: initHandler }),
      postResponse,
    );

    await dispatch({ type: 'INIT', metaUrl: '/meta.json' });

    expect(postResponse).toHaveBeenCalledWith({
      type: 'ERROR',
      code: 'SQL_ERROR',
      message: 'unexpected',
    });
  });

  test('when SEARCH handler fails, should include requestId in ERROR response', async () => {
    const searchHandler = vi.fn().mockRejectedValue(
      new WorkerError('REGEX_INVALID', 'bad regex'),
    );
    const postResponse = vi.fn();
    const dispatch = createDispatcher(
      createStubHandlers({ SEARCH: searchHandler }),
      postResponse,
    );

    await dispatch({
      type: 'SEARCH',
      mode: 'regex',
      lang: 'ja',
      query: '[invalid',
      limit: 50,
      offset: 0,
      requestId: 'req-42',
    });

    expect(postResponse).toHaveBeenCalledWith({
      type: 'ERROR',
      requestId: 'req-42',
      code: 'REGEX_INVALID',
      message: 'bad regex',
    });
  });
});
