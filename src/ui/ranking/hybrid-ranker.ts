import type { EntryRow, Lang } from '../../shared/types';

export interface RankingInfo {
  combinedScore: number;
  googleTotalResults?: number;
  ollamaScore?: number;
  reason?: string;
}

export interface HybridRankerConfig {
  enabled: boolean;
  maxItems: number;
  googleConcurrency: number;
  googleWeight: number;
  ollamaWeight: number;
}

export interface OllamaWordScore {
  word: string;
  score: number;
  reason?: string;
}

interface RankRequest {
  entries: EntryRow[];
  lang: Lang;
}

interface RankDependencies {
  fetchGoogleTotalResults: (word: string, lang: Lang) => Promise<number | undefined>;
  fetchOllamaScores: (words: string[], lang: Lang) => Promise<OllamaWordScore[]>;
}

interface RankedEntry extends EntryRow {
  ranking: RankingInfo;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGoogleScore(totalResults?: number): number | undefined {
  if (totalResults == null) return undefined;
  if (totalResults <= 0) return 0;
  return clamp(Math.log10(totalResults + 1) / 8, 0, 1);
}

function buildRankingInfo(
  entry: EntryRow,
  googleTotalResults: number | undefined,
  ollamaScores: Map<string, OllamaWordScore>,
  config: HybridRankerConfig,
): RankingInfo {
  const googleScore = normalizeGoogleScore(googleTotalResults);
  const ollama = ollamaScores.get(entry.word);
  const ollamaScore = ollama?.score;

  const weightedSignals = [
    googleScore != null ? googleScore * config.googleWeight : 0,
    ollamaScore != null ? ollamaScore * config.ollamaWeight : 0,
  ];
  const activeWeights = [
    googleScore != null ? config.googleWeight : 0,
    ollamaScore != null ? config.ollamaWeight : 0,
  ];
  const weightSum = activeWeights.reduce((sum, weight) => sum + weight, 0);
  const combinedScore = weightSum > 0
    ? weightedSignals.reduce((sum, score) => sum + score, 0) / weightSum
    : 0;

  return {
    combinedScore,
    googleTotalResults,
    ollamaScore,
    reason: ollama?.reason,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      results[currentIndex] = await mapper(values[currentIndex]!);
    }
  }

  const concurrency = Math.max(1, Math.min(limit, values.length));
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export async function rankEntriesWithHybridSignals(
  request: RankRequest,
  deps: RankDependencies,
  config: HybridRankerConfig,
): Promise<{ items: EntryRow[] }> {
  if (!config.enabled || request.entries.length === 0) {
    return { items: request.entries };
  }

  const targetEntries = request.entries.slice(0, config.maxItems);
  const tailEntries = request.entries.slice(config.maxItems);

  const [googleResults, ollamaScores] = await Promise.all([
    mapWithConcurrency(
      targetEntries,
      config.googleConcurrency,
      async (entry) => {
        try {
          return await deps.fetchGoogleTotalResults(entry.word, request.lang);
        } catch {
          return undefined;
        }
      },
    ),
    deps.fetchOllamaScores(
      targetEntries.map((entry) => entry.word),
      request.lang,
    ).catch(() => []),
  ]);

  const ollamaByWord = new Map(ollamaScores.map((score) => [score.word, score]));
  const rankedEntries = targetEntries
    .map<RankedEntry>((entry, index) => ({
      ...entry,
      ranking: buildRankingInfo(
        entry,
        googleResults[index],
        ollamaByWord,
        config,
      ),
    }))
    .sort((a, b) => {
      const scoreDiff = b.ranking.combinedScore - a.ranking.combinedScore;
      if (scoreDiff !== 0) return scoreDiff;
      return a.word.localeCompare(b.word, request.lang);
    });

  return {
    items: [...rankedEntries, ...tailEntries],
  };
}
