export type Level = {
  id: string;
  name: string;
  minXp: number;
  badgeEmoji: string;
};

export const LEVELS: Level[] = [
  { id: 'bronze', name: 'Bronze', minXp: 0, badgeEmoji: '🥉' },
  { id: 'silver', name: 'Silver', minXp: 400, badgeEmoji: '🥈' },
  { id: 'gold', name: 'Gold', minXp: 1000, badgeEmoji: '🥇' },
  { id: 'platinum', name: 'Platinum', minXp: 2200, badgeEmoji: '🏆' },
  { id: 'diamond', name: 'Diamond', minXp: 4000, badgeEmoji: '💎' },
];

export function getLevelByXp(xp: number): Level {
  return [...LEVELS].reverse().find((level) => xp >= level.minXp) ?? LEVELS[0];
}

export function getNextLevel(xp: number): Level | null {
  return LEVELS.find((level) => level.minXp > xp) ?? null;
}