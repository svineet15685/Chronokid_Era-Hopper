import { expect, test, type Page } from '@playwright/test';
import { isTouch, startGame } from './helpers';

/** Waits until the boss is tired, then drops the player onto its lowered head. */
async function stompWhenTired(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__chronokid.state.boss?.phase === 'tired', null, { timeout: 20_000 });
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    const boss = state.boss;
    if (!boss) return;
    state.player.x = boss.x - 40;
    state.player.y = 360;
    state.player.vy = 300;
    state.player.invulnerable = 5;
  });
  await page.waitForFunction(() => window.__chronokid.state.boss?.phase !== 'tired');
}

test('the Stone Age T-rex guards the flag until it is bonked three times', async ({ page }, testInfo) => {
  test.slow(); // a full boss fight
  await page.goto('/');
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    state.scaresEnabled = false;
    state.lives = 99;
    state.player.x = 2720;
  });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.boss?.phase)).not.toBe('waiting');

  // The flag is locked: trying to walk past the boss does not clear the era.
  await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = 3420; state.player.invulnerable = 5; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__chronokid.state.phase)).toBe('playing');

  for (let hit = 0; hit < 3; hit++) await stompWhenTired(page);
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.boss?.phase)).toBe('leaving');

  await page.evaluate(() => { const { state } = window.__chronokid; state.player.invulnerable = 5; state.player.x = 3400; });
  await expect(page.locator('#eyebrow')).toHaveText('ERA 1 OF 10 COMPLETE');
});
