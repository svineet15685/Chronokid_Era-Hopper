import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { isTouch, startGame } from './helpers';

/** Opens the grown-ups dialog and answers the multiplication gate correctly. */
async function passGate(page: Page): Promise<void> {
  await page.locator('#grownups-open').click();
  const text = (await page.locator('#gate-question').textContent()) ?? '';
  const [, a, b] = /What is (\d) × (\d)\?/.exec(text) ?? [];
  await page.locator('#gate-choices').getByRole('button', { name: String(Number(a) * Number(b)), exact: true }).click();
  await expect(page.locator('#scare-settings')).toBeVisible();
}

/** Average brightness (0 to 255) of a patch in the game canvas, away from the hero. */
const canvasBrightness = (page: Page) => page.evaluate(() => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return -1;
  const { data } = ctx.getImageData(820, 120, 60, 60);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  return sum / (data.length / 4);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the grown-ups gate guards the scare setting, which is remembered', async ({ page }) => {
  await page.locator('#grownups-open').click();
  await expect(page.locator('#scare-settings')).toBeHidden();
  const text = (await page.locator('#gate-question').textContent()) ?? '';
  const [, a, b] = /What is (\d) × (\d)\?/.exec(text) ?? [];
  const wrong = page.locator('#gate-choices button').filter({ hasNotText: new RegExp(`^${Number(a) * Number(b)}$`) }).first();
  await wrong.click();
  await expect(page.locator('#gate-note')).toHaveText('Not quite. Ask a grown-up to help!');
  await expect(page.locator('#scare-settings')).toBeHidden();
  await page.getByRole('button', { name: 'Done' }).click();

  await passGate(page);
  await expect(page.getByRole('radio', { name: /Silly/ })).toBeChecked();
  await page.getByRole('radio', { name: /Spooky/ }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await passGate(page);
  await expect(page.getByRole('radio', { name: /Spooky/ })).toBeChecked();
});

test('"Off" locks the ghost button and disables scares', async ({ page }) => {
  await passGate(page);
  await page.getByRole('radio', { name: /Off/ }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  const ghost = page.locator('#scares');
  await expect(ghost).toBeDisabled();
  await expect(ghost).toHaveAttribute('aria-label', 'Jump scares are off (set by a grown-up)');
  expect(await page.evaluate(() => window.__chronokid.state.scaresEnabled)).toBe(false);
});

test('spooky mode darkens the level and opens scares with a blackout', async ({ page }, testInfo) => {
  const touch = isTouch(testInfo.project.name);
  await startGame(page, touch);
  await page.waitForTimeout(300);
  const silly = await canvasBrightness(page);

  await page.reload();
  await passGate(page);
  await page.getByRole('radio', { name: /Spooky/ }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await startGame(page, touch);
  await page.waitForTimeout(300);
  const spookyBrightness = await canvasBrightness(page);
  expect(spookyBrightness).toBeLessThan(silly * 0.6);

  // The first frames of a spooky scare are a blackout across the whole screen.
  const center = await page.evaluate(() => new Promise<number[]>(resolve => {
    window.__chronokid.state.scare = { kind: 'trex', t: 0 };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const layer = document.getElementById('scare-layer') as HTMLCanvasElement;
      const ctx = layer.getContext('2d');
      const pixel = ctx?.getImageData(Math.floor(layer.width / 2), Math.floor(layer.height / 2), 1, 1).data;
      resolve(pixel ? [...pixel] : []);
    }));
  }));
  expect(center.slice(0, 3)).toEqual([0, 0, 0]);
});

test('grown-ups dialog passes accessibility checks', async ({ page }) => {
  test.slow(); // two full accessibility scans
  await page.locator('#grownups-open').click();
  await page.waitForTimeout(500);
  const gate = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(gate.violations.map(v => v.id)).toEqual([]);
  await page.getByRole('button', { name: 'Done' }).click();
  await passGate(page);
  const settings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(settings.violations.map(v => v.id)).toEqual([]);
});
