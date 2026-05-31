import { expect, test } from '@playwright/test';

const unauthPaths = ['/login', '/', '/admin', '/admin/reports', '/cashier/pos', '/cashier/history'];

const loginViaUi = async (page, { email, password }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(emailInput).toBeVisible();
    await emailInput.fill(email);

    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(password);

    await page.getByRole('button', { name: /sign in/i }).click();
};

for (const path of unauthPaths) {
    test(`route renders UI (unauth): ${path}`, async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

        await page.goto(path);

        expect(pageErrors).toEqual([]);
        await expect(page.locator('#app')).not.toBeEmpty();

        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

        const safeName = path.replaceAll('/', '_').replace(/^_+/, '') || 'root';
        await expect(page).toHaveScreenshot(`unauth_${safeName}.png`, { fullPage: true });
    });
}

test('admin routes render layout when authenticated', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

    await loginViaUi(page, { email: 'admin@botique.com', password: 'admin123' });
    await page.waitForURL(/\/admin\/?$/);
    expect(pageErrors).toEqual([]);
    await expect(page.locator('#app')).not.toBeEmpty();

    await expect(page.getByText('Welcome back,')).toBeVisible({ timeout: 15000 });

    const openMenu = page.getByLabel('Open menu');
    const closeMenu = page.getByLabel('Close menu');

    const ensureMenuOpen = async () => {
        if (!(await openMenu.isVisible().catch(() => false))) return;
        if (await closeMenu.isVisible().catch(() => false)) return;
        await openMenu.click({ force: true });
    };

    const ensureMenuClosed = async () => {
        if (await closeMenu.isVisible().catch(() => false)) {
            await closeMenu.click();
        }
    };

    await ensureMenuOpen();

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inventory' })).toBeVisible();

    await ensureMenuClosed();

    await expect(page).toHaveScreenshot('admin_dashboard.png', { fullPage: true });

    await ensureMenuOpen();

    await page.getByRole('link', { name: 'Reports' }).click();
    await page.waitForURL(/\/admin\/reports\/?$/);
    await expect(page.getByRole('heading', { name: 'Admin Management Suite' })).toBeVisible({ timeout: 30000 });
    await ensureMenuClosed();
    await expect(page).toHaveScreenshot('admin_reports.png', { fullPage: true });
});

test('staff routes render layout when authenticated', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

    await loginViaUi(page, { email: 'luna@botique.com', password: 'luna123' });
    await page.waitForURL(/\/cashier\/pos\/?$/);
    expect(pageErrors).toEqual([]);
    await expect(page.locator('#app')).not.toBeEmpty();

    await expect(page.locator('input[aria-label="Search products"]:visible')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveScreenshot('staff_pos.png', { fullPage: true });

    const historyLink = page.getByRole('link', { name: 'History' });
    if (await historyLink.isVisible().catch(() => false)) {
        await historyLink.click();
    } else {
        await page.evaluate(() => {
            window.history.pushState({}, '', '/cashier/history');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
    }
    await page.waitForURL(/\/cashier\/history\/?$/);
    await expect(page.getByPlaceholder('Search client, item, or SKU...')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveScreenshot('staff_history.png', { fullPage: true });
});

test('staff POS interactions work on desktop', async ({ page }) => {
    await loginViaUi(page, { email: 'luna@botique.com', password: 'luna123' });
    await page.waitForURL(/\/cashier\/pos\/?$/);

    const search = page.locator('input[aria-label="Search products"]:visible');
    await search.click();
    await search.fill('Lip');
    await expect(search).toHaveValue('Lip');

    await search.fill('');
    await expect(search).toHaveValue('');
});

test('staff POS overlays do not block interactions on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await loginViaUi(page, { email: 'luna@botique.com', password: 'luna123' });
    await page.waitForURL(/\/cashier\/pos\/?$/);

    await page.getByRole('button', { name: 'Categories' }).click();
    const closeFilter = page.getByRole('button', { name: 'Close filter', exact: true });
    await expect(closeFilter).toBeVisible();
    await closeFilter.click();
    await expect(closeFilter).toHaveCount(0);

    await page.getByLabel('Open cart').click();
    const closeCart = page.getByRole('button', { name: 'Close cart', exact: true });
    await expect(closeCart).toBeVisible();
    await closeCart.click();
    await expect(closeCart).toHaveCount(0);

    const search = page.locator('input[aria-label="Search products"]:visible');
    await search.click();
    await search.fill('Test');
    await expect(search).toHaveValue('Test');
});
