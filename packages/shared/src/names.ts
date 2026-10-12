// Leaderboard names are picked, not typed: "Adjective Animal Number" from these hand-checked word lists.
// Any combination is safe to show publicly, so names never need moderation and never reveal real names.

export const NAME_ADJECTIVES = [
  'Brave', 'Bright', 'Bouncy', 'Breezy', 'Bubbly', 'Cheerful', 'Clever', 'Cosmic', 'Curious', 'Daring',
  'Dazzling', 'Eager', 'Fearless', 'Fluffy', 'Friendly', 'Fuzzy', 'Gentle', 'Giggly', 'Golden', 'Happy',
  'Jolly', 'Lucky', 'Magic', 'Merry', 'Mighty', 'Nimble', 'Plucky', 'Quick', 'Rapid', 'Shiny',
  'Silly', 'Snazzy', 'Sparkly', 'Speedy', 'Stellar', 'Sunny', 'Super', 'Swift', 'Turbo', 'Zippy'
] as const;

export const NAME_ANIMALS = [
  'Axolotl', 'Badger', 'Bison', 'Camel', 'Cheetah', 'Dolphin', 'Eagle', 'Falcon', 'Fox', 'Gecko',
  'Hamster', 'Hedgehog', 'Jaguar', 'Kiwi', 'Koala', 'Lemur', 'Llama', 'Lynx', 'Meerkat', 'Moose',
  'Narwhal', 'Octopus', 'Otter', 'Owl', 'Panda', 'Parrot', 'Penguin', 'Puffin', 'Quokka', 'Rabbit',
  'Raccoon', 'Sloth', 'Squirrel', 'Tiger', 'Toucan', 'Turtle', 'Walrus', 'Wombat', 'Yak', 'Zebra'
] as const;

const ADJECTIVES = new Set<string>(NAME_ADJECTIVES);
const ANIMALS = new Set<string>(NAME_ANIMALS);
const NAME_PATTERN = /^([A-Za-z]+) ([A-Za-z]+) ([1-9][0-9]?)$/;

/** True only for names this module could have generated, such as "Brave Otter 27". */
export function isAllowedDisplayName(name: string): boolean {
  const match = NAME_PATTERN.exec(name);
  return match !== null && ADJECTIVES.has(match[1]) && ANIMALS.has(match[2]);
}

/** A random leaderboard name; pass a seeded `random` for repeatable results. */
export function generateDisplayName(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  return `${pick(NAME_ADJECTIVES)} ${pick(NAME_ANIMALS)} ${1 + Math.floor(random() * 99)}`;
}
