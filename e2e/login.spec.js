import { expect, test } from '@playwright/test';

test('login page renders visible UI', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

    await page.goto('/login');

    expect(pageErrors).toEqual([]);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.locator('#app')).not.toBeEmpty();
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});
