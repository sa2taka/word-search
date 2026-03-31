import { describe, test, expect, vi } from 'vitest';
import type { DictMeta, WorkerResponse } from '../../src/shared/types';
import type { DbStorage } from '../../src/worker/storage';
import type { Database, SqlJsStatic } from 'sql.js';
import { createDbManager, type DbManagerDeps } from '../../src/worker/db-manager';
import { WorkerError } from '../../src/worker/worker-error';

function createInMemoryStorage(): DbStorage {
  const files = new Map<string, Uint8Array>();
  let version: string | null = null;

  return {
    exists: async () => files.has('db'),
    read: async () => {
      const data = files.get('db');
      if (!data) throw new Error('File not found');
      return data;
    },
    write: async (data) => {
      files.set('db', data);
    },
    remove: async () => {
      files.delete('db');
    },
    readVersion: async () => version,
    writeVersion: async (v) => {
      version = v;
    },
    removeVersion: async () => {
      version = null;
    },
  };
}

const SAMPLE_META: DictMeta = {
  version: '2.0',
  url: '/dict.sqlite',
  sha256: 'abc123',
  bytes: 1024,
  created_at: '2026-01-01',
  schema: 1,
  sources: [],
};

function createMockDeps(
  overrides: Partial<DbManagerDeps> = {},
): DbManagerDeps {
  return {
    storage: createInMemoryStorage(),
    fetchMeta: vi.fn().mockResolvedValue(SAMPLE_META),
    downloadDb: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    initSqlite: vi.fn().mockResolvedValue({} as SqlJsStatic),
    openDb: vi.fn().mockReturnValue({ close: vi.fn() } as unknown as Database),
    ...overrides,
  };
}

function collectResponses(): {
  responses: WorkerResponse[];
  postResponse: (r: WorkerResponse) => void;
} {
  const responses: WorkerResponse[] = [];
  return {
    responses,
    postResponse: (r: WorkerResponse) => responses.push(r),
  };
}

describe('DbManager', () => {
  describe('init', () => {
    test('when local DB exists with matching version, should open local DB and post ready', async () => {
      const storage = createInMemoryStorage();
      await storage.write(new Uint8Array([10, 20, 30]));
      await storage.writeVersion('2.0');

      const deps = createMockDeps({ storage });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.init('/meta.json', postResponse);

      const readyResponse = responses.find(
        (r) => r.type === 'STATUS' && r.status === 'ready',
      );
      expect(readyResponse).toEqual(
        expect.objectContaining({ type: 'STATUS', status: 'ready', version: '2.0' }),
      );
      expect(deps.downloadDb).not.toHaveBeenCalled();
    });

    test('when no local DB, should download, verify, save, and post ready', async () => {
      const storage = createInMemoryStorage();
      const deps = createMockDeps({ storage });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.init('/meta.json', postResponse);

      expect(deps.downloadDb).toHaveBeenCalled();
      expect(deps.openDb).toHaveBeenCalled();
      expect(await storage.exists()).toBe(true);
      expect(await storage.readVersion()).toBe('2.0');

      const readyResponse = responses.find(
        (r) => r.type === 'STATUS' && r.status === 'ready',
      );
      expect(readyResponse).toEqual(
        expect.objectContaining({ type: 'STATUS', status: 'ready', version: '2.0' }),
      );
    });

    test('when meta fetch fails but local DB exists, should use local DB', async () => {
      const storage = createInMemoryStorage();
      await storage.write(new Uint8Array([10, 20]));
      await storage.writeVersion('1.0');

      const deps = createMockDeps({
        storage,
        fetchMeta: vi.fn().mockRejectedValue(new Error('network error')),
      });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.init('/meta.json', postResponse);

      const readyResponse = responses.find(
        (r) => r.type === 'STATUS' && r.status === 'ready',
      );
      expect(readyResponse).toEqual({
        type: 'STATUS',
        status: 'ready',
        version: '1.0',
      });
    });

    test('when meta fetch fails and no local DB, should throw META_FETCH_FAILED', async () => {
      const deps = createMockDeps({
        fetchMeta: vi.fn().mockRejectedValue(new Error('network error')),
      });
      const manager = createDbManager(deps);
      const { postResponse } = collectResponses();

      let error: unknown;
      try {
        await manager.init('/meta.json', postResponse);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(WorkerError);
      expect((error as WorkerError).code).toBe('META_FETCH_FAILED');
    });

    test('when local DB version differs from meta, should download new DB', async () => {
      const storage = createInMemoryStorage();
      await storage.write(new Uint8Array([1]));
      await storage.writeVersion('1.0');

      const deps = createMockDeps({ storage });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.init('/meta.json', postResponse);

      expect(deps.downloadDb).toHaveBeenCalled();
      expect(await storage.readVersion()).toBe('2.0');

      const readyResponse = responses.find(
        (r) => r.type === 'STATUS' && r.status === 'ready',
      );
      expect(readyResponse).toEqual(
        expect.objectContaining({ type: 'STATUS', status: 'ready', version: '2.0' }),
      );
    });
  });

  describe('checkUpdate', () => {
    test('when remote version differs from local, should post updatable status', async () => {
      const storage = createInMemoryStorage();
      await storage.writeVersion('1.0');

      const deps = createMockDeps({ storage });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.checkUpdate('/meta.json', postResponse);

      expect(responses).toContainEqual({
        type: 'STATUS',
        status: 'updatable',
        version: '1.0',
      });
    });

    test('when versions match, should post ready status', async () => {
      const storage = createInMemoryStorage();
      await storage.writeVersion('2.0');

      const deps = createMockDeps({ storage });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      await manager.checkUpdate('/meta.json', postResponse);

      expect(responses).toContainEqual({
        type: 'STATUS',
        status: 'ready',
        version: '2.0',
      });
    });
  });

  describe('updateDb', () => {
    test('should download new DB, save, and post ready', async () => {
      const storage = createInMemoryStorage();
      await storage.write(new Uint8Array([1]));
      await storage.writeVersion('1.0');

      const mockDb = { close: vi.fn() } as unknown as Database;
      const deps = createMockDeps({
        storage,
        openDb: vi.fn().mockReturnValue(mockDb),
      });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      // First init to set up db reference
      await manager.init('/meta.json', postResponse);
      responses.length = 0;

      // Now update
      const newMeta = { ...SAMPLE_META, version: '3.0' };
      (deps.fetchMeta as ReturnType<typeof vi.fn>).mockResolvedValue(newMeta);

      await manager.updateDb('/meta.json', postResponse);

      expect(await storage.readVersion()).toBe('3.0');
      expect(responses).toContainEqual({
        type: 'STATUS',
        status: 'ready',
        version: '3.0',
      });
    });
  });

  describe('resetDb', () => {
    test('should delete DB and version, and post idle status', async () => {
      const storage = createInMemoryStorage();
      await storage.write(new Uint8Array([1, 2, 3]));
      await storage.writeVersion('1.0');

      const mockDb = { close: vi.fn() } as unknown as Database;
      const deps = createMockDeps({
        storage,
        openDb: vi.fn().mockReturnValue(mockDb),
      });
      const manager = createDbManager(deps);
      const { responses, postResponse } = collectResponses();

      // Init first
      await manager.init('/meta.json', postResponse);
      responses.length = 0;

      await manager.resetDb(postResponse);

      expect(await storage.exists()).toBe(false);
      expect(await storage.readVersion()).toBeNull();
      expect(mockDb.close).toHaveBeenCalled();
      expect(responses).toContainEqual({
        type: 'STATUS',
        status: 'idle',
      });
    });
  });
});
