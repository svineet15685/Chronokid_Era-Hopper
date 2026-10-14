// Sticker book screen and the "new sticker" toast.
import { STICKERS, type StickerBook, type StickerDef } from '../stickers';

/** Fills the sticker book: earned stickers in full colour, the rest greyed out with their goal. */
export function renderStickerBook(grid: HTMLElement, note: HTMLElement, book: StickerBook): void {
  note.textContent = `You have ${book.count} of ${STICKERS.length} stickers. Every sticker shows how to earn it.`;
  grid.replaceChildren(...STICKERS.map(sticker => {
    const earned = book.has(sticker.id);
    const item = document.createElement('li');
    item.className = earned ? 'sticker' : 'sticker sticker-locked';
    item.setAttribute('aria-label', `${sticker.name}: ${earned ? 'earned' : 'not yet'}. ${sticker.goal}`);
    const emoji = document.createElement('span');
    emoji.className = 'sticker-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = sticker.emoji;
    const name = document.createElement('strong');
    name.textContent = sticker.name;
    const goal = document.createElement('span');
    goal.className = 'sticker-goal';
    goal.textContent = sticker.goal;
    item.append(emoji, name, goal);
    return item;
  }));
}

const TOAST_MS = 2600;

/** Shows newly earned stickers one after another in a small banner that never blocks play. */
export function createStickerToast(el: HTMLElement): (stickers: StickerDef[]) => void {
  const queue: StickerDef[] = [];
  let showing = false;
  function next(): void {
    const sticker = queue.shift();
    if (!sticker) {
      showing = false;
      el.textContent = ''; // empty hides it (CSS), while the live region stays in place
      return;
    }
    showing = true;
    el.textContent = `New sticker! ${sticker.emoji} ${sticker.name}`;
    el.classList.remove('pop');
    void el.offsetWidth; // restart the pop-in animation
    el.classList.add('pop');
    setTimeout(next, TOAST_MS);
  }
  return stickers => {
    queue.push(...stickers);
    if (!showing) next();
  };
}
