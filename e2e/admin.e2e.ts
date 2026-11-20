import { expect, test } from '@playwright/test';
import { USERS, login } from './helpers';

test.beforeEach(async ({ page }) => login(page, USERS.admin));

test('Ctrl+K finds a member and opens the filtered list', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await page.getByTestId('palette-input').fill('sara');
  await expect(page.getByTestId('palette-hit').first()).toContainText('Sara Lopez');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/clients\?q=Sara/);
  await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(1);
});

test('keyboard shortcuts: g m and ? help', async ({ page }) => {
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('g');
  await page.keyboard.press('m');
  await expect(page).toHaveURL(/\/admin\/messages/);
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcuts-help')).toBeVisible();
});

test('manual check-in works offline and syncs when back online', async ({ page, context }) => {
  await page.goto('/admin/checkin');
  await expect(page.getByTestId('checkin-search')).toBeVisible();
  const count = () => page.evaluate(() => Object.values(localStorage).map((v) => { try { return JSON.parse(v); } catch { return null; } }).find((x) => x?.checkIns)?.checkIns.length as number);
  const start = await count();

  await context.setOffline(true);
  await page.getByTestId('checkin-search').fill('ethan');
  await page.getByRole('button', { name: 'Check in', exact: true }).first().click();
  await expect(page.getByTestId('checkin-result')).toContainText('Saved offline');
  await expect(page.getByTestId('offline-indicator')).toContainText('1 queued');
  expect(await count()).toBe(start);

  await context.setOffline(false);
  await expect(page.getByTestId('offline-indicator')).toHaveCount(0);
  await expect.poll(count).toBe(start + 1);
});

test('high contrast mode can be switched on', async ({ page }) => {
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('menuitem', { name: 'High contrast' }).click();
  await expect(page.locator('html')).toHaveClass(/app-hc/);
});
