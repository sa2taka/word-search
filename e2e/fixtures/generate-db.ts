import initSqlJs from 'sql.js';
import { createHash } from 'node:crypto';
import { TEST_ENTRIES, TEST_META } from './test-data';
import type { DictMeta } from '../../src/shared/types';

const CREATE_TABLE_SQL = `
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lang TEXT NOT NULL,
    surface TEXT NOT NULL,
    reading TEXT,
    pos TEXT
  )
`;

const INSERT_SQL = `INSERT INTO entries (lang, surface, reading, pos) VALUES (?, ?, ?, ?)`;

let cachedDb: Uint8Array | null = null;
let cachedMeta: DictMeta | null = null;

export async function generateTestDb(): Promise<{ dbBinary: Uint8Array; meta: DictMeta }> {
  if (cachedDb && cachedMeta) {
    return { dbBinary: cachedDb, meta: cachedMeta };
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(CREATE_TABLE_SQL);

  for (const entry of TEST_ENTRIES) {
    db.run(INSERT_SQL, [entry.lang, entry.surface, entry.reading ?? null, entry.pos ?? null]);
  }

  const dbBinary = db.export();
  db.close();

  const sha256 = createHash('sha256').update(dbBinary).digest('hex');

  const meta: DictMeta = {
    ...TEST_META,
    sha256,
    bytes: dbBinary.byteLength,
  };

  cachedDb = dbBinary;
  cachedMeta = meta;

  return { dbBinary, meta };
}
