// Shared helpers for the browser tests. They drive the game through the development-only
// window.__chronokid hook, which production builds strip.
import { expect, type Page } from '@playwright/test';

declare global {
  interface Window { __chronokid: { state: import('../src/game/simulation').GameState } }
}

export const isTouch = (projectName: string) => projectName.startsWith('mobile');

/** True when the suite runs against a real API and test database (see playwright.config.ts). */
export const fullStack = Boolean(process.env.TEST_DATABASE_URL);

export async function startGame(page: Page, touch: boolean): Promise<void> {
  const play = page.getByRole('button', { name: 'Play Game' });
  await expect(play).toBeInViewport({ ratio: 1 });
  if (touch) await play.tap(); else await play.click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
}

export const playerX = (page: Page) => page.evaluate(() => window.__chronokid.state.player.x);

/** Keeps putting the player on the first hazard until the last life is gone. */
export async function loseLastLife(page: Page): Promise<void> {
  await page.evaluate(() => { const { state } = window.__chronokid; state.lives = 1; state.player.invulnerable = 0; /* a picked-up shield would absorb the hit */ state.effects.shield = false; });
  await expect.poll(async () => {
    await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.hazards[0].x; });
    return page.locator('#title').textContent();
  }).toBe('Gameover.');
}
