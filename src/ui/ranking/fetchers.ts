import type { Lang } from '../../shared/types';
import type { OllamaWordScore } from './hybrid-ranker';

const GOOGLE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const OLLAMA_ENDPOINT = 'http://127.0.0.1:11434/api/generate';

interface GoogleSearchResponse {
  searchInformation?: {
    totalResults?: string;
  };
}

interface OllamaGenerateResponse {
  response?: string;
}

interface OllamaJsonResponse {
  items?: Array<{
    word?: string;
    score?: number;
    reason?: string;
  }>;
}

function buildGoogleQuery(word: string, lang: Lang): string {
  const languageHint = lang === 'ja' ? '日本語 単語' : 'english word';
  return `"${word}" ${languageHint}`;
}

function getRequiredEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export async function fetchGoogleTotalResults(
  word: string,
  lang: Lang,
): Promise<number | undefined> {
  const key = getRequiredEnv('VITE_GOOGLE_API_KEY');
  const cx = getRequiredEnv('VITE_GOOGLE_CX');
  if (!key || !cx) return undefined;

  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', buildGoogleQuery(word, lang));
  url.searchParams.set('fields', 'searchInformation(totalResults)');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google lookup failed: ${response.status}`);
  }

  const body = await response.json() as GoogleSearchResponse;
  const totalResults = body.searchInformation?.totalResults;
  return totalResults != null ? Number(totalResults) : undefined;
}

function buildOllamaPrompt(words: string[], lang: Lang): string {
  const language = lang === 'ja' ? '日本語' : '英語';
  return [
    `次の${language}の単語候補について、「一般的に使われている、一般的に知られている」なら 1、そうでないなら 0 を返してください。`,
    'JSON だけを返してください。',
    '形式: {"items":[{"word":"...", "score":0, "reason":"20文字以内"}]}',
    'score は 0 または 1 のみです。',
    '評価観点: 一般的な認知度、日常的な使用頻度、広く知られた語かどうか。',
    `候補: ${words.join(', ')}`,
  ].join('\n');
}

export async function fetchOllamaScores(
  words: string[],
  lang: Lang,
): Promise<OllamaWordScore[]> {
  const model = getRequiredEnv('VITE_OLLAMA_MODEL');
  if (!model || words.length === 0) return [];

  const response = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      prompt: buildOllamaPrompt(words, lang),
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama lookup failed: ${response.status}`);
  }

  const body = await response.json() as OllamaGenerateResponse;
  if (!body.response) return [];

  const parsed = JSON.parse(body.response) as OllamaJsonResponse;
  return (parsed.items ?? [])
    .filter((item): item is Required<Pick<OllamaWordScore, 'word' | 'score'>> & { reason?: string } =>
      typeof item.word === 'string' && typeof item.score === 'number')
    .map((item) => ({
      word: item.word,
      score: item.score >= 0.5 ? 1 : 0,
      reason: item.reason,
    }));
}
