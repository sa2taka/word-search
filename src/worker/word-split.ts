import type { Database } from 'sql.js';
import type { EntryRow, EntryPair, Lang } from '../shared/types';
import { WorkerError } from './worker-error';
import { normalizeWord } from '../shared/normalize';

const MAX_INPUT_LENGTH = 10;
const CANDIDATE_FETCH_LIMIT = 5000;

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

/**
 * 文字のマルチセットを Map<char, count> で返す。
 */
function charMultiset(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const ch of s) {
    map.set(ch, (map.get(ch) ?? 0) + 1);
  }
  return map;
}

/**
 * subset のマルチセットが superset に含まれるか確認し、
 * 含まれる場合は残りのマルチセットを返す。含まれなければ null。
 */
function subtractMultiset(
  superset: Map<string, number>,
  subset: Map<string, number>,
): Map<string, number> | null {
  const result = new Map(superset);
  for (const [ch, count] of subset) {
    const available = result.get(ch) ?? 0;
    if (available < count) return null;
    if (available === count) {
      result.delete(ch);
    } else {
      result.set(ch, available - count);
    }
  }
  return result;
}

/**
 * マルチセットをソートされた文字列キーに変換する。
 * 例: {か:1, い:1} → 'いか'
 */
function multisetKey(ms: Map<string, number>): string {
  const chars: string[] = [];
  for (const [ch, count] of ms) {
    for (let i = 0; i < count; i++) chars.push(ch);
  }
  return chars.sort().join('');
}

/**
 * 入力文字列を2つの単語に分割できる組み合わせを辞書から検索する。
 * 両単語の文字を合わせると input と完全一致（マルチセットとして）するペアを返す。
 */
export function executeWordSplit(
  db: Database,
  params: {
    lang: Lang;
    query: string;
    limit: number;
  },
): { pairs: EntryPair[] } {
  const normalized = normalizeWord(params.query);

  if (normalized.length === 0) {
    throw new WorkerError('QUERY_EMPTY', 'Query must not be empty');
  }

  if (normalized.length > MAX_INPUT_LENGTH) {
    throw new WorkerError(
      'WORD_TOO_LONG',
      `Query is too long (max ${MAX_INPUT_LENGTH} characters)`,
    );
  }

  const inputMs = charMultiset(normalized);
  const inputLen = normalized.length;

  // 入力と同じ長さ以下の単語を全件取得（最大 CANDIDATE_FETCH_LIMIT 件）
  const sql = `SELECT id, lang, word, pos, sources, score FROM entries WHERE lang = ? AND length(word) >= 1 AND length(word) <= ${inputLen - 1} ORDER BY score DESC, word LIMIT ${CANDIDATE_FETCH_LIMIT}`;
  const candidates = parseRows(db.exec(sql, [params.lang]));

  // word → マルチセット キャッシュ + キー→[EntryRow] マップ
  const keyToEntries = new Map<string, EntryRow[]>();
  const wordToMs = new Map<number, Map<string, number>>();

  for (const entry of candidates) {
    const ms = charMultiset(entry.word);
    wordToMs.set(entry.id, ms);
    const key = multisetKey(ms);
    const existing = keyToEntries.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      keyToEntries.set(key, [entry]);
    }
  }

  const pairs: EntryPair[] = [];
  const seenPairs = new Set<string>();
  const limit = Math.trunc(params.limit);

  for (const entry of candidates) {
    if (pairs.length >= limit) break;

    const ms = wordToMs.get(entry.id);
    if (!ms) continue;

    const remaining = subtractMultiset(inputMs, ms);
    if (!remaining || remaining.size === 0) continue;

    // 残りの文字が空でない → 残りと一致する単語を探す
    const remainingKey = multisetKey(remaining);
    const matches = keyToEntries.get(remainingKey);
    if (!matches) continue;

    for (const other of matches) {
      if (pairs.length >= limit) break;

      // 重複排除: IDの小さい方を先にして正規化
      const pairKey =
        entry.id < other.id
          ? `${entry.id}:${other.id}`
          : `${other.id}:${entry.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      pairs.push([entry, other]);
    }
  }

  return { pairs };
}
