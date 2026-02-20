import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { createRegexpMatcher } from './regexp-udf';

export type { Database, SqlJsStatic };

export async function initSqlite(wasmUrl?: string): Promise<SqlJsStatic> {
  return await initSqlJs(
    wasmUrl ? { locateFile: () => wasmUrl } : undefined,
  );
}

export function openDb(SQL: SqlJsStatic, data?: Uint8Array): Database {
  const db = data ? new SQL.Database(data) : new SQL.Database();
  const matcher = createRegexpMatcher();
  db.create_function('regexp', matcher);
  return db;
}
