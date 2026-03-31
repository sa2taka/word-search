import { useEffect, useState } from 'react';
import type { EntryRow, Lang } from '../../shared/types';
import { fetchGoogleTotalResults, fetchOllamaScores } from '../ranking/fetchers';
import {
  rankEntriesWithHybridSignals,
  type HybridRankerConfig,
} from '../ranking/hybrid-ranker';
import { HYBRID_RANKER_CONFIG } from '../ranking/config';

interface UseHybridRankingParams {
  items: EntryRow[];
  lang: Lang;
  query: string;
  config?: HybridRankerConfig;
}

interface UseHybridRankingReturn {
  items: EntryRow[];
  ranking: boolean;
}

interface RankingState {
  key: string | null;
  items: EntryRow[] | null;
}

export function useHybridRanking({
  items,
  lang,
  query,
  config = HYBRID_RANKER_CONFIG,
}: UseHybridRankingParams): UseHybridRankingReturn {
  const [state, setState] = useState<RankingState>({
    key: null,
    items: null,
  });
  const normalizedQuery = query.trim();
  const rankingKey = `${lang}\n${normalizedQuery}\n${items.map((item) => item.id).join(',')}`;
  const shouldRank = normalizedQuery !== '' && items.length > 0 && config.enabled;

  useEffect(() => {
    let disposed = false;

    if (!shouldRank) {
      return () => {
        disposed = true;
      };
    }

    rankEntriesWithHybridSignals(
      { entries: items, lang },
      { fetchGoogleTotalResults, fetchOllamaScores },
      config,
    )
      .then((result) => {
        if (disposed) return;
        setState({
          key: rankingKey,
          items: result.items,
        });
      })
      .catch(() => {
        if (disposed) return;
        setState({
          key: rankingKey,
          items,
        });
      });

    return () => {
      disposed = true;
    };
  }, [config, items, lang, rankingKey, shouldRank]);

  const ranking = shouldRank && state.key !== rankingKey;

  return {
    items: state.key === rankingKey && state.items != null ? state.items : items,
    ranking,
  };
}
