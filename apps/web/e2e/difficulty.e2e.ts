import { expect, test } from '@playwright/test';
import { isTouch, loseLastLife, startGame } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Normal is the default; Easy previews 5 lives and is remembered', async ({ page }) => {
  await expect(page.getByRole('radio', { name: 'Normal' })).toBeChecked();
  await expect(page.locator('#hearts')).toHaveText('♥♥♥');
  await page.locator('label').filter({ hasText: 'Easy' }).click();
  await expect(page.locator('#difficulty-hint')).toHaveText("5 lives and slower hazards. Scores don't go on the leaderboard.");
  await expect(page.locator('#hearts')).toHaveText('♥♥♥♥♥');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Easy' })).toBeChecked();
});

test('Easy games are not submitted to the leaderboard', async ({ page }, testInfo) => {
  await page.locator('label').filter({ hasText: 'Easy' }).click();
  await startGame(page, isTouch(testInfo.project.name));
  expect(await page.evaluate(() => window.__chronokid.state.lives)).toBe(5);
  await loseLastLife(page);
  await expect(page.locator('#online')).toHaveText("Easy mode: scores don't go on the leaderboard.");
  await expect(page.locator('#hearts')).toHaveText('♡♡♡♡♡');
});

test('Hard starts with 2 lives', async ({ page }, testInfo) => {
  await page.locator('label').filter({ hasText: 'Hard' }).click();
  await startGame(page, isTouch(testInfo.project.name));
  await expect(page.locator('#hearts')).toHaveText('♥♥');
  await expect(page.locator('#difficulty')).toBeHidden();
});

test('arrow keys change the difficulty instead of moving the hero', async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo.project.name), 'keyboard only');
  await page.getByRole('radio', { name: 'Normal' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Hard' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Hard' })).toBeFocused();
  // Enter from the difficulty choice starts the game.
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.__chronokid.state.difficulty)).toBe('hard');
});
