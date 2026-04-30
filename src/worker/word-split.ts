import type { Database } from 'sql.js';
import type { EntryRow, EntryPair, Lang } from '../shared/types';
import { WorkerError } from './worker-error';
import { normalizeWord } from '../shared/normalize';

const MAX_INPUT_LENGTH = 10;

type CandidateEntry = { id: number; word: string };

function parseCandidateRows(
  result: { columns: string[]; values: unknown[][] }[],
): CandidateEntry[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  const idx = Object.fromEntries(columns.map((col, i) => [col, i]));
  return values.map((row) => ({
    id: row[idx['id']!] as number,
    word: row[idx['word']!] as string,
  }));
}

function parseDetailRows(
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

  // Phase 1: id と word だけ取得。LIMIT なしで全候補を対象にする。
  // sources/pos の JSON デシリアライズを省くことで数万件でも高速に処理できる。
  const candidateSql = `SELECT id, word FROM entries WHERE lang = ? AND length(word) >= 1 AND length(word) <= ${inputLen - 1} ORDER BY score DESC, word`;
  const candidates = parseCandidateRows(db.exec(candidateSql, [params.lang]));

  // word → マルチセット キャッシュ + キー→[CandidateEntry] マップ
  const keyToEntries = new Map<string, CandidateEntry[]>();
  const idToMs = new Map<number, Map<string, number>>();

  for (const entry of candidates) {
    const ms = charMultiset(entry.word);
    idToMs.set(entry.id, ms);
    const key = multisetKey(ms);
    const existing = keyToEntries.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      keyToEntries.set(key, [entry]);
    }
  }

  const pairIds: [number, number][] = [];
  const seenPairs = new Set<string>();
  const limit = Math.trunc(params.limit);

  for (const entry of candidates) {
    if (pairIds.length >= limit) break;

    const ms = idToMs.get(entry.id);
    if (!ms) continue;

    const remaining = subtractMultiset(inputMs, ms);
    if (!remaining || remaining.size === 0) continue;

    const remainingKey = multisetKey(remaining);
    const matches = keyToEntries.get(remainingKey);
    if (!matches) continue;

    for (const other of matches) {
      if (pairIds.length >= limit) break;

      // 重複排除: IDの小さい方を先にして正規化
      const pairKey =
        entry.id < other.id
          ? `${entry.id}:${other.id}`
          : `${other.id}:${entry.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      pairIds.push([entry.id, other.id]);
    }
  }

  if (pairIds.length === 0) {
    return { pairs: [] };
  }

  // Phase 2: マッチしたペアの ID のみ詳細取得（sources/pos を含む完全な EntryRow）
  const allIds = [...new Set(pairIds.flat())];
  const detailSql = `SELECT id, lang, word, pos, sources, score FROM entries WHERE id IN (${allIds.join(',')})`;
  const detailRows = parseDetailRows(db.exec(detailSql));
  const idToEntry = new Map(detailRows.map((e) => [e.id, e]));

  const pairs: EntryPair[] = pairIds
    .map(([aId, bId]) => {
      const a = idToEntry.get(aId);
      const b = idToEntry.get(bId);
      if (!a || !b) return null;
      return [a, b] as EntryPair;
    })
    .filter((p): p is EntryPair => p !== null);

  return { pairs };
}
