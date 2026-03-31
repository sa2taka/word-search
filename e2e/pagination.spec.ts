import { test, expect } from '@playwright/test';
import { setupMockRoutes, waitForReady } from './helpers/mock-api';

test.describe('Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');
    await waitForReady(page);
  });

  test('when results exceed 50, should enable Next button', async ({ page }) => {
    await page.locator('#search-mode').selectOption('prefix');
    await page.locator('[aria-label="Search"]').fill('たんご');

    await expect(page.locator('.result-list__word').first()).toBeVisible();

    const nextBtn = page.locator('button:has-text("Next")');
    await expect(nextBtn).toBeEnabled();

    const prevBtn = page.locator('button:has-text("Prev")');
    await expect(prevBtn).toBeDisabled();
  });

  test('when clicking Next, should show page 2', async ({ page }) => {
    await page.locator('#search-mode').selectOption('prefix');
    await page.locator('[aria-label="Search"]').fill('たんご');

    await expect(page.locator('.result-list__word').first()).toBeVisible();
    await expect(page.locator('.result-list__page-info')).toContainText('1–50');

    await page.locator('button:has-text("Next")').click();

    await expect(page.locator('.result-list__page-info')).toContainText('51–');
    const prevBtn = page.locator('button:has-text("Prev")');
    await expect(prevBtn).toBeEnabled();
  });

  test('when clicking Prev after Next, should return to page 1', async ({ page }) => {
    await page.locator('#search-mode').selectOption('prefix');
    await page.locator('[aria-label="Search"]').fill('たんご');

    await expect(page.locator('.result-list__word').first()).toBeVisible();
    await page.locator('button:has-text("Next")').click();

    await expect(page.locator('.result-list__page-info')).toContainText('51–');
    await page.locator('button:has-text("Prev")').click();

    await expect(page.locator('.result-list__page-info')).toContainText('1–50');
  });

  test('when on first page, should show correct page info text', async ({ page }) => {
    await page.locator('#search-mode').selectOption('prefix');
    await page.locator('[aria-label="Search"]').fill('たんご');

    await expect(page.locator('.result-list__word').first()).toBeVisible();

    const pageInfo = page.locator('.result-list__page-info');
    await expect(pageInfo).toContainText('1–50 / 55');
  });
});
