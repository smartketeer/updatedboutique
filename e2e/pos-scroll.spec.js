import { expect, test } from '@playwright/test';

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

test('POS cart does not auto-scroll (desktop + mobile)', async ({ page }) => {
    test.setTimeout(60000);
    await loginViaUi(page, { email: 'luna@botique.com', password: 'luna123' });
    await page.waitForURL(/\/cashier\/pos\/?$/);

    const summary = page.getByLabel('Products summary');
    await expect(summary).not.toContainText('Loading', { timeout: 30000 });

    let productCards = page.locator('[data-testid^="product-card-"]');
    if ((await productCards.count()) === 0) {
        productCards = page.locator('div.group.cursor-pointer.select-none');
    }
    await expect(productCards.first()).toBeVisible({ timeout: 15000 });

    const toAdd = Math.min(12, await productCards.count());
    for (let i = 0; i < toAdd; i++) {
        await productCards.nth(i).click();
    }

    const desktopCartScroll = page.getByTestId('cart-scroll-desktop');
    const overlayCartScroll = page.getByTestId('cart-scroll-overlay');

    let cartScroll = desktopCartScroll;
    const desktopVisible = await desktopCartScroll.isVisible().catch(() => false);
    const usingOverlay = !desktopVisible;
    if (!desktopVisible) {
        const openCart = page.getByLabel('Open cart');
        await expect(openCart).toBeVisible();
        await openCart.click({ force: true });
        await expect(overlayCartScroll).toBeVisible();
        cartScroll = overlayCartScroll;
    } else {
        await expect(desktopCartScroll).toBeVisible();
    }

    const initial = await cartScroll.evaluate((el) => {
        el.scrollTop = 140;
        return el.scrollTop;
    });

    const didClickIncrease = await cartScroll.evaluate((root) => {
        const containerRect = root.getBoundingClientRect();
        const buttons = Array.from(root.querySelectorAll('button[aria-label="Increase quantity"]'));
        const visible = buttons.find((b) => {
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top >= containerRect.top && r.bottom <= containerRect.bottom;
        });
        if (!visible) return false;
        visible.click();
        return true;
    });
    if (didClickIncrease) {
        await expect.poll(() => cartScroll.evaluate((el) => el.scrollTop)).toBe(initial);
    }

    if (usingOverlay) return;

    await productCards.first().click();
    await expect.poll(() => cartScroll.evaluate((el) => el.scrollTop)).toBe(initial);
});
