import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { __chronokid: { state: import('../src/game/simulation').GameState } }
}

const WORLD_END = 3440;
const isTouch = (projectName: string) => projectName.startsWith('mobile');

async function startGame(page: Page, touch: boolean): Promise<void> {
  const play = page.getByRole('button', { name: 'Play Game' });
  await expect(play).toBeInViewport({ ratio: 1 });
  if (touch) await play.tap(); else await play.click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
}

const playerX = (page: Page) => page.evaluate(() => window.__chronokid.state.player.x);

/** Puts the player just short of the finish flag so the next frames clear the era. */
async function warpToFinish(page: Page): Promise<void> {
  await page.evaluate(end => {
    const { player } = window.__chronokid.state;
    player.x = end - 40;
    player.invulnerable = 5;
  }, WORLD_END);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('start screen shows the title, controls, and a fully visible play button', async ({ page }) => {
  await expect(page.locator('#title')).toHaveText('Chronokid:Era Hopper');
  await expect(page.locator('#instructions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Game' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#era')).toHaveText('STONE AGE');
  await expect(page.locator('#hearts')).toHaveText('♥♥♥');
});

test('player moves right and left', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  const start = await playerX(page);

  if (touch) {
    const hold = async (control: string) => {
      const box = await page.locator(`[data-control="${control}"]`).boundingBox();
      if (!box) throw new Error(`No ${control} control`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();
    };
    await expect(page.locator('[data-control="right"]')).toBeInViewport({ ratio: 1 });
    await hold('right');
    const moved = await playerX(page);
    expect(moved).toBeGreaterThan(start + 40);
    await hold('left');
    expect(await playerX(page)).toBeLessThan(moved - 40);
  } else {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowRight');
    const moved = await playerX(page);
    expect(moved).toBeGreaterThan(start + 40);
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyA');
    expect(await playerX(page)).toBeLessThan(moved - 40);
  }
});

test('jump leaves the ground', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  await page.waitForTimeout(200);
  const groundY = await page.evaluate(() => window.__chronokid.state.player.y);
  if (touch) await page.locator('[data-control="jump"]').tap(); else await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.player.y)).toBeLessThan(groundY - 30);
});

test('Enter starts the game from the start screen', async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo.project.name), 'keyboard only');
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
});

test('progresses through all three eras to victory', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  const advance = page.getByRole('button', { name: 'Advance to Next Era' });

  for (const [completed, next] of [[1, 'MEDIEVAL AGE'], [2, 'FUTURE AGE']] as const) {
    await warpToFinish(page);
    await expect(page.locator('#eyebrow')).toHaveText(`ERA ${completed} COMPLETE`);
    await expect(page.locator('#instructions')).toBeHidden();
    await expect(advance).toBeInViewport({ ratio: 1 });
    if (touch) await advance.tap(); else await advance.click();
    await expect(page.locator('#era')).toHaveText(next);
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  }

  await warpToFinish(page);
  await expect(page.locator('#title')).toHaveText('Timelinesecured!');
  await page.getByRole('button', { name: 'See Final Score' }).click();
  await expect(page.locator('#title')).toHaveText('Time wellhopped.');
  await expect(page.locator('#message')).toContainText('final score:');
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeInViewport({ ratio: 1 });
});

test('game over, then restart with a fresh run', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    const boulder = state.hazards[0];
    state.score = 300;
    state.lives = 1;
    state.player.x = boulder.x;
    state.player.invulnerable = 0;
  });
  // Boulders roll, so keep placing the player on one until the hit lands.
  await expect.poll(async () => {
    await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.hazards[0].x; });
    return page.locator('#title').textContent();
  }).toBe('Gameover.');
  await expect(page.locator('#hearts')).toHaveText('♡♡♡');
  await expect(page.locator('#message')).toContainText('final score: 0300');

  const again = page.getByRole('button', { name: 'Play Again' });
  await expect(again).toBeInViewport({ ratio: 1 });
  if (touch) await again.tap(); else await again.click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#score')).toHaveText('0000');
  await expect(page.locator('#hearts')).toHaveText('♥♥♥');
  await expect(page.locator('#era')).toHaveText('STONE AGE');
});

test('sound toggle switches state', async ({ page }) => {
  const sound = page.locator('#sound');
  await sound.click();
  await expect(sound).toHaveText('×');
  await expect(sound).toHaveAttribute('aria-label', 'Turn sound on');
  await sound.click();
  await expect(sound).toHaveText('♫');
});
