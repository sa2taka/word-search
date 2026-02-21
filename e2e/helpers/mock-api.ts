import type { Page } from '@playwright/test';
import { generateTestDb } from '../fixtures/generate-db';
import type { DictMeta } from '../../src/shared/types';

interface MockRouteOptions {
  failMeta?: boolean;
  failDb?: boolean;
  slowDb?: number;
  overrideMeta?: Partial<DictMeta>;
}

export async function setupMockRoutes(page: Page, options: MockRouteOptions = {}) {
  const { dbBinary, meta } = await generateTestDb();
  const effectiveMeta = { ...meta, ...options.overrideMeta };

  await page.route('**/dict.meta.json', (route) => {
    if (options.failMeta) {
      return route.fulfill({ status: 500, body: 'Internal Server Error' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(effectiveMeta),
    });
  });

  await page.route('**/dict.sqlite', async (route) => {
    if (options.failDb) {
      return route.fulfill({ status: 500, body: 'Internal Server Error' });
    }

    if (options.slowDb) {
      await new Promise((r) => setTimeout(r, options.slowDb));
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: Buffer.from(dbBinary),
      headers: {
        'Content-Length': String(dbBinary.byteLength),
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  });

  return { meta: effectiveMeta, dbBinary };
}

export async function waitForReady(page: Page) {
  await page.waitForFunction(
    () => {
      const dot = document.querySelector('[data-testid="status-dot"]');
      return dot?.classList.contains('header__status-dot--ready');
    },
    { timeout: 15_000 },
  );
}
