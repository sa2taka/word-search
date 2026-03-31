import type { HybridRankerConfig } from './hybrid-ranker';

const DEFAULT_GOOGLE_WEIGHT = 0.35;
const DEFAULT_OLLAMA_WEIGHT = 0.65;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getHybridRankerConfig(): HybridRankerConfig {
  return {
    enabled: import.meta.env.VITE_HYBRID_RANKING === 'true',
    maxItems: parseNumber(import.meta.env.VITE_RANK_MAX_ITEMS, 25),
    googleConcurrency: parseNumber(import.meta.env.VITE_GOOGLE_CONCURRENCY, 3),
    googleWeight: parseNumber(import.meta.env.VITE_GOOGLE_WEIGHT, DEFAULT_GOOGLE_WEIGHT),
    ollamaWeight: parseNumber(import.meta.env.VITE_OLLAMA_WEIGHT, DEFAULT_OLLAMA_WEIGHT),
  };
}

export const HYBRID_RANKER_CONFIG = getHybridRankerConfig();
