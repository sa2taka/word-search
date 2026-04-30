import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Number pattern mode search', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when selecting number-pattern mode, helper text is shown', async ({ page }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await expect(page.locator('.search-panel__helper')).toContainText('数字');
  });

  test('when searching は112 in number-pattern mode, should match はいいろ', async ({ page }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await page.locator('[aria-label="Search"]').fill('は112');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('はいいろ');
  });

  test('when searching か111き in number-pattern mode, should match かたたたき', async ({
    page,
  }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await page.locator('[aria-label="Search"]').fill('か111き');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('かたたたき');
  });

  test('when searching 112323 in number-pattern mode, should match ききかいかい', async ({
    page,
  }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await page.locator('[aria-label="Search"]').fill('112323');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('ききかいかい');
  });

  test('when searching 1122 in number-pattern mode with en, should match aabb', async ({
    page,
  }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await page.locator('#search-lang').selectOption('en');
    await page.locator('[aria-label="Search"]').fill('1122');

    const results = page.locator('.result-list__word');
    await expect(results.first()).toBeVisible();
    const texts = await results.allTextContents();
    expect(texts).toContain('aabb');
  });

  test('when no match in number-pattern mode, should show no results', async ({ page }) => {
    await page.locator('#search-mode').selectOption('number-pattern');
    await page.locator('[aria-label="Search"]').fill('123456789');

    await expect(page.locator('.result-list__empty')).toHaveText('No results');
  });
});
