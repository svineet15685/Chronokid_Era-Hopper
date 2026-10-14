import { expect, test, type Page } from '@playwright/test';
import { isTouch, loseLastLife, playerX, startGame } from './helpers';

const WORLD_END = 3440;
const ERA_NAMES = ['STONE AGE', 'ANCIENT EGYPT', 'VIKING AGE', 'MEDIEVAL AGE', 'PIRATE AGE', 'WILD WEST', 'HAUNTED MANOR', 'STEAM AGE', 'FUTURE AGE', 'END OF TIME'];

/**
 * Holds a control until the player has moved `distance` pixels (negative means left), then releases it.
 * Waiting on the game state (not a fixed delay) keeps this reliable on slow CI machines.
 */
async function holdUntilMoved(page: Page, press: () => Promise<void>, release: () => Promise<void>, distance: number): Promise<void> {
  const start = await playerX(page);
  await press();
  try {
    const moved = expect.poll(async () => (await playerX(page)) - start, { timeout: 10_000 });
    if (distance > 0) await moved.toBeGreaterThan(distance);
    else await moved.toBeLessThan(distance);
  } finally {
    await release();
  }
}

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

  if (touch) {
    const control = async (name: string) => {
      const box = await page.locator(`[data-control="${name}"]`).boundingBox();
      if (!box) throw new Error(`No ${name} control`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    };
    await expect(page.locator('[data-control="right"]')).toBeInViewport({ ratio: 1 });
    await holdUntilMoved(page, async () => { await control('right'); await page.mouse.down(); }, () => page.mouse.up(), 40);
    await holdUntilMoved(page, async () => { await control('left'); await page.mouse.down(); }, () => page.mouse.up(), -40);
  } else {
    await holdUntilMoved(page, () => page.keyboard.down('ArrowRight'), () => page.keyboard.up('ArrowRight'), 40);
    await holdUntilMoved(page, () => page.keyboard.down('KeyA'), () => page.keyboard.up('KeyA'), -40);
  }
});

test('jump leaves the ground', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  await page.waitForTimeout(200);
  const groundY = await page.evaluate(() => window.__chronokid.state.player.y);
  // Watch every frame inside the page: a jump is airborne for well under a second, which polling can miss.
  const rose = page.evaluate(target => new Promise<boolean>(resolve => {
    const deadline = performance.now() + 5000;
    const tick = () => {
      if (window.__chronokid.state.player.y < target) resolve(true);
      else if (performance.now() > deadline) resolve(false);
      else requestAnimationFrame(tick);
    };
    tick();
  }), groundY - 30);
  if (touch) await page.locator('[data-control="jump"]').tap(); else await page.keyboard.press('Space');
  expect(await rose).toBe(true);
});

test('Enter starts the game from the start screen', async ({ page }, testInfo) => {
  test.skip(isTouch(testInfo.project.name), 'keyboard only');
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
});

test('progresses through all ten eras to victory', async ({ page }, testInfo) => {
  test.slow(); // ten eras of menus and overlays; give busy machines time
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
  // Capture the layer inside the page on the first frame the scare shows; it only lasts about a second.
  const seen = page.evaluate(() => new Promise<{ kind: string; display: string; x: number; y: number; width: number; height: number; vw: number; vh: number }>(resolve => {
    const layer = document.getElementById('scare-layer');
    const tick = () => {
      const { scare } = window.__chronokid.state;
      if (scare && layer && !layer.hidden) {
        const r = layer.getBoundingClientRect();
        resolve({ kind: scare.kind, display: getComputedStyle(layer).display, x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight });
      } else requestAnimationFrame(tick);
    };
    tick();
  }));
  await page.evaluate(() => { const { state } = window.__chronokid; state.player.x = state.scareTriggers[0] + 1; state.player.invulnerable = 5; });
  const shown = await seen;
  expect(shown).toMatchObject({ kind: 'trex', x: 0, y: 0 });
  expect(shown.display).not.toBe('none');
  expect([shown.width, shown.height]).toEqual([shown.vw, shown.vh]);
  const layer = page.locator('#scare-layer');
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

test('passing 2,000 points awards an extra heart', async ({ page }, testInfo) => {
  await startGame(page, isTouch(testInfo.project.name));
  await page.evaluate(() => {
    const { state } = window.__chronokid;
    state.score = 1900;
    state.player.invulnerable = 5;
    const pickup = state.pickups[0];
    state.player.x = pickup.x - 10;
    state.player.y = pickup.y - 10;
  });
  await expect(page.locator('#hearts')).toHaveText('♥♥♥♥');
  await expect(page.locator('#score')).toHaveText('2000');
});

test('sound toggle switches state', async ({ page }) => {
  const sound = page.locator('#sound');
  await sound.click();
  await expect(sound).toHaveText('×');
  await expect(sound).toHaveAttribute('aria-label', 'Turn sound on');
  await sound.click();
  await expect(sound).toHaveText('♫');
});
