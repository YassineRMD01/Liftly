import { expect, test } from '@playwright/test';
import { USERS, login, reset } from './helpers';

test('each role lands on its own home page', async ({ page }) => {
  for (const [email, url] of [[USERS.super, /\/super-admin$/], [USERS.admin, /\/admin$/], [USERS.coach, /\/coach$/], [USERS.client, /\/client$/], [USERS.staff, /\/staff$/]] as const) {
    await login(page, email);
    await expect(page).toHaveURL(url);
  }
});

test('wrong password is refused', async ({ page }) => {
  await reset(page);
  await page.goto('/login');
  await page.fill('#email', USERS.client);
  await page.fill('#pwd', 'nope');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/login/);
});

test('protected pages redirect to login', async ({ page }) => {
  await reset(page);
  await page.goto('/admin/clients');
  await expect(page).toHaveURL(/\/login/);
});
