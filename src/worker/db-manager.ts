import type { DictMeta } from '../shared/types';
import type { Database, SqlJsStatic } from 'sql.js';
import type { PostResponse } from './dispatcher';
import type { DbStorage } from './storage';
import { WorkerError } from './worker-error';

export interface DbManagerDeps {
  storage: DbStorage;
  fetchMeta: (url: string) => Promise<DictMeta>;
  downloadDb: (
    url: string,
    totalBytes: number,
    onProgress: (downloaded: number) => void,
  ) => Promise<Uint8Array>;
  computeHash: (data: Uint8Array) => Promise<string>;
  initSqlite: () => Promise<SqlJsStatic>;
  openDb: (sql: SqlJsStatic, data?: Uint8Array) => Database;
}

export function createDbManager(deps: DbManagerDeps) {
  let sql: SqlJsStatic | null = null;
  let db: Database | null = null;

  async function ensureSqlite(): Promise<SqlJsStatic> {
    if (!sql) sql = await deps.initSqlite();
    return sql;
  }

  async function openAndSetDb(data: Uint8Array): Promise<void> {
    if (db) db.close();
    const s = await ensureSqlite();
    db = deps.openDb(s, data);
  }

  async function downloadVerifySave(
    meta: DictMeta,
    post: PostResponse,
  ): Promise<Uint8Array> {
    const data = await deps.downloadDb(meta.url, meta.bytes, (downloaded) => {
      post({
        type: 'STATUS',
        status: 'downloading',
        progress: Math.round((downloaded / meta.bytes) * 100),
      });
    });

    const hash = await deps.computeHash(data);
    if (hash !== meta.sha256) {
      throw new WorkerError('DB_HASH_MISMATCH', 'Downloaded DB hash mismatch');
    }

    await deps.storage.write(data);
    await deps.storage.writeVersion(meta.version);
    return data;
  }

  return {
    getDb(): Database | null {
      return db;
    },

    async init(metaUrl: string, post: PostResponse): Promise<void> {
      post({ type: 'STATUS', status: 'downloading', progress: 0 });

      const localVersion = await deps.storage.readVersion();
      const hasLocal = localVersion !== null && (await deps.storage.exists());

      let meta: DictMeta | null = null;
      try {
        meta = await deps.fetchMeta(metaUrl);
      } catch {
        if (hasLocal) {
          const data = await deps.storage.read();
          await openAndSetDb(data);
          post({ type: 'STATUS', status: 'ready', version: localVersion });
          return;
        }
        throw new WorkerError(
          'META_FETCH_FAILED',
          'Failed to fetch meta and no local DB available',
        );
      }

      if (hasLocal && localVersion === meta.version) {
        const data = await deps.storage.read();
        await openAndSetDb(data);
        post({ type: 'STATUS', status: 'ready', version: localVersion });
        return;
      }

      const data = await downloadVerifySave(meta, post);
      await openAndSetDb(data);
      post({ type: 'STATUS', status: 'ready', version: meta.version });
    },

    async checkUpdate(metaUrl: string, post: PostResponse): Promise<void> {
      const meta = await deps.fetchMeta(metaUrl);
      const localVersion = await deps.storage.readVersion();

      if (localVersion !== meta.version) {
        post({ type: 'STATUS', status: 'updatable', version: localVersion ?? undefined });
        return;
      }
      post({ type: 'STATUS', status: 'ready', version: localVersion });
    },

    async updateDb(metaUrl: string, post: PostResponse): Promise<void> {
      post({ type: 'STATUS', status: 'downloading', progress: 0 });

      const meta = await deps.fetchMeta(metaUrl);
      const data = await downloadVerifySave(meta, post);
      await openAndSetDb(data);
      post({ type: 'STATUS', status: 'ready', version: meta.version });
    },

    async resetDb(post: PostResponse): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
      await deps.storage.remove();
      await deps.storage.removeVersion();
      post({ type: 'STATUS', status: 'idle' });
    },
  };
}
