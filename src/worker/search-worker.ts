import type { DictMeta, WorkerRequest, WorkerResponse } from '../shared/types';
import { createDispatcher, type PostResponse } from './dispatcher';
import { createDbManager } from './db-manager';
import { initSqlite, openDb } from './db';
import { OpfsStorage } from './opfs-storage';
import { executeSearch } from './search';
import { WorkerError } from './worker-error';

const cancelledRequests = new Set<string>();

async function fetchMeta(url: string): Promise<DictMeta> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new WorkerError(
      'META_FETCH_FAILED',
      `Failed to fetch meta: ${resp.status}`,
    );
  }
  return (await resp.json()) as DictMeta;
}

async function downloadDb(
  url: string,
  _totalBytes: number,
  onProgress: (downloaded: number) => void,
): Promise<Uint8Array> {
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) {
    throw new WorkerError(
      'DB_DOWNLOAD_FAILED',
      `Failed to download DB: ${resp.status}`,
    );
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received);
  }

  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const manager = createDbManager({
  storage: new OpfsStorage(),
  fetchMeta,
  downloadDb,
  initSqlite: () => initSqlite('/sql-wasm.wasm'),
  openDb,
});

const postResponse: PostResponse = (response: WorkerResponse) => {
  self.postMessage(response);
};

const dispatch = createDispatcher(
  {
    INIT: async (req, post) => {
      await manager.init(req.metaUrl, post);
    },
    SEARCH: async (req, post) => {
      if (cancelledRequests.has(req.requestId)) {
        cancelledRequests.delete(req.requestId);
        return;
      }

      const db = manager.getDb();
      if (!db) {
        throw new WorkerError('DB_OPEN_FAILED', 'Database is not initialized');
      }

      const result = executeSearch(db, {
        mode: req.mode,
        lang: req.lang,
        query: req.query,
        limit: req.limit,
        offset: req.offset,
      });

      if (cancelledRequests.has(req.requestId)) {
        cancelledRequests.delete(req.requestId);
        return;
      }

      post({
        type: 'SEARCH_RESULT',
        requestId: req.requestId,
        items: result.items,
        totalApprox: result.totalApprox,
      });
    },
    CANCEL: (req) => {
      cancelledRequests.add(req.requestId);
    },
    CHECK_UPDATE: async (req, post) => {
      await manager.checkUpdate(req.metaUrl, post);
    },
    UPDATE_DB: async (req, post) => {
      await manager.updateDb(req.metaUrl, post);
    },
    RESET_DB: async (_req, post) => {
      await manager.resetDb(post);
    },
  },
  postResponse,
);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  dispatch(event.data);
};
