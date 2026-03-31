import { describe, expect, test, vi } from 'vitest';
import type { EntryRow, Lang } from '../../../src/shared/types';
import {
  rankEntriesWithHybridSignals,
  type HybridRankerConfig,
} from '../../../src/ui/ranking/hybrid-ranker';

function createEntry(id: number, word: string, lang: Lang = 'ja'): EntryRow {
  return {
    id,
    lang,
    word,
    sources: ['test'],
  };
}

describe('rankEntriesWithHybridSignals', () => {
  test('when google and ollama scores are available, should sort by combined score', async () => {
    const entries = [
      createEntry(1, 'ねこ'),
      createEntry(2, 'ことば'),
      createEntry(3, 'ぬま'),
    ];
    const fetchGoogleTotalResults = vi
      .fn()
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(80_000)
      .mockResolvedValueOnce(4);
    const fetchOllamaScores = vi.fn().mockResolvedValue([
      { word: 'ねこ', score: 0.2, reason: '一般的すぎる' },
      { word: 'ことば', score: 0.95, reason: '謎解きで使いやすい' },
      { word: 'ぬま', score: 0.1, reason: '用途が狭い' },
    ]);
    const config: HybridRankerConfig = {
      enabled: true,
      maxItems: 10,
      googleConcurrency: 2,
      googleWeight: 0.35,
      ollamaWeight: 0.65,
    };

    const result = await rankEntriesWithHybridSignals(
      { entries, lang: 'ja' },
      { fetchGoogleTotalResults, fetchOllamaScores },
      config,
    );

    expect(result.items.map((entry) => entry.word)).toEqual(['ことば', 'ねこ', 'ぬま']);
    expect(result.items[0]?.ranking).toMatchObject({
      googleTotalResults: 80_000,
      ollamaScore: 0.95,
      combinedScore: expect.any(Number),
      reason: '謎解きで使いやすい',
    });
  });

  test('when google lookup fails, should still rank with ollama score', async () => {
    const entries = [createEntry(1, 'apple', 'en'), createEntry(2, 'azure', 'en')];
    const fetchGoogleTotalResults = vi.fn().mockRejectedValue(new Error('google failed'));
    const fetchOllamaScores = vi.fn().mockResolvedValue([
      { word: 'apple', score: 0.1, reason: '一般名詞として広すぎる' },
      { word: 'azure', score: 0.8, reason: '文字列として扱いやすい' },
    ]);
    const config: HybridRankerConfig = {
      enabled: true,
      maxItems: 10,
      googleConcurrency: 2,
      googleWeight: 0.35,
      ollamaWeight: 0.65,
    };

    const result = await rankEntriesWithHybridSignals(
      { entries, lang: 'en' },
      { fetchGoogleTotalResults, fetchOllamaScores },
      config,
    );

    expect(result.items.map((entry) => entry.word)).toEqual(['azure', 'apple']);
    expect(result.items[0]?.ranking?.googleTotalResults).toBeUndefined();
  });

  test('when ranking is disabled, should return original order without external lookups', async () => {
    const entries = [createEntry(1, 'ねこ'), createEntry(2, 'いぬ')];
    const fetchGoogleTotalResults = vi.fn();
    const fetchOllamaScores = vi.fn();
    const config: HybridRankerConfig = {
      enabled: false,
      maxItems: 10,
      googleConcurrency: 2,
      googleWeight: 0.35,
      ollamaWeight: 0.65,
    };

    const result = await rankEntriesWithHybridSignals(
      { entries, lang: 'ja' },
      { fetchGoogleTotalResults, fetchOllamaScores },
      config,
    );

    expect(result.items.map((entry) => entry.word)).toEqual(['ねこ', 'いぬ']);
    expect(fetchGoogleTotalResults).not.toHaveBeenCalled();
    expect(fetchOllamaScores).not.toHaveBeenCalled();
  });
});
