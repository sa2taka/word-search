import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when clicking License link, should navigate to license page', async ({ page }) => {
    await page.locator('button:has-text("License")').click();

    await expect(page.locator('.license-page__title')).toHaveText('Licenses');
  });

  test('when clicking Back on license page, should return to search', async ({ page }) => {
    await page.locator('button:has-text("License")').click();
    await expect(page.locator('.license-page__title')).toBeVisible();

    await page.locator('button:has-text("Back")').click();

    await expect(page.locator('[aria-label="Search"]')).toBeVisible();
  });
});
