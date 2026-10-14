import { expect, test } from '@playwright/test';
import { isTouch, startGame } from './helpers';

test('the music toggle turns music off and is remembered', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('#music');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toBeInViewport({ ratio: 1 });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Turn music on');
  await page.reload();
  await expect(page.locator('#music')).toHaveAttribute('aria-pressed', 'false');
});

test('music plays through gameplay and era changes without errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await startGame(page, isTouch(testInfo.project.name));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const { state } = window.__chronokid; state.player.invulnerable = 5; /* the era boss blocks the flag; count it beaten */ if (state.boss) state.boss.hp = 0; state.player.x = 3400; });
  await page.getByRole('button', { name: 'Advance to Next Era' }).click();
  await page.evaluate(() => { window.__chronokid.state.lives = 1; });
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
