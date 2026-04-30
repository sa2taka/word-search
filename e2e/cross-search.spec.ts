import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Cross search feature', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('cross search tab is visible and navigates to cross search panel', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-cross-search"]')).toBeVisible();
    await page.locator('[data-testid="tab-cross-search"]').click();
    await expect(page.locator('.cross-search-panel')).toBeVisible();
  });

  test('cross search panel has two inputs, lang selector and search button', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();

    await expect(page.locator('[aria-label="Cross search pattern 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Cross search pattern 2"]')).toBeVisible();
    await expect(page.locator('#cross-search-lang')).toBeVisible();
    await expect(page.locator('[aria-label="Search cross pattern"]')).toBeVisible();
  });

  test('search button is disabled when both queries are empty', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await expect(page.locator('[aria-label="Search cross pattern"]')).toBeDisabled();
  });

  test('search button is disabled when only pattern 1 is filled', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await page.locator('[aria-label="Cross search pattern 1"]').fill('は112');
    await expect(page.locator('[aria-label="Search cross pattern"]')).toBeDisabled();
  });

  test('when searching は112 + 12がみ, should find はいいろ + いろがみ pair', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await page.locator('[aria-label="Cross search pattern 1"]').fill('は112');
    await page.locator('[aria-label="Cross search pattern 2"]').fill('12がみ');
    await page.locator('[aria-label="Search cross pattern"]').click();

    const items = page.locator('.cross-search-panel__item');
    await expect(items.first()).toBeVisible();

    const allTexts = await page.locator('.cross-search-panel__word').allTextContents();
    expect(allTexts).toContain('はいいろ');
    expect(allTexts).toContain('いろがみ');
  });

  test('when pressing Enter in pattern 1, search is triggered', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await page.locator('[aria-label="Cross search pattern 1"]').fill('は112');
    await page.locator('[aria-label="Cross search pattern 2"]').fill('12がみ');
    await page.locator('[aria-label="Cross search pattern 1"]').press('Enter');

    const items = page.locator('.cross-search-panel__item');
    await expect(items.first()).toBeVisible();
  });

  test('when pressing Enter in pattern 2, search is triggered', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await page.locator('[aria-label="Cross search pattern 1"]').fill('は112');
    await page.locator('[aria-label="Cross search pattern 2"]').fill('12がみ');
    await page.locator('[aria-label="Cross search pattern 2"]').press('Enter');

    const items = page.locator('.cross-search-panel__item');
    await expect(items.first()).toBeVisible();
  });

  test('when no matching pairs, should show no results message', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await page.locator('[aria-label="Cross search pattern 1"]').fill('zzz');
    await page.locator('[aria-label="Cross search pattern 2"]').fill('123');
    await page.locator('[aria-label="Search cross pattern"]').click();

    await expect(page.locator('.cross-search-panel__empty')).toHaveText('No results');
  });

  test('switching back to search tab shows search panel', async ({ page }) => {
    await page.locator('[data-testid="tab-cross-search"]').click();
    await expect(page.locator('.cross-search-panel')).toBeVisible();

    await page.locator('.app-tabs__btn').first().click();
    await expect(page.locator('.search-panel')).toBeVisible();
    await expect(page.locator('.cross-search-panel')).not.toBeVisible();
  });
});
