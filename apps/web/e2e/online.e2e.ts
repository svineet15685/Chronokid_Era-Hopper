import { expect, test, type Page } from '@playwright/test';
import { fullStack, isTouch, loseLastLife, startGame } from './helpers';

const NAME = /^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]?$/;

/** Sets the score, then loses the last life to reach the game-over screen. */
async function playAndLose(page: Page, score: number): Promise<void> {
  await page.evaluate(points => { window.__chronokid.state.score = points; }, score);
  await loseLastLife(page);
}

test.describe('with the real API', () => {
  test.skip(!fullStack, 'needs TEST_DATABASE_URL (a *_test database)');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the first game over offers the leaderboard; joining shows your rank and highlights you', async ({ page }, testInfo) => {
    const touch = isTouch(testInfo.project.name);
    await startGame(page, touch);
    await playAndLose(page, 2500);

    const online = page.locator('#online');
    await expect(online).toContainText('Put your score on the leaderboard?');
    const chip = online.locator('.name-chip');
    await expect(chip).toHaveText(NAME);
    await online.getByRole('button', { name: 'Pick another name' }).click();
    await expect(chip).toHaveText(NAME);
    const name = (await chip.textContent()) ?? '';
    await online.getByRole('button', { name: 'Add me' }).click();
    await expect(online).toContainText(`You're on the leaderboard as ${name}! You're #`);

    await page.locator('#leaderboard-open').click();
    const you = page.locator('.board-row.is-you');
    await expect(you).toContainText(`${name} (you)`);
    await expect(you).toContainText('2500');
    await expect(page.locator('#board-join')).toBeEmpty();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('#board')).toHaveClass(/hidden/);
  });

  test('"No thanks" stops the question; later games are still saved', async ({ page }, testInfo) => {
    const touch = isTouch(testInfo.project.name);
    await startGame(page, touch);
    await playAndLose(page, 300);
    const online = page.locator('#online');
    await online.getByRole('button', { name: 'No thanks' }).click();
    await expect(online).toContainText('You can join any time');

    await page.getByRole('button', { name: 'Start Over' }).click();
    await playAndLose(page, 0);
    await expect(online).toHaveText('Saved.');
  });

  test('a listed player sees their rank after games, including after a retry', async ({ page }, testInfo) => {
    const touch = isTouch(testInfo.project.name);
    await startGame(page, touch);
    await playAndLose(page, 1000);
    const online = page.locator('#online');
    await online.getByRole('button', { name: 'Add me' }).click();
    await expect(online).toContainText("You're on the leaderboard as");

    // "Retry Era" continues the same game; the server times it from the original start.
    await page.getByRole('button', { name: 'Retry Era' }).click();
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await playAndLose(page, 1200);
    await expect(online).toContainText(/Saved! You're #\d+ on the leaderboard! New personal best!/);
  });
});

test.describe('when the API is unreachable', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', route => route.abort());
    await page.goto('/');
  });

  test('the game still plays and quietly says scores cannot be saved', async ({ page }, testInfo) => {
    const touch = isTouch(testInfo.project.name);
    await startGame(page, touch);
    await playAndLose(page, 300);
    await expect(page.locator('#online')).toHaveText("Scores can't be saved right now. Keep playing!");
    await page.getByRole('button', { name: 'Retry Era' }).click();
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#hearts')).toHaveText('♥♥♥');
  });

  test('the leaderboard says it is unavailable', async ({ page }) => {
    await page.locator('#leaderboard-open').click();
    await expect(page.locator('#board-status')).toHaveText('Leaderboard unavailable right now.');
    await expect(page.locator('.board-row')).toHaveCount(0);
    await expect(page.locator('#board-join')).toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(page.locator('#board')).toHaveClass(/hidden/);
  });
});

test.describe('leaderboard screen (mocked API)', () => {
  test('lists entries with era progress and offers to join', async ({ page }) => {
    await page.route('**/api/leaderboard*', route => route.fulfill({
      json: {
        entries: [
          { rank: 1, displayName: 'Turbo Panda 42', score: 25000, eraReached: 10, outcome: 'victory', finishedAt: '2026-10-12T10:00:00.000Z' },
          { rank: 2, displayName: 'Brave Otter 7', score: 1200, eraReached: 3, outcome: 'gameover', finishedAt: '2026-10-12T10:05:00.000Z' }
        ]
      }
    }));
    await page.goto('/');
    await page.locator('#leaderboard-open').click();
    const rows = page.locator('.board-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('#1Turbo Panda 42🏁 All eras25000');
    await expect(rows.nth(1)).toContainText('#2Brave Otter 7Era 3/101200');
    await expect(page.locator('#board-join')).toContainText('Want to be on the leaderboard?');
    await expect(page.getByRole('button', { name: 'Back' })).toBeInViewport({ ratio: 1 });
  });

  test('shows a friendly message when there are no scores yet', async ({ page }) => {
    await page.route('**/api/leaderboard*', route => route.fulfill({ json: { entries: [] } }));
    await page.goto('/');
    await page.locator('#leaderboard-open').click();
    await expect(page.locator('#board-status')).toHaveText('No scores yet. Be the first!');
  });
});
