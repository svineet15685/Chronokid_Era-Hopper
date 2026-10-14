import { expect, test } from '@playwright/test';
import { isTouch, startGame } from './helpers';

/** Seeds saved progress (best stars per era) before the game loads. */
async function seedProgress(page: import('@playwright/test').Page, stars: number[]): Promise<void> {
  await page.evaluate(s => localStorage.setItem('chronokid.progress', JSON.stringify({ reached: 9, stars: s })), stars);
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the wardrobe shows earned and locked looks, and remembers the choice', async ({ page }) => {
  await seedProgress(page, [3, 3, 3, 1, 0, 0, 0, 0, 0, 0]);
  await page.locator('#looks-open').click();
  await expect(page.locator('#looks-note')).toHaveText('You have 10 of 30 ★. Earn stars in each era to unlock new looks.');
  const cards = page.locator('.look-card');
  await expect(cards).toHaveCount(10);
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Viking Horns', exact: true })).toBeEnabled();
  const pirate = page.getByRole('button', { name: 'Pirate Hat and Eyepatch, locked, needs 12 stars' });
  await expect(pirate).toBeDisabled();

  await page.getByRole('button', { name: 'Viking Horns', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Viking Horns', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await page.locator('#looks-open').click();
  await expect(page.getByRole('button', { name: 'Viking Horns', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('clearing an era announces a newly unlocked look', async ({ page }, testInfo) => {
  await seedProgress(page, [0, 2, 2, 2, 2, 0, 0, 0, 0, 0]);
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    state.eraPickups = 25;
    state.eraHits = 0;
    state.player.invulnerable = 5;
    state.player.x = 3400;
  });
  await expect(page.locator('#star-hint')).toContainText('New look unlocked: Viking Horns! Try it in 👕 Looks.');
});
