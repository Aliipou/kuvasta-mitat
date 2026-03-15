/**
 * Playwright E2E — image upload and measurement flow.
 * Run: npx playwright test
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE   = path.join(__dirname, '../fixtures/ruler-sample.png');

test.describe('Image upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('empty state is visible before upload', async ({ page }) => {
    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#main-canvas')).not.toBeVisible();
  });

  test('canvas appears after file upload', async ({ page }) => {
    const input = page.locator('#file-input');
    await input.setInputFiles(FIXTURE);
    await expect(page.locator('#main-canvas')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#empty-state')).not.toBeVisible();
  });

  test('status bar shows image dimensions after upload', async ({ page }) => {
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await expect(page.locator('#status-mode')).toContainText('px', { timeout: 3000 });
  });
});

test.describe('Measurement drawing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await page.locator('#main-canvas').waitFor({ state: 'visible' });
  });

  test('two clicks create one measurement', async ({ page }) => {
    const canvas = page.locator('#main-canvas');
    const box    = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } });
    await canvas.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } });

    await expect(page.locator('#results-body tr')).toHaveCount(1);
    await expect(page.locator('#status-count')).toContainText('1 viivaa');
  });

  test('clear button removes all measurements', async ({ page }) => {
    const canvas = page.locator('#main-canvas');
    const box    = await canvas.boundingBox();
    await canvas.click({ position: { x: 50, y: 100 } });
    await canvas.click({ position: { x: 200, y: 100 } });
    await page.locator('#tool-clear').click();

    await expect(page.locator('#status-count')).toBeEmpty();
  });

  test('export button is enabled after drawing', async ({ page }) => {
    const canvas = page.locator('#main-canvas');
    await canvas.click({ position: { x: 50, y: 100 } });
    await canvas.click({ position: { x: 200, y: 100 } });
    await expect(page.locator('#export-btn')).toBeEnabled();
  });
});

test.describe('Reference scale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#file-input').setInputFiles(FIXTURE);
    await page.locator('#main-canvas').waitFor({ state: 'visible' });
    // Draw one line
    const canvas = page.locator('#main-canvas');
    await canvas.click({ position: { x: 50, y: 150 } });
    await canvas.click({ position: { x: 250, y: 150 } });
  });

  test('scale badge appears after setting reference', async ({ page }) => {
    await page.locator('#ref-select').selectOption({ index: 1 });
    await page.locator('#ref-mm').fill('100');
    await page.locator('#ref-set-btn').click();

    await expect(page.locator('#scale-display')).toBeVisible();
    await expect(page.locator('#scale-value')).not.toBeEmpty();
  });

  test('mm values appear in results table after reference set', async ({ page }) => {
    await page.locator('#ref-select').selectOption({ index: 1 });
    await page.locator('#ref-mm').fill('100');
    await page.locator('#ref-set-btn').click();

    const cell = page.locator('#results-body td').nth(2);
    await expect(cell).toContainText('mm');
  });
});
