import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { EntryRow } from '../../../src/shared/types';
import { useHybridRanking } from '../../../src/ui/hooks/useHybridRanking';

const rankEntriesWithHybridSignals = vi.fn();

vi.mock('../../../src/ui/ranking/hybrid-ranker', () => ({
  rankEntriesWithHybridSignals: (...args: unknown[]) => rankEntriesWithHybridSignals(...args),
}));

function createEntry(id: number, word: string): EntryRow {
  return {
    id,
    lang: 'ja',
    word,
    sources: ['test'],
  };
}

describe('useHybridRanking', () => {
  test('when ranking succeeds, should expose ranked items', async () => {
    const baseItems = [createEntry(1, 'ねこ'), createEntry(2, 'ことば')];
    rankEntriesWithHybridSignals.mockResolvedValue({
      items: [
        { ...baseItems[1], ranking: { combinedScore: 0.9 } },
        { ...baseItems[0], ranking: { combinedScore: 0.1 } },
      ],
    });

    const { result } = renderHook(() =>
      useHybridRanking({
        items: baseItems,
        lang: 'ja',
        query: 'こと',
        config: {
          enabled: true,
          maxItems: 10,
          googleConcurrency: 2,
          googleWeight: 0.35,
          ollamaWeight: 0.65,
        },
      }),
    );

    await vi.waitFor(() => {
      expect(result.current.items.map((item) => item.word)).toEqual(['ことば', 'ねこ']);
    });
    expect(result.current.ranking).toBe(false);
  });

  test('when ranking fails, should keep original items', async () => {
    const baseItems = [createEntry(1, 'ねこ'), createEntry(2, 'ことば')];
    rankEntriesWithHybridSignals.mockRejectedValue(new Error('failed'));

    const { result } = renderHook(() =>
      useHybridRanking({
        items: baseItems,
        lang: 'ja',
        query: 'こと',
        config: {
          enabled: true,
          maxItems: 10,
          googleConcurrency: 2,
          googleWeight: 0.35,
          ollamaWeight: 0.65,
        },
      }),
    );

    await vi.waitFor(() => {
      expect(result.current.ranking).toBe(false);
    });
    expect(result.current.items.map((item) => item.word)).toEqual(['ねこ', 'ことば']);
  });
});
