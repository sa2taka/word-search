import { describe, test, expect } from 'vitest';
import { computeSha256 } from './hash';

describe('computeSha256', () => {
  test('should return correct hex hash for known input', async () => {
    const data = new TextEncoder().encode('hello');
    const expected =
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

    const hash = await computeSha256(data);

    expect(hash).toBe(expected);
  });

  test('should return different hash for different input', async () => {
    const data1 = new TextEncoder().encode('hello');
    const data2 = new TextEncoder().encode('world');

    const hash1 = await computeSha256(data1);
    const hash2 = await computeSha256(data2);

    expect(hash1).not.toBe(hash2);
  });
});
