import { expect, test } from '@playwright/test';
import { USERS, login } from './helpers';

test.beforeEach(async ({ page }) => login(page, USERS.client));

test('deleting a workout can be undone', async ({ page }) => {
  await page.goto('/client/workouts');
  const rows = page.getByTestId('workout-row');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await rows.first().getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(before - 1);
  await page.getByTestId('undo').click();
  await expect(rows).toHaveCount(before);
});

test('muting a notification category is remembered', async ({ page }) => {
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByTestId('notif-settings').click();
  const toggle = page.getByTestId('notif-ANNOUNCEMENTS').locator('input');
  await expect(toggle).toBeChecked();
  await toggle.click({ force: true });
  await expect(toggle).not.toBeChecked();
  await page.waitForTimeout(300); // let the store persist
  await page.reload();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByTestId('notif-settings').click();
  await expect(page.getByTestId('notif-ANNOUNCEMENTS').locator('input')).not.toBeChecked();
});

test('QR card is shown', async ({ page }) => {
  await page.goto('/client/card');
  await expect(page.locator('canvas, img').first()).toBeVisible();
});
