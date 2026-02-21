import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('DB initialization and download', () => {
  test('when first accessing, should download DB and become ready', async ({ page }) => {
    const { meta } = await setupMockRoutes(page);
    await page.goto('/');

    await waitForReady(page);

    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/header__status-dot--ready/);
    await expect(page.locator('.header__meta')).toContainText(`v${meta.version}`);
  });

  test('when downloading, should show progress bar', async ({ page }) => {
    await setupMockRoutes(page, { slowDb: 500 });
    await page.goto('/');

    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 5_000 });

    await waitForReady(page);
    await expect(progressBar).not.toBeVisible();
  });

  test('when download completes, should show ready status dot', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    await waitForReady(page);

    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveAttribute('aria-label', 'DB status: ready');
  });

});
