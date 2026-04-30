import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Initial talk mode search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when selecting initial talk mode, helper text is shown', async ({ page }) => {
    await page.locator('#search-mode').selectOption('initial');
    await expect(page.locator('.search-panel__helper')).toContainText('イニシャル');
  });

  test('when searching NT in initial talk mode with ja, should match な行+た行 words', async ({ page }) => {
    await page.locator('#search-mode').selectOption('initial');
    await page.locator('[aria-label="Search"]').fill('NT');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // なつ should match: N=[な行]=な, T=[た行]=つ
    expect(texts).toContain('なつ');
  });

  test('when searching NK in initial talk mode with ja, should match な行+か行 words', async ({ page }) => {
    await page.locator('#search-mode').selectOption('initial');
    await page.locator('[aria-label="Search"]').fill('NK');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // にく should match: N=[な行]=に, K=[か行]=く
    expect(texts).toContain('にく');
  });

  test('when searching in initial talk mode with mixed kana and consonant, should match correctly', async ({
    page,
  }) => {
    await page.locator('#search-mode').selectOption('initial');
    await page.locator('[aria-label="Search"]').fill('はT');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // はた: は(literal) + た(T=た行) → matches ^は[たちつてと]$
    expect(texts).toContain('はた');
    for (const text of texts) {
      expect(text.startsWith('は')).toBe(true);
    }
  });

  test('when searching in lowercase initial talk, should work same as uppercase', async ({ page }) => {
    await page.locator('#search-mode').selectOption('initial');
    await page.locator('[aria-label="Search"]').fill('nt');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('なつ');
  });
});
