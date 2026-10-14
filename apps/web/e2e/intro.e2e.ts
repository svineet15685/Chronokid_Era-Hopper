import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// A brand-new visitor: no saved settings, so the story should appear.
test.use({ storageState: { cookies: [], origins: [] } });

test('first launch shows the story, which can be read to the end', async ({ page }) => {
  await page.goto('/');
  const intro = page.locator('#intro');
  await expect(intro).toBeVisible();
  await expect(page.locator('#intro-caption')).toHaveText('Chronokid built a time machine!');
  await expect(page.locator('#intro-next')).toBeFocused();
  for (const caption of ['ZAP! Something went wrong…', 'The pieces flew across 10 ages of history!', 'Hop through every era and fix the timeline!']) {
    await page.locator('#intro-next').click();
    await expect(page.locator('#intro-caption')).toHaveText(caption);
  }
  await expect(page.locator('#intro-next')).toHaveText("Let's go!");
  await page.locator('#intro-next').click();
  await expect(intro).toHaveClass(/hidden/);
  await expect(page.getByRole('button', { name: 'Play Game' })).toBeFocused();
  await page.reload();
  await expect(page.locator('#intro')).toHaveClass(/hidden/);
});

test('the story can be skipped and replayed from the start screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('#intro')).toHaveClass(/hidden/);
  await page.locator('#story-open').click();
  await expect(page.locator('#intro-caption')).toHaveText('Chronokid built a time machine!');
  await page.keyboard.press('Escape');
  await expect(page.locator('#intro')).toHaveClass(/hidden/);
});

test('the story draws its panels and passes accessibility checks', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(400);
  const drawn = await page.evaluate(() => {
    const art = document.getElementById('intro-art') as HTMLCanvasElement;
    const pixel = art.getContext('2d')?.getImageData(240, 60, 1, 1).data;
    return pixel ? pixel[3] : 0;
  });
  expect(drawn).toBe(255);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map(v => v.id)).toEqual([]);
});
