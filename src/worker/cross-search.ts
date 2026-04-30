import type { Database } from 'sql.js';
import type { EntryRow, EntryPair, Lang } from '../shared/types';
import { WorkerError } from './worker-error';
import { setRegexpDeadline, clearRegexpDeadline } from './regexp-udf';
import { REGEX_TIMEOUT_MS } from '../shared/constants';
import {
  parsePattern,
  buildStrictRegex,
  buildLooseRegex,
  extractVarBindings,
  matchWithBindings,
} from '../shared/cross-pattern';

const CANDIDATES1_LIMIT = 200;
const CANDIDATES2_LIMIT = 500;

function parseRows(
  result: { columns: string[]; values: unknown[][] }[],
): EntryRow[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  const idx = Object.fromEntries(columns.map((col, i) => [col, i]));
  return values.map((row) => ({
    id: row[idx['id']!] as number,
    lang: row[idx['lang']!] as Lang,
    word: row[idx['word']!] as string,
    pos: (row[idx['pos']!] ?? undefined) as string | undefined,
    sources: JSON.parse(row[idx['sources']!] as string) as string[],
    score: (row[idx['score']!] ?? 1) as number,
  }));
}

export function executeCrossSearch(
  db: Database,
  params: {
    lang: Lang;
    query1: string;
    query2: string;
    limit: number;
  },
): { pairs: EntryPair[] } {
  if (!params.query1.trim() || !params.query2.trim()) {
    throw new WorkerError('QUERY_EMPTY', '両方のパターンを入力してください');
  }

  const tokens1 = parsePattern(params.query1);
  const tokens2 = parsePattern(params.query2);
  const L1 = tokens1.length;
  const L2 = tokens2.length;

  if (L1 === 0 || L2 === 0) {
    throw new WorkerError('QUERY_EMPTY', '両方のパターンを入力してください');
  }

  const regex1 = buildStrictRegex(tokens1);
  const looseRegex2 = buildLooseRegex(tokens2);
  const limit = Math.trunc(params.limit);

  setRegexpDeadline(Date.now() + REGEX_TIMEOUT_MS);
  try {
    const candidates1 = parseRows(
      db.exec(
        `SELECT id, lang, word, pos, sources, score FROM entries WHERE lang = ? AND length(word) = ${L1} AND regexp(?, word) ORDER BY score DESC LIMIT ${CANDIDATES1_LIMIT}`,
        [params.lang, regex1],
      ),
    );
    const candidates2 = parseRows(
      db.exec(
        `SELECT id, lang, word, pos, sources, score FROM entries WHERE lang = ? AND length(word) = ${L2} AND regexp(?, word) ORDER BY score DESC LIMIT ${CANDIDATES2_LIMIT}`,
        [params.lang, looseRegex2],
      ),
    );

    const pairs: EntryPair[] = [];
    const seenPairs = new Set<string>();

    for (const c1 of candidates1) {
      if (pairs.length >= limit) break;
      const bindings = extractVarBindings(c1.word, tokens1);
      if (!bindings) continue;

      for (const c2 of candidates2) {
        if (pairs.length >= limit) break;
        if (!matchWithBindings(c2.word, tokens2, bindings)) continue;

        const pairKey = `${c1.id}:${c2.id}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        pairs.push([c1, c2]);
      }
    }

    return { pairs };
  } finally {
    clearRegexpDeadline();
  }
}
