import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { isTouch, loseLastLife, startGame } from './helpers';

/** Runs axe (WCAG 2.x A and AA rules) and reports violations readably. */
async function expectNoViolations(page: Page): Promise<void> {
  // Let menu entrance animations finish so colors are measured at their final opacity.
  await page.waitForTimeout(500);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Deterministic leaderboard content, independent of any database.
    await page.route('**/api/leaderboard*', route => route.fulfill({
      json: { entries: [{ rank: 1, displayName: 'Turbo Panda 42', score: 2500, eraReached: 2, outcome: 'gameover', finishedAt: '2026-10-12T10:00:00.000Z' }] }
    }));
    await page.goto('/');
  });

  test('start screen', async ({ page }) => {
    await expectNoViolations(page);
  });

  test('game over screen', async ({ page }, testInfo) => {
    await startGame(page, isTouch(testInfo.project.name));
    await loseLastLife(page);
    await expectNoViolations(page);
  });

  test('keyboard only: start, continue after a game over, and use the leaderboard', async ({ page }, testInfo) => {
    test.skip(isTouch(testInfo.project.name), 'keyboard only');
    await page.keyboard.press('Enter');
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await loseLastLife(page);
    // The main choice gets focus, so Enter continues.
    await expect(page.locator('#action')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#hearts')).toHaveText('♥♥♥');

    await loseLastLife(page);
    await page.locator('#leaderboard-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#board-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#board')).toHaveClass(/hidden/);
    await expect(page.locator('#leaderboard-open')).toBeFocused();
  });

  test('era map screen', async ({ page }) => {
    await page.locator('#eras-open').click();
    await expect(page.locator('.era-card')).toHaveCount(10);
    await expectNoViolations(page);
  });

  test('leaderboard screen', async ({ page }) => {
    await page.locator('#leaderboard-open').click();
    await expect(page.locator('.board-row')).toHaveCount(1);
    await expectNoViolations(page);
  });
});
