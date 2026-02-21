import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Search functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when searching in contains mode with Japanese, should show matching results', async ({
    page,
  }) => {
    await page.locator('[aria-label="Search"]').fill('猫');

    const results = page.locator('.result-list__surface');
    await expect(results.first()).toBeVisible();
    await expect(results.first()).toHaveText('猫');
  });

  test('when searching by reading in hiragana, should show matching results', async ({ page }) => {
    await page.locator('[aria-label="Search"]').fill('ねこ');

    const results = page.locator('.result-list__surface');
    await expect(results.first()).toBeVisible();
    await expect(results.first()).toHaveText('猫');
  });

  test('when searching in prefix mode, should return only prefix matches', async ({ page }) => {
    await page.locator('#search-mode').selectOption('prefix');
    await page.locator('#search-lang').selectOption('en');
    await page.locator('[aria-label="Search"]').fill('app');

    const results = page.locator('.result-list__surface');
    await expect(results).toHaveCount(2);

    const texts = await results.allTextContents();
    for (const text of texts) {
      expect(text.startsWith('app')).toBe(true);
    }
  });

  test('when searching in regex mode, should match pattern', async ({ page }) => {
    await page.locator('#search-mode').selectOption('regex');
    await page.locator('#search-lang').selectOption('en');
    await page.locator('[aria-label="Search"]').fill('test\\d+');

    const results = page.locator('.result-list__surface');
    await expect(results).toHaveCount(2);

    const texts = await results.allTextContents();
    for (const text of texts) {
      expect(text).toMatch(/test\d+/);
    }
  });

  test('when switching language from ja to en, should show different results', async ({
    page,
  }) => {
    await page.locator('[aria-label="Search"]').fill('cat');
    await expect(page.locator('.result-list__empty')).toBeVisible();

    await page.locator('#search-lang').selectOption('en');

    await expect(page.locator('.result-list__surface').first()).toBeVisible();
    const enTexts = await page.locator('.result-list__surface').allTextContents();
    expect(enTexts).toContain('cat');
  });

  test('when query is empty, should show no results message', async ({ page }) => {
    await page.locator('[aria-label="Search"]').fill('');

    await expect(page.locator('.result-list__empty')).toHaveText('No results');
  });
});
