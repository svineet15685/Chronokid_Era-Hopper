import { expect, test, type Page } from '@playwright/test';
import { isTouch, loseLastLife, startGame } from './helpers';

/** Warps to the finish with the given pickups and hits counted for this era. */
async function clearEra(page: Page, pickups: number, hits: number): Promise<void> {
  await page.evaluate(([p, h]) => {
    const { state } = window.__chronokid;
    state.eraPickups = p;
    state.eraHits = h;
    state.player.invulnerable = 5;
    /* the era boss blocks the flag; count it beaten */ if (state.boss) state.boss.hp = 0;
    state.player.x = 3400;
  }, [pickups, hits]);
  await expect(page.locator('#eyebrow')).toContainText('COMPLETE');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('collecting a power-up gives its effect', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    const powerup = state.powerups[0];
    powerup.kind = 'shield';
    state.player.x = powerup.x - 16;
    state.player.y = powerup.y - 22;
  });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.effects.shield)).toBe(true);
  expect(await page.evaluate(() => window.__chronokid.state.powerups[0].taken)).toBe(true);
});

test('clearing an era shows its stars and what would earn more', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await clearEra(page, 12, 1);
  await expect(page.locator('#star-row')).toHaveAttribute('aria-label', '1 of 3 stars');
  await expect(page.locator('#star-hint')).toHaveText('New best! Next time, collect 20 pickups and take no damage for more stars.');
  await page.getByRole('button', { name: 'Advance to Next Era' }).click();
  await clearEra(page, 25, 0);
  await expect(page.locator('#star-row')).toHaveAttribute('aria-label', '3 of 3 stars');
  await expect(page.locator('#star-row .star-off')).toHaveCount(0);
  // 1 + 3 stars crosses the 3-star mark, so the first outfit unlocks too.
  await expect(page.locator('#star-hint')).toHaveText('New best! Perfect era! New look unlocked: Caveman Bone Helmet! Try it in 👕 Looks.');
});

test('a perfect era gets confetti; a 2-star era does not', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await clearEra(page, 20, 1);
  await expect(page.locator('#star-row')).toHaveAttribute('aria-label', '2 of 3 stars');
  await expect(page.locator('.confetti')).toHaveCount(0);
  await page.getByRole('button', { name: 'Advance to Next Era' }).click();
  await clearEra(page, 25, 0);
  await expect(page.locator('.confetti span')).toHaveCount(60);
  // Decorative only: it must never block the buttons underneath.
  await page.getByRole('button', { name: 'Advance to Next Era' }).click();
  await expect(page.locator('#era')).toHaveText('3/10 VIKING AGE');
});

test('no confetti for players who prefer reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startGame(page, isTouch(testInfo.project.name));
  await clearEra(page, 25, 0);
  await expect(page.locator('#star-row')).toHaveAttribute('aria-label', '3 of 3 stars');
  await expect(page.locator('.confetti')).toHaveCount(0);
});

test('the era map unlocks reached eras and starts practice runs', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await page.locator('#eras-open').click();
  const cards = page.locator('.era-card');
  await expect(cards).toHaveCount(10);
  await expect(cards.nth(0)).toBeEnabled();
  await expect(cards.nth(1)).toBeDisabled();
  await expect(cards.nth(1)).toContainText('🔒');
  await page.getByRole('button', { name: 'Back' }).click();

  await startGame(page, touch);
  await clearEra(page, 20, 2);
  await page.getByRole('button', { name: 'Advance to Next Era' }).click();
  await loseLastLife(page);

  // Progress survives a reload: era 1 shows its 2 stars and era 2 is now open.
  await page.reload();
  await page.locator('#eras-open').click();
  await expect(cards.nth(0)).toHaveAttribute('aria-label', 'Era 1, STONE AGE, 2 of 3 stars');
  await expect(cards.nth(1)).toBeEnabled();
  await expect(cards.nth(2)).toBeDisabled();
  await cards.nth(1).click();
  await expect(page.locator('#map')).toHaveClass(/hidden/);
  await expect(page.locator('#era')).toHaveText('2/10 ANCIENT EGYPT');
  expect(await page.evaluate(() => window.__chronokid.state.mode)).toBe('practice');

  await loseLastLife(page);
  await expect(page.locator('#online')).toHaveText("Practice run: it doesn't go on the leaderboard.");
});

test('bonking the secret block opens a portal to a bonus room, and the era map remembers it', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  const lives = await page.evaluate(() => {
    const { state } = window.__chronokid;
    state.scaresEnabled = false;
    state.player.invulnerable = 5;
    const secret = state.secret;
    if (!secret) throw new Error('no secret');
    // Jump into the block from just below it.
    state.player.x = secret.x;
    state.player.y = secret.y + secret.h + 2;
    state.player.vy = -400;
    return state.lives;
  });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.secret?.state)).not.toBe('hidden');
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.room !== null)).toBe(true);
  expect(await page.evaluate(() => window.__chronokid.state.lives)).toBe(lives + 1);

  // Walk out through the exit portal: back in the level, beside the used block.
  await page.evaluate(() => { window.__chronokid.state.player.x = 840; });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.room)).toBeNull();
  expect(await page.evaluate(() => window.__chronokid.state.secret?.state)).toBe('used');

  await loseLastLife(page);
  await page.reload();
  await page.locator('#eras-open').click();
  await expect(page.locator('.era-card').nth(0)).toHaveAttribute('aria-label', 'Era 1, STONE AGE, 0 of 3 stars, secret room found');
  await expect(page.locator('.era-card').nth(0)).toContainText('🔍');
});

test('finishing an era earns stickers, shown in a banner and kept in the sticker book', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await clearEra(page, 25, 0);
  // Five stickers queue up one after another; which one is showing depends on timing.
  await expect(page.locator('#sticker-toast')).toContainText('New sticker!');

  await page.reload();
  await page.locator('#stickers-open').click();
  await expect(page.locator('#stickers-note')).toHaveText('You have 5 of 18 stickers. Every sticker shows how to earn it.');
  await expect(page.locator('.sticker:not(.sticker-locked)')).toHaveCount(5);
  await expect(page.getByLabel('Berry Picker: earned. Collect every berry in the Stone Age.')).toBeVisible();
  await expect(page.getByLabel(/^Kraken Tamer: not yet\./)).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(page.locator('#stickers')).toHaveClass(/hidden/);
  await expect(page.locator('#stickers-open')).toBeFocused();
});
