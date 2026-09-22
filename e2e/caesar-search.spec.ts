import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Caesar shift search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
    await page.getByTestId('tab-caesar-search').click();
  });

  test('when opening the tab, should show the caesar search panel', async ({ page }) => {
    await expect(page.locator('.caesar-search-panel__description')).toContainText('ずらす');
  });

  test('when searching けいゆ, should show しおり as a +3 shift', async ({ page }) => {
    await page.locator('[aria-label="Caesar search query"]').fill('けいゆ');
    await page.locator('[aria-label="Search caesar shift"]').click();

    const items = page.locator('.caesar-search-panel__item');
    await expect(items.first()).toBeVisible();
    await expect(items.first().locator('.caesar-search-panel__shift')).toHaveText('+3');
    await expect(items.first().locator('.caesar-search-panel__word')).toHaveText('しおり');
  });

  test('when searching しおり, should show けいゆ as a -3 shift', async ({ page }) => {
    await page.locator('[aria-label="Caesar search query"]').fill('しおり');
    await page.locator('[aria-label="Search caesar shift"]').click();

    const items = page.locator('.caesar-search-panel__item');
    await expect(items.first()).toBeVisible();
    await expect(items.first().locator('.caesar-search-panel__shift')).toHaveText('-3');
    await expect(items.first().locator('.caesar-search-panel__word')).toHaveText('けいゆ');
  });

  test('when searching in katakana, should find the same word', async ({ page }) => {
    await page.locator('[aria-label="Caesar search query"]').fill('ケイユ');
    await page.locator('[aria-label="Search caesar shift"]').click();

    await expect(page.locator('.caesar-search-panel__word').first()).toHaveText('しおり');
  });

  test('when pressing Enter in the input, should run the search', async ({ page }) => {
    await page.locator('[aria-label="Caesar search query"]').fill('けいゆ');
    await page.locator('[aria-label="Caesar search query"]').press('Enter');

    await expect(page.locator('.caesar-search-panel__word').first()).toHaveText('しおり');
  });

  test('when no shift produces a word, should show no results', async ({ page }) => {
    await page.locator('[aria-label="Caesar search query"]').fill('ごじ');
    await page.locator('[aria-label="Search caesar shift"]').click();

    await expect(page.locator('.caesar-search-panel__empty')).toBeVisible();
  });
});
