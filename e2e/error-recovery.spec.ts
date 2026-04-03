import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Error recovery', () => {
  test('when meta fetch fails, should show error and recovery buttons', async ({ page }) => {
    await setupMockRoutes(page, { failMeta: true });
    await page.goto('/');

    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    await expect(page.locator('.error-recovery__btn--reset')).toBeVisible();
  });

  test('when clicking Retry after error, should re-initialize', async ({ page }) => {
    await setupMockRoutes(page, { failMeta: true });
    await page.goto('/');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/dict.meta.json');
    await page.unroute('**/dict.sqlite');
    await setupMockRoutes(page);

    await page.locator('button:has-text("Retry")').click();

    await waitForReady(page);
    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/header__status-dot--ready/);
  });

  test('when clicking Reset after error, should return to idle', async ({ page }) => {
    await setupMockRoutes(page, { failMeta: true });
    await page.goto('/');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('.error-recovery__btn--reset').click();

    const statusDot = page.locator('[data-testid="status-dot"]');
    await expect(statusDot).toHaveClass(/header__status-dot--idle/);
  });
});
