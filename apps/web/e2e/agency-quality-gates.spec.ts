import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

async function assertNoCriticalA11yViolations(page: Page, url: string) {
  await page.goto(url);
  await page.addScriptTag({ content: axe.source });

  const result = await page.evaluate(async () => {
    const axeGlobal = (window as unknown as { axe: typeof axe }).axe;
    return axeGlobal.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
  });

  const criticalViolations = result.violations.filter((item) => {
    return item.impact === 'critical' || item.impact === 'serious';
  });

  expect(criticalViolations).toEqual([]);
}

test.describe('agency mobile/a11y/perf quality gates', () => {
  test('agency reports flow renders with mocked API responses', async ({ page }) => {
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orgId: 'org-1', roles: ['AGENCY_ADMIN'] }),
      });
    });
    await page.route('**/v1/orgs/org-1/shops', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'shop-1', shopifyDomain: 'demo.myshopify.com', displayName: 'Demo Shop' },
        ]),
      });
    });
    await page.route('**/v1/reports?shopId=shop-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'report-1',
            period: 'WEEKLY',
            periodStart: '2026-02-01T00:00:00.000Z',
            periodEnd: '2026-02-08T00:00:00.000Z',
            createdAt: '2026-02-08T01:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/agency/reports?host=test-host&shop=demo.myshopify.com');
    await expect(page.getByRole('heading', { name: 'Agency Reports' })).toBeVisible();
    await expect(page.getByLabel('Shop')).toHaveValue('shop-1');
    await expect(page.getByText('Recent Reports')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open selected shop workspace' })).toBeVisible();

    const navigationTiming = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return entry ? entry.domContentLoadedEventEnd : null;
    });
    expect(navigationTiming).not.toBeNull();
    expect(navigationTiming ?? 0).toBeLessThan(3_000);
  });

  test('agency shop workspace flow renders with mocked summary/findings', async ({ page }) => {
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roles: ['AGENCY_VIEWER'] }),
      });
    });
    await page.route('**/v1/shops/shop-1/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          thisMonthSpend: '1200',
          potentialSavings: '240',
          openActions: 4,
          currency: 'USD',
        }),
      });
    });
    await page.route('**/v1/shops/shop-1/findings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'finding-1',
            title: 'Duplicate charge found',
            status: 'OPEN',
            estimatedSavingsAmount: '110',
            currency: 'USD',
          },
        ]),
      });
    });

    await page.goto('/agency/shops/shop-1?host=test-host&shop=demo.myshopify.com');
    await expect(page.getByRole('heading', { name: 'Agency Shop Workspace' })).toBeVisible();
    await expect(page.getByText('Potential savings: 240 USD')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Duplicate charge found' })).toBeVisible();
  });

  test('agency reports page has no serious accessibility violations', async ({ page }) => {
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orgId: 'org-1', roles: ['AGENCY_ADMIN'] }),
      });
    });
    await page.route('**/v1/orgs/org-1/shops', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'shop-1', shopifyDomain: 'demo.myshopify.com', displayName: 'Demo Shop' },
        ]),
      });
    });
    await page.route('**/v1/reports?shopId=shop-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await assertNoCriticalA11yViolations(
      page,
      '/agency/reports?host=test-host&shop=demo.myshopify.com',
    );
  });
});
