import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Vowel search mode', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when selecting vowel mode, helper text contains 母音', async ({ page }) => {
    await page.locator('#search-mode').selectOption('vowel');
    await expect(page.locator('.search-panel__helper')).toContainText('母音');
  });

  test('when searching なまあし in vowel mode, should find words with aaai pattern', async ({ page }) => {
    await page.locator('#search-mode').selectOption('vowel');
    await page.locator('[aria-label="Search"]').fill('なまあし');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // わたがし also has aaai vowel pattern
    expect(texts).toContain('わたがし');
    // All results should have 4 characters (length of aaai pattern)
    for (const text of texts) {
      expect(text.length).toBe(4);
    }
  });

  test('shows extracted vowel pattern as hint', async ({ page }) => {
    await page.locator('#search-mode').selectOption('vowel');
    await page.locator('[aria-label="Search"]').fill('なまあし');
    // The vowel pattern 'aaai' should be shown as hint below the input
    await expect(page.locator('.search-panel__normalized')).toContainText('aaai');
  });

  test('when searching たなか in vowel mode (aaa), should find さかな', async ({ page }) => {
    await page.locator('#search-mode').selectOption('vowel');
    await page.locator('[aria-label="Search"]').fill('たなか');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('さかな');
    for (const text of texts) {
      expect(text.length).toBe(3);
    }
  });

  test('when searching なつ in vowel mode (au pattern), should find はる', async ({ page }) => {
    await page.locator('#search-mode').selectOption('vowel');
    await page.locator('[aria-label="Search"]').fill('なつ');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // はる has the same au pattern as なつ
    expect(texts).toContain('はる');
    for (const text of texts) {
      expect(text.length).toBe(2);
    }
  });

  test('when searching in en lang vowel mode, finds words with same vowel sequence', async ({ page }) => {
    await page.locator('#search-lang').selectOption('en');
    await page.locator('#search-mode').selectOption('vowel');
    await page.locator('[aria-label="Search"]').fill('sunset');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    // runner also has 'ue' vowel pattern (r-u-nn-e-r)
    expect(texts).toContain('runner');
  });
});
