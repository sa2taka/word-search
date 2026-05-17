import { describe, test, expect } from 'vitest';
import { buildAnagramKey } from '../../src/shared/anagram';

describe('buildAnagramKey', () => {
  test('sorts English characters', () => {
    expect(buildAnagramKey('tac')).toBe('act');
    expect(buildAnagramKey('tae')).toBe('aet');
  });

  test('normalizes Japanese characters before sorting', () => {
    expect(buildAnagramKey('ネコ')).toBe('こね');
    expect(buildAnagramKey('きゃ')).toBe('きや');
  });
});
