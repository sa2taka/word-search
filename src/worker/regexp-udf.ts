import { WorkerError } from './worker-error';

let deadline = Infinity;

export function setRegexpDeadline(ms: number): void {
  deadline = ms;
}

export function clearRegexpDeadline(): void {
  deadline = Infinity;
}

export function createRegexpMatcher(): (pattern: string, value: string) => number {
  const cache = new Map<string, RegExp>();
  let callCount = 0;

  return (pattern: string, value: string): number => {
    callCount++;
    if (callCount % 100 === 0 && Date.now() > deadline) {
      throw new WorkerError('SEARCH_TIMEOUT', 'Regex search timed out');
    }

    let re = cache.get(pattern);
    if (!re) {
      try {
        re = new RegExp(pattern);
      } catch {
        throw new WorkerError('REGEX_INVALID', `Invalid regex pattern: ${pattern}`);
      }
      cache.set(pattern, re);
    }
    return re.test(value) ? 1 : 0;
  };
}
