// PLAN.md Track E — the website's own version of Track B's app-side backup round-trip test.
// /api/data (GET full export, POST full replace) is this project's actual "backup" path for the
// website (there's no separate JSON backup feature here, unlike the app) — nothing previously
// asserted a round-trip through it survives byte-for-byte, or that CSRF actually blocks an
// unauthenticated write. Each test uses its own throwaway user, same pattern as ui-smoke.spec.js.
const { test, expect } = require('@playwright/test');

async function loginFreshUser(page) {
  const username = `pw-data-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.goto('/pick');
  const csrf = await page.locator('input[name="_csrf"]').first().inputValue();
  await page.evaluate(async ({ csrf, username }) => {
    const body = new URLSearchParams({ _csrf: csrf, username });
    await fetch('/add_user', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  }, { csrf, username });
  await page.goto('/pick');
  await page.locator(`.user-slot[data-name="${username.toLowerCase()}"] button.user-card`).click();
  await page.waitForLoadState();
  return username;
}

test.describe('/api/data full export/import round-trip', () => {
  test('POSTed discs/meta come back unchanged from a GET', async ({ page }) => {
    await loginFreshUser(page);
    await page.goto('/');

    const payload = {
      discs: [
        { id: 1, mfr: 'Innova', mold: 'Destroyer', plastic: 'Star', weight: '175', speed: 12, glide: 5, turn: -1, fade: 3, use: 'Driver', thr: 'RHBH', notes: 'test note', color: '#ff00aa', inBag: true, stabilityAdj: 1, roleTag: 'hyzer bomb' },
        { id: 2, mfr: 'Discraft', mold: 'Buzzz', plastic: 'Z', weight: '177', speed: 5, glide: 4, turn: -1, fade: 1, use: 'Mid', thr: 'RHBH', notes: '', color: '', inBag: false, stabilityAdj: 0, roleTag: '' },
      ],
      nextId: 105,
      sortMode: 'name',
      arcView: 'LHFH',
    };

    const posted = await page.evaluate(async (payload) => {
      const token = document.querySelector('input[name="_csrf"]').value;
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(payload),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, payload);
    expect(posted.status).toBe(200);
    expect(posted.body).toEqual({ ok: true });

    const got = await page.evaluate(async () => {
      const res = await fetch('/api/data');
      return res.json();
    });

    // Compare disc-by-disc rather than the whole array — the server assigns its own
    // sort_order-derived ordering, but every field within a disc must survive exactly.
    expect(got.discs).toHaveLength(2);
    const byMold = Object.fromEntries(got.discs.map((d) => [d.mold, d]));
    expect(byMold['Destroyer']).toMatchObject({
      mfr: 'Innova', plastic: 'Star', weight: '175', speed: 12, glide: 5, turn: -1, fade: 3,
      use: 'Driver', thr: 'RHBH', notes: 'test note', color: '#ff00aa', inBag: true,
      stabilityAdj: 1, roleTag: 'hyzer bomb',
    });
    expect(byMold['Buzzz']).toMatchObject({ mfr: 'Discraft', speed: 5, inBag: false, stabilityAdj: 0, roleTag: '' });
    expect(got.sortMode).toBe('name');
    expect(got.arcView).toBe('LHFH');
    expect(got.nextId).toBe(105);
  });

  test('a full replace via POST drops discs no longer in the payload', async ({ page }) => {
    await loginFreshUser(page);
    await page.goto('/');

    const post = (discs) => page.evaluate(async (discs) => {
      const token = document.querySelector('input[name="_csrf"]').value;
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ discs, nextId: 100, sortMode: 'speed-desc', arcView: 'RHBH' }),
      });
    }, discs);

    await post([
      { id: 1, mfr: 'A', mold: 'One', speed: 5, glide: 5, turn: 0, fade: 1, thr: 'RHBH' },
      { id: 2, mfr: 'B', mold: 'Two', speed: 5, glide: 5, turn: 0, fade: 1, thr: 'RHBH' },
    ]);
    await post([{ id: 1, mfr: 'A', mold: 'One', speed: 5, glide: 5, turn: 0, fade: 1, thr: 'RHBH' }]);

    const got = await page.evaluate(() => fetch('/api/data').then((r) => r.json()));
    expect(got.discs.map((d) => d.mold)).toEqual(['One']);
  });

  test('a POST without a valid CSRF token is rejected', async ({ page }) => {
    await loginFreshUser(page);
    await page.goto('/');
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discs: [], nextId: 100, sortMode: 'speed-desc', arcView: 'RHBH' }),
      });
      return r.status;
    });
    expect(res).toBeGreaterThanOrEqual(400);
    expect(res).toBeLessThan(500);
  });
});

test.describe('multi-user profile switching', () => {
  test('two users have fully independent bags', async ({ page }) => {
    const userA = await loginFreshUser(page);
    await page.goto('/');
    await page.evaluate(async () => {
      const token = document.querySelector('input[name="_csrf"]').value;
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ discs: [{ id: 1, mfr: 'UserA', mold: 'OnlyA', speed: 5, glide: 5, turn: 0, fade: 1, thr: 'RHBH' }], nextId: 100, sortMode: 'speed-desc', arcView: 'RHBH' }),
      });
    });

    await page.goto('/pick');
    const userB = await loginFreshUser(page);
    expect(userB).not.toBe(userA);
    await page.goto('/');
    const bDiscs = await page.evaluate(() => fetch('/api/data').then((r) => r.json()));
    expect(bDiscs.discs.some((d) => d.mold === 'OnlyA')).toBe(false);
  });
});
