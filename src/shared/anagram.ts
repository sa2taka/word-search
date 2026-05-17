import { normalizeWord } from './normalize';

export function buildAnagramKey(input: string): string {
  return [...normalizeWord(input)].sort().join('');
}
