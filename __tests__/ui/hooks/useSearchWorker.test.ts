import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useSearchWorker } from '../../../src/ui/hooks/useSearchWorker';
import type { WorkerResponse } from '../../../src/shared/types';

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  simulateMessage(data: WorkerResponse) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

let mockWorker: MockWorker;

describe('useSearchWorker', () => {
  beforeEach(() => {
    mockWorker = new MockWorker();
    vi.stubGlobal('Worker', class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage = mockWorker.postMessage;
      terminate = mockWorker.terminate;
      constructor() {
        setTimeout(() => {
          this.onmessage && (mockWorker.onmessage = this.onmessage);
        }, 0);
      }
    });
  });
  test('when initialized, should have idle status', () => {
    const { result } = renderHook(() => useSearchWorker());

    expect(result.current.dbStatus).toBe('idle');
  });

  test('when init is called, should post INIT message to worker', () => {
    const { result } = renderHook(() => useSearchWorker());

    act(() => {
      result.current.init('https://example.com/meta.json');
    });

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      metaUrl: 'https://example.com/meta.json',
    });
  });

  test('when worker sends STATUS response, should update dbStatus', async () => {
    const { result } = renderHook(() => useSearchWorker());

    act(() => {
      result.current.init('/meta.json');
    });

    await vi.waitFor(() => {
      expect(mockWorker.onmessage).not.toBeNull();
    });

    act(() => {
      mockWorker.simulateMessage({
        type: 'STATUS',
        status: 'ready',
        version: '2024.1',
      });
    });

    expect(result.current.dbStatus).toBe('ready');
    expect(result.current.version).toBe('2024.1');
  });

  test('when search is called, should post SEARCH message to worker', () => {
    const { result } = renderHook(() => useSearchWorker());

    act(() => {
      result.current.search({
        mode: 'contains',
        lang: 'ja',
        query: 'test',
        limit: 50,
        offset: 0,
      });
    });

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEARCH',
        mode: 'contains',
        lang: 'ja',
        query: 'test',
        limit: 50,
        offset: 0,
      }),
    );
  });

  test('when worker sends SEARCH_RESULT, should update results', async () => {
    const { result } = renderHook(() => useSearchWorker());

    act(() => {
      result.current.search({
        mode: 'contains',
        lang: 'ja',
        query: 'test',
        limit: 50,
        offset: 0,
      });
    });

    const requestId = mockWorker.postMessage.mock.calls[0][0].requestId;

    await vi.waitFor(() => {
      expect(mockWorker.onmessage).not.toBeNull();
    });

    act(() => {
      mockWorker.simulateMessage({
        type: 'SEARCH_RESULT',
        requestId,
        items: [{ id: 1, lang: 'ja', surface: '猫' }],
        totalApprox: 1,
      });
    });

    expect(result.current.items).toEqual([{ id: 1, lang: 'ja', surface: '猫' }]);
    expect(result.current.totalApprox).toBe(1);
  });

  test('when worker sends ERROR, should update error state', async () => {
    const { result } = renderHook(() => useSearchWorker());

    await vi.waitFor(() => {
      expect(mockWorker.onmessage).not.toBeNull();
    });

    act(() => {
      mockWorker.simulateMessage({
        type: 'ERROR',
        code: 'DB_DOWNLOAD_FAILED',
        message: 'Network error',
      });
    });

    expect(result.current.error).toEqual({
      code: 'DB_DOWNLOAD_FAILED',
      message: 'Network error',
    });
  });

  test('when resetDb is called, should post RESET_DB message', () => {
    const { result } = renderHook(() => useSearchWorker());

    act(() => {
      result.current.resetDb();
    });

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'RESET_DB' });
  });

  test('when STATUS response has progress, should update progress', async () => {
    const { result } = renderHook(() => useSearchWorker());

    await vi.waitFor(() => {
      expect(mockWorker.onmessage).not.toBeNull();
    });

    act(() => {
      mockWorker.simulateMessage({
        type: 'STATUS',
        status: 'downloading',
        progress: 50,
      });
    });

    expect(result.current.dbStatus).toBe('downloading');
    expect(result.current.progress).toBe(50);
  });
});
