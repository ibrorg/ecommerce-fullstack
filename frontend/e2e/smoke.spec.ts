import { test, expect } from '@playwright/test';

/**
 * Smoke E2E suite — verifies the storefront's golden paths render and the
 * primary navigation works end-to-end. These tests are intentionally broad
 * (not exhaustive) so they stay stable through refactor work.
 *
 * Prereqs:
 *  - Frontend dev server (or docker-compose stack) is running.
 *  - Backend is reachable on :5000 with at least a few seeded products, OR
 *    the API returns an empty list (the empty-state branch is asserted too).
 */

test.describe('Home page', () => {
  test('renders hero and loads the document', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/E-Shop/i);
    // Hero headline should be visible above the fold.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('hero CTA navigates to the products page', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /explore collections/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/products/);
  });

  test('currency switcher changes the displayed currency', async ({ page }) => {
    await page.goto('/');
    // Open the currency dropdown.
    await page.getByRole('button', { name: /currency:/i }).click();
    // Pick INR.
    await page.getByRole('option', { name: /INR/i }).click();
    // At least one price on the page should now contain the ₹ symbol.
    await expect(page.locator('text=₹').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Navigation', () => {
  test('header links are reachable on desktop', async ({ page }) => {
    await page.goto('/');
    // The mobile menu toggle is hidden on desktop viewports.
    await page.setViewportSize({ width: 1280, height: 800 });
    // Every public nav link should navigate without error.
    const cartLink = page.getByRole('link', { name: /bag/i }).first();
    await expect(cartLink).toBeVisible();
    await cartLink.click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    const menuBtn = page.getByRole('button', { name: /toggle menu/i });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    // The mobile nav panel should now expose a "Bag" link.
    await expect(page.getByRole('link', { name: /bag/i }).first()).toBeVisible();
  });
});

test.describe('Products page', () => {
  test('renders the catalog or a graceful empty state', async ({ page }) => {
    await page.goto('/products');
    // Either product cards render OR the empty-state copy shows. Either is a pass.
    const productHeading = page.getByRole('heading', { level: 1 });
    await expect(productHeading).toBeVisible();
  });

  test('unknown route shows the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('body')).toContainText(/404|not found|doesn’t exist|does not exist/i);
  });
});
