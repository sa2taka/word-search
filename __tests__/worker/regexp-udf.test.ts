import { describe, test, expect } from 'vitest';
import {
  createRegexpMatcher,
  setRegexpDeadline,
  clearRegexpDeadline,
} from '../../src/worker/regexp-udf';
import { WorkerError } from '../../src/worker/worker-error';

describe('createRegexpMatcher', () => {
  test('when pattern matches value, should return 1', () => {
    const matcher = createRegexpMatcher();

    expect(matcher('hello', 'hello world')).toBe(1);
  });

  test('when pattern does not match value, should return 0', () => {
    const matcher = createRegexpMatcher();

    expect(matcher('xyz', 'hello world')).toBe(0);
  });

  test('when using anchored regex, should respect anchors', () => {
    const matcher = createRegexpMatcher();

    expect(matcher('^hel', 'hello')).toBe(1);
    expect(matcher('^hel', 'xhello')).toBe(0);
  });

  test('when pattern is invalid regex, should throw WorkerError with REGEX_INVALID code', () => {
    const matcher = createRegexpMatcher();
    let error: unknown;

    try {
      matcher('[invalid', 'test');
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('REGEX_INVALID');
  });

  test('when deadline is exceeded after 100 calls, should throw SEARCH_TIMEOUT', () => {
    const matcher = createRegexpMatcher();
    setRegexpDeadline(Date.now() - 1);

    let error: unknown;
    try {
      for (let i = 0; i < 101; i++) {
        matcher('test', 'test string');
      }
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkerError);
    expect((error as WorkerError).code).toBe('SEARCH_TIMEOUT');
    clearRegexpDeadline();
  });
});
