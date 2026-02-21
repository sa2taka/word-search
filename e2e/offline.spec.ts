import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Offline functionality', () => {
  test('when DB is cached and network goes offline, should still work', async ({
    page,
    context,
  }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);

    await page.locator('[aria-label="Search"]').fill('猫');
    await expect(page.locator('.result-list__surface').first()).toBeVisible();

    await context.setOffline(true);

    await page.locator('[aria-label="Search"]').fill('犬');
    await expect(page.locator('.result-list__surface').first()).toBeVisible();
    await expect(page.locator('.result-list__surface').first()).toHaveText('犬');
  });

  test('when meta fetch fails on reload, should use local DB for search', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);

    // Re-route meta to fail (simulates offline/server-down scenario)
    await page.unroute('**/dict.meta.json');
    await page.route('**/dict.meta.json', (route) =>
      route.abort('connectionrefused'),
    );

    await page.reload();
    await waitForReady(page);

    await page.locator('[aria-label="Search"]').fill('東京');
    await expect(page.locator('.result-list__surface').first()).toBeVisible();
    await expect(page.locator('.result-list__surface').first()).toHaveText('東京');
  });
});
