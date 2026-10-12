// DOM for the online parts of the menus: saving status, the leaderboard name picker, and the leaderboard list.
// All text goes through textContent; nothing from the network is parsed as HTML.
import { GAME_RULES, type LeaderboardEntry } from '@chronokid/shared';
import type { FinishResult, OnlineSession } from '../online/session';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void, label?: string): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', onClick);
  return node;
}

export function renderNote(container: HTMLElement, text: string): void {
  container.replaceChildren(el('p', 'online-note', text));
}

const rankText = (rank: number | null) => (rank ? ` You're #${rank} on the leaderboard!` : '');

/** Name picker: a suggested fun name, a dice button for another, and join/decline buttons. */
export function renderJoinPrompt(
  container: HTMLElement,
  session: OnlineSession,
  options: { question: string; onDone?: () => void; allowDecline: boolean }
): void {
  let name = session.player && !session.player.listed ? session.player.displayName : session.suggestName();
  const chip = el('span', 'name-chip', name);
  const reroll = button('🎲', 'icon-button', () => { name = session.suggestName(); chip.textContent = name; }, 'Pick another name');
  const join = button('Add me', 'small-button', async () => {
    join.disabled = true;
    reroll.disabled = true;
    container.replaceChildren(el('p', 'online-note', 'Joining…'));
    const joined = await session.join(name);
    container.replaceChildren(el('p', 'online-note', joined
      ? `You're on the leaderboard as ${name}!${rankText(joined.rank)}`
      : "Couldn't join right now. Try again later."));
    options.onDone?.();
  });
  const actions = el('div', 'online-actions');
  actions.append(join);
  if (options.allowDecline) {
    actions.append(button('No thanks', 'small-button secondary', () => {
      session.decline();
      container.replaceChildren(el('p', 'online-note', 'No problem. You can join any time from 🏆 Leaderboard.'));
    }));
  }
  const pick = el('div', 'name-pick');
  pick.append(chip, reroll);
  container.replaceChildren(el('p', 'online-question', options.question), pick, actions);
}

/** Shows what happened to a finished run's score. */
export function renderFinishResult(container: HTMLElement, result: FinishResult, session: OnlineSession): void {
  if (result.kind === 'unsaved') {
    container.replaceChildren(el('p', 'online-note', "Scores can't be saved right now. Keep playing!"));
  } else if (result.kind === 'rejected') {
    container.replaceChildren(el('p', 'online-note', "This score couldn't be added to the leaderboard."));
  } else if (session.player?.listed) {
    container.replaceChildren(el('p', 'online-note', `Saved!${rankText(result.rank)}${result.personalBest ? ' New personal best!' : ''}`));
  } else if (session.shouldOffer) {
    renderJoinPrompt(container, session, { question: 'Put your score on the leaderboard?', allowDecline: true });
  } else {
    container.replaceChildren(el('p', 'online-note', result.personalBest ? 'Saved. New personal best!' : 'Saved.'));
  }
}

/** Fills the leaderboard list, highlighting the player's own entry. */
export function renderLeaderboard(list: HTMLElement, status: HTMLElement, entries: LeaderboardEntry[] | null, ownName: string | null): void {
  list.replaceChildren();
  if (entries === null) {
    status.textContent = 'Leaderboard unavailable right now.';
    return;
  }
  if (entries.length === 0) {
    status.textContent = 'No scores yet. Be the first!';
    return;
  }
  status.textContent = 'Best run for each time traveler.';
  for (const entry of entries) {
    const row = el('li', entry.displayName === ownName ? 'board-row is-you' : 'board-row');
    const era = entry.outcome === 'victory' ? '🏁 All eras' : `Era ${entry.eraReached}/${GAME_RULES.eraCount}`;
    row.append(
      el('span', 'board-rank', `#${entry.rank}`),
      el('span', 'board-name', entry.displayName === ownName ? `${entry.displayName} (you)` : entry.displayName),
      el('span', 'board-era', era),
      el('span', 'board-score', String(entry.score).padStart(4, '0'))
    );
    list.append(row);
  }
}
