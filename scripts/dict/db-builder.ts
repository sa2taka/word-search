import initSqlJs from 'sql.js';
import { createHash } from 'node:crypto';
import type { EntryInput } from './types';

const CREATE_TABLE_SQL = `
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lang TEXT NOT NULL,
    word TEXT NOT NULL,
    pos TEXT,
    sources TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 1
  )
`;

const CREATE_INDEXES_SQL = [
  'CREATE INDEX idx_entries_lang_word ON entries(lang, word)',
  'CREATE INDEX idx_entries_lang_score ON entries(lang, score DESC, word)',
];

const INSERT_SQL = 'INSERT INTO entries (lang, word, pos, sources, score) VALUES (?, ?, ?, ?, ?)';

const BATCH_SIZE = 10_000;

interface MergedEntry {
  pos?: string;
  sources: Set<string>;
}

export interface BuildResult {
  dbBinary: Uint8Array;
  sha256: string;
  entryCount: number;
}

export async function buildDatabase(
  entries: AsyncIterable<EntryInput>,
  scores?: Map<string, number>,
): Promise<BuildResult> {
  // Phase 1: Collect and deduplicate in memory
  // Key: "lang\tword"
  console.log('  Deduplicating entries...');
  const merged = new Map<string, MergedEntry>();
  let rawCount = 0;

  for await (const entry of entries) {
    rawCount++;
    const key = `${entry.lang}\t${entry.word}`;
    const existing = merged.get(key);

    if (existing) {
      existing.sources.add(entry.source);
      if (!existing.pos && entry.pos) {
        existing.pos = entry.pos;
      }
    } else {
      merged.set(key, {
        pos: entry.pos,
        sources: new Set([entry.source]),
      });
    }

    if (rawCount % 100_000 === 0) {
      console.log(`  Collected ${rawCount.toLocaleString()} raw entries...`);
    }
  }

  console.log(`  Raw: ${rawCount.toLocaleString()} → Deduplicated: ${merged.size.toLocaleString()}`);

  // Phase 2: Insert into SQLite
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(CREATE_TABLE_SQL);

  const stmt = db.prepare(INSERT_SQL);
  let count = 0;

  db.run('BEGIN TRANSACTION');

  for (const [key, value] of merged) {
    const [lang, word] = key.split('\t');
    const sourcesJson = JSON.stringify([...value.sources].sort());
    const score = scores?.get(key) ?? 1;
    stmt.run([lang!, word!, value.pos ?? null, sourcesJson, score]);
    count++;

    if (count % BATCH_SIZE === 0) {
      db.run('COMMIT');
      db.run('BEGIN TRANSACTION');
      if (count % 50_000 === 0) {
        console.log(`  Inserted ${count.toLocaleString()} entries...`);
      }
    }
  }

  db.run('COMMIT');
  stmt.free();

  console.log(`  Total entries: ${count.toLocaleString()}`);
  console.log('  Creating indexes...');

  for (const sql of CREATE_INDEXES_SQL) {
    db.run(sql);
  }

  const dbBinary = db.export();
  db.close();

  const sha256 = createHash('sha256').update(dbBinary).digest('hex');

  return { dbBinary, sha256, entryCount: count };
}
