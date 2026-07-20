// Browser-level smoke tests for the JS-dependency-contract items called out in the
// frontend rework plan — things easy to silently break with a CSS/markup change:
// card data-id + drag reordering, filter pills, physics-sim crosswind/dir-hint sync,
// and CSV export/import round-tripping. Not a full regression suite — see CLAUDE.md.
//
// Each run creates its own throwaway user (unique per run) so it never touches real
// bag data. Run with `npm run test:ui` (needs `npm install` once).
const { test, expect } = require('@playwright/test');

async function loginFreshUser(page) {
  const username = `pw-${Date.now()}`;
  await page.goto('/pick');
  const csrf = await page.locator('input[name="_csrf"]').first().inputValue();
  await page.evaluate(async ({ csrf, username }) => {
    const body = new URLSearchParams({ _csrf: csrf, username });
    await fetch('/add_user', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  }, { csrf, username });
  await page.goto('/pick');
  await page.locator(`.user-slot[data-name="${username.toLowerCase()}"] button.user-card`).click();
  await page.waitForLoadState();
}

async function addDisc(page, { mold, mfr = 'Test Mfr', speed = 9, glide = 5, turn = -1, fade = 2 }) {
  await page.click('#addBtn');
  await page.fill('#f-mfr', mfr);
  await page.fill('#f-mold', mold);
  await page.fill('#f-speed', String(speed));
  await page.fill('#f-glide', String(glide));
  await page.fill('#f-turn', String(turn));
  await page.fill('#f-fade', String(fade));
  await page.click('.modal-btns .btn:has-text("Add")');
  await page.waitForTimeout(150);
}

test.describe('bag view (index.html)', () => {
  test.beforeEach(async ({ page }) => {
    await loginFreshUser(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('disc_welcome_v1', '1'));
    await page.reload();
    // New users get a client-side seeded starter disc (SEED in index.html) in addition
    // to whatever's added here — assertions below use counts relative to the page's
    // actual state rather than hardcoding "2", so the seed disc doesn't need special-casing.
    await addDisc(page, { mold: 'Alpha', speed: 12, turn: -1, fade: 3 });
    await addDisc(page, { mold: 'Beta', speed: 4, turn: -3, fade: 1 });
  });

  test('cards render with data-id, drag reorders the DOM', async ({ page }) => {
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(3);
    const idsInitial = await cards.evaluateAll(els => els.map(e => e.dataset.id));
    expect(idsInitial.every(id => id && !Number.isNaN(Number(id)))).toBe(true);

    // sort mode must be 'custom' for drag to be enabled — set via the sort select.
    // Snapshot the baseline order *after* switching, since custom order (raw array
    // order) can differ from whatever sort was active before (e.g. speed-desc).
    await page.selectOption('#sortSel', 'custom');
    await page.waitForTimeout(100);
    const ids = await cards.evaluateAll(els => els.map(e => e.dataset.id));

    const grips = page.locator('.grip');
    await expect(grips).toHaveCount(3);
    const firstBox = await grips.nth(0).boundingBox();
    const secondBox = await grips.nth(1).boundingBox();

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const idsAfter = await page.locator('.card').evaluateAll(els => els.map(e => e.dataset.id));
    expect(idsAfter).not.toEqual(ids);
  });

  test('stability filter pills change visible card count', async ({ page }) => {
    const allCount = await page.locator('.card').count();
    // Alpha (turn -1, fade 3, net 2) is 'overstable'; Beta (turn -3, fade 1, net -2) is
    // 'understable'; the seeded starter disc (turn -2, fade 1, net -1) is also understable —
    // so exactly one card (Alpha) should match the OS filter.
    await page.click('#pills .pill:has-text("OS")');
    await expect(page.locator('.card')).toHaveCount(1);
    await page.click('#pills .pill:has-text("All")');
    await expect(page.locator('.card')).toHaveCount(allCount);
  });

  test('CSV export then import round-trips discs', async ({ page }) => {
    await page.click('#exportBtn');
    const csv = await page.locator('#csvOut').inputValue();
    expect(csv).toContain('Alpha');
    expect(csv).toContain('Beta');
    await page.click('.modal-btns .btn-ghost:has-text("Close")');

    const before = await page.locator('.card').count();

    // Re-importing the exact CSV just exported is an all-duplicates case — import
    // dedupes against the existing bag, so the count must NOT change and the confirm
    // button must stay disabled.
    await page.click('#importBtn');
    await page.fill('#csvIn', csv);
    await page.waitForTimeout(150);
    await expect(page.locator('#importConfirmBtn')).toBeDisabled();
    await expect(page.locator('#importPreview')).toContainText('already in your bag');
    await page.click('.modal-btns .btn-ghost:has-text("Cancel")');
    await expect(page.locator('.card')).toHaveCount(before);

    // A genuinely new row in the same CSV should still import normally.
    const csvWithNewDisc = csv + '\nTest Mfr,Zeta,,,10,4,-2,2,,,\n';
    await page.click('#importBtn');
    await page.fill('#csvIn', csvWithNewDisc);
    await page.waitForTimeout(150);
    await expect(page.locator('#importConfirmBtn')).toBeEnabled();
    await expect(page.locator('#importPreview')).toContainText('duplicate');
    await page.click('#importConfirmBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('.card')).toHaveCount(before + 1);
  });

  test('"in bag" persists across reload and clear-bag resets it', async ({ page }) => {
    const firstCheck = page.locator('.bag-check').first();
    await firstCheck.click();
    await expect(firstCheck).toHaveClass(/checked/);
    await page.waitForTimeout(150); // let persist() finish before reload

    await page.reload();
    await expect(page.locator('.bag-check').first()).toHaveClass(/checked/);

    const clearBtn = page.locator('#clearBagBtn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(clearBtn).toHaveText('Confirm clear?');
    await clearBtn.click();
    await expect(page.locator('.bag-check.checked')).toHaveCount(0);
    await expect(clearBtn).toBeHidden();

    await page.waitForTimeout(150);
    await page.reload();
    await expect(page.locator('.bag-check.checked')).toHaveCount(0);
  });
});

test.describe('Flight Shaper (flightshape.html)', () => {
  test.beforeEach(async ({ page }) => {
    await loginFreshUser(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('disc_welcome_v1', '1'));
    await page.reload();
    await addDisc(page, { mold: 'Gamma', speed: 12, turn: -1, fade: 3 });
    await page.goto('/flightshape');
    await page.locator('#bag-list .lib-item').first().click();
  });

  test('physics-sim toggle reveals crosswind and keeps dir-hints in sync', async ({ page }) => {
    await expect(page.locator('#dirHints span')).toHaveCount(5);
    await expect(page.locator('#crosswind-col')).toBeHidden();

    await page.check('#physicsSimToggle');
    await page.waitForTimeout(150);
    await expect(page.locator('#crosswind-col')).toBeVisible();
    await expect(page.locator('#dirHints span')).toHaveCount(6);

    await page.uncheck('#physicsSimToggle');
    await page.waitForTimeout(150);
    await expect(page.locator('#crosswind-col')).toBeHidden();
    await expect(page.locator('#dirHints span')).toHaveCount(5);
  });
});
