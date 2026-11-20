import { Page, expect } from '@playwright/test';

/** Fresh demo data, English, light mode. */
export async function reset(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('liftly-lang', 'en');
    localStorage.setItem('liftly-appearance', 'light');
  });
}

export async function login(page: Page, email: string) {
  await reset(page);
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#pwd', 'demo');
  await page.click('button[type=submit]');
  await expect(page).not.toHaveURL(/\/login/);
}

export const USERS = {
  super: 'super@liftly.io',
  admin: 'admin@irontemple.io',
  coach: 'coach@liftly.io',
  client: 'client@liftly.io',
  staff: 'staff@liftly.io',
};
