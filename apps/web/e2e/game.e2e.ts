import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { __chronokid: { state: import('../src/game/simulation').GameState } }
}

const WORLD_END = 3440;
const ERA_NAMES = ['STONE AGE', 'ANCIENT EGYPT', 'VIKING AGE', 'MEDIEVAL AGE', 'PIRATE AGE', 'WILD WEST', 'HAUNTED MANOR', 'STEAM AGE', 'FUTURE AGE', 'END OF TIME'];
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
  await expect(page.locator('#era')).toHaveText('1/10 STONE AGE');
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

test('progresses through all ten eras to victory', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await page.locator('#scares').click(); // keep the run quick; scares have their own test
  await startGame(page, touch);
  const advance = page.getByRole('button', { name: 'Advance to Next Era' });

  for (let completed = 1; completed < ERA_NAMES.length; completed++) {
    await warpToFinish(page);
    await expect(page.locator('#eyebrow')).toHaveText(`ERA ${completed} OF 10 COMPLETE`);
    await expect(page.locator('#instructions')).toBeHidden();
    await expect(advance).toBeInViewport({ ratio: 1 });
    if (touch) await advance.tap(); else await advance.click();
    await expect(page.locator('#era')).toHaveText(`${completed + 1}/10 ${ERA_NAMES[completed]}`);
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  }

  await warpToFinish(page);
  await expect(page.locator('#title')).toHaveText('Timelinesecured!');
  await page.getByRole('button', { name: 'See Final Score' }).click();
  await expect(page.locator('#title')).toHaveText('Time wellhopped.');
  await expect(page.locator('#message')).toContainText('final score:');
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeInViewport({ ratio: 1 });
});

/** Keeps putting the player on the first hazard until the last life is gone. */
async function loseLastLife(page: Page): Promise<void> {
  await page.evaluate(() => { const { state } = window.__chronokid; state.lives = 1; state.player.invulnerable = 0; });
  await expect.poll(async () => {
    await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.hazards[0].x; });
    return page.locator('#title').textContent();
  }).toBe('Gameover.');
}

test('game over offers a retry of the era, or starting over', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  await page.evaluate(() => { window.__chronokid.state.score = 300; });
  await loseLastLife(page);
  await expect(page.locator('#hearts')).toHaveText('♡♡♡');
  await expect(page.locator('#message')).toContainText('Score: 0300');

  const retry = page.getByRole('button', { name: 'Retry Era' });
  await expect(retry).toBeInViewport({ ratio: 1 });
  if (touch) await retry.tap(); else await retry.click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#hearts')).toHaveText('♥♥♥');
  await expect(page.locator('#era')).toHaveText('1/10 STONE AGE');

  await loseLastLife(page);
  const over = page.getByRole('button', { name: 'Start Over' });
  await expect(over).toBeInViewport({ ratio: 1 });
  if (touch) await over.tap(); else await over.click();
  await expect(page.locator('#score')).toHaveText('0000');
  await expect(page.locator('#hearts')).toHaveText('♥♥♥');
});

test('retry after the checkpoint resumes at the checkpoint', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => { const { player } = window.__chronokid.state; player.x = 1730; });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.checkpointX)).toBe(1720);
  await page.evaluate(() => { const { state } = window.__chronokid; state.hazards = state.hazards.filter(h => h.x > 1800); });
  await loseLastLife(page);
  await page.getByRole('button', { name: 'Retry from Checkpoint' }).click();
  expect(await playerX(page)).toBeGreaterThanOrEqual(1700);
});

test('jump scares fill the screen, and the toggle turns them off (remembered after reload)', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.scareTriggers[0] + 1; state.player.invulnerable = 5; });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.scare?.kind ?? null)).toBe('trex');
  const layer = page.locator('#scare-layer');
  await expect(layer).toBeVisible();
  const viewport = page.viewportSize();
  expect(await layer.boundingBox()).toEqual({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
  await expect.poll(() => page.evaluate(() => window.__chronokid.state.scare)).toBeNull();
  await expect(layer).toBeHidden();

  const scares = page.locator('#scares');
  await expect(scares).toHaveAttribute('aria-pressed', 'true');
  await scares.click();
  await expect(scares).toHaveAttribute('aria-pressed', 'false');
  await expect(scares).toHaveAttribute('aria-label', 'Turn jump scares on');
  await page.reload();
  await expect(page.locator('#scares')).toHaveAttribute('aria-pressed', 'false');
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.scareTriggers[0] + 1; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__chronokid.state.scare)).toBeNull();
});

test('sound toggle switches state', async ({ page }) => {
  const sound = page.locator('#sound');
  await sound.click();
  await expect(sound).toHaveText('×');
  await expect(sound).toHaveAttribute('aria-label', 'Turn sound on');
  await sound.click();
  await expect(sound).toHaveText('♫');
});
