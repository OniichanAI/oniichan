import { expect, test } from '@playwright/test';

/**
 * App-boot smoke. We're not testing Discord OAuth itself — that round-trips to
 * discord.com which we don't control from CI. We assert that:
 *   1. The Angular bundle loads at all (the root page returns 200).
 *   2. Unauthenticated traffic to a tenant-scoped route bounces to /login.
 *   3. The Login button hits the backend's /auth/discord/login endpoint,
 *      which returns a real Discord authorize URL. Catching this catches
 *      ~90% of "is the front-to-back wiring broken" regressions.
 */
test('app boots and login redirect is wired', async ({ page }) => {
  // 1. Root renders without a JS error.
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  expect(errors, `expected no page errors, got: ${errors.join(', ')}`).toEqual([]);

  // 2. Unauthenticated → /login.
  await page.waitForURL(/\/(login|onboarding)$/, { timeout: 10_000 });
  expect(page.url()).toMatch(/\/login$/);

  // 3. Login button triggers a Discord OAuth handoff. We intercept the
  //    navigation to discord.com instead of actually going there.
  await page.route(/discord\.com\/.*/, (route) => route.fulfill({ status: 200, body: 'ok' }));

  await Promise.all([
    page.waitForRequest((req) => /discord\.com\/oauth2/.test(req.url()), { timeout: 10_000 }),
    page.getByRole('button', { name: /sign in|login|enter|discord/i }).click(),
  ]);
});

test('backend health endpoint responds', async ({ request }) => {
  const res = await request.get('http://localhost:8000/api/v1/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('status');
});
