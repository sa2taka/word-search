import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Word split feature', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('word split tab is visible and navigates to word split panel', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-word-split"]')).toBeVisible();
    await page.locator('[data-testid="tab-word-split"]').click();
    await expect(page.locator('.word-split-panel')).toBeVisible();
  });

  test('word split panel has input, lang selector and search button', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();

    await expect(page.locator('[aria-label="Word split query"]')).toBeVisible();
    await expect(page.locator('#word-split-lang')).toBeVisible();
    await expect(page.locator('[aria-label="Search word split"]')).toBeVisible();
  });

  test('when searching ごんじじさ, should find ごじ + さんじ pair', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await page.locator('[aria-label="Word split query"]').fill('ごんじじさ');
    await page.locator('[aria-label="Search word split"]').click();

    const items = page.locator('.word-split-panel__item');
    await expect(items.first()).toBeVisible();

    const allTexts = await page.locator('.word-split-panel__word').allTextContents();
    // ごじ と さんじ が両方結果に含まれる
    expect(allTexts).toContain('ごじ');
    expect(allTexts).toContain('さんじ');
  });

  test('when pressing Enter in word split input, search is triggered', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await page.locator('[aria-label="Word split query"]').fill('ごんじじさ');
    await page.locator('[aria-label="Word split query"]').press('Enter');

    const items = page.locator('.word-split-panel__item');
    await expect(items.first()).toBeVisible();
  });

  test('when no matching pairs, should show no results message', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await page.locator('[aria-label="Word split query"]').fill('zzzzzzz');
    await page.locator('[aria-label="Search word split"]').click();

    await expect(page.locator('.word-split-panel__empty')).toHaveText('No results');
  });

  test('search button is disabled when query is empty', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await expect(page.locator('[aria-label="Search word split"]')).toBeDisabled();
  });

  test('switching back to search tab shows search panel', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await expect(page.locator('.word-split-panel')).toBeVisible();

    await page.locator('.app-tabs__btn').first().click();
    await expect(page.locator('.search-panel')).toBeVisible();
    await expect(page.locator('.word-split-panel')).not.toBeVisible();
  });

  test('when searching with en lang, should find English word pairs', async ({ page }) => {
    await page.locator('[data-testid="tab-word-split"]').click();
    await page.locator('#word-split-lang').selectOption('en');
    // sunset = sun + set
    await page.locator('[aria-label="Word split query"]').fill('sunset');
    await page.locator('[aria-label="Search word split"]').click();

    const items = page.locator('.word-split-panel__item');
    await expect(items.first()).toBeVisible();
    const allTexts = await page.locator('.word-split-panel__word').allTextContents();
    expect(allTexts).toContain('sun');
    expect(allTexts).toContain('set');
  });
});
