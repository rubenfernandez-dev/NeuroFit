export type Level = {
  id: string;
  name: string;
  minXp: number;
  badgeEmoji: string;
};

export const LEVELS: Level[] = [
  { id: 'bronze', name: 'Bronze', minXp: 0, badgeEmoji: '🥉' },
  { id: 'silver', name: 'Silver', minXp: 2000, badgeEmoji: '🥈' },
  { id: 'gold', name: 'Gold', minXp: 6000, badgeEmoji: '🥇' },
  { id: 'platinum', name: 'Platinum', minXp: 14000, badgeEmoji: '🏆' },
  { id: 'diamond', name: 'Diamond', minXp: 30000, badgeEmoji: '💎' },
  { id: 'master', name: 'Master', minXp: 55000, badgeEmoji: '🧠' },
  { id: 'grandmaster', name: 'Grandmaster', minXp: 90000, badgeEmoji: '🔥' },
  { id: 'legend', name: 'Legend', minXp: 140000, badgeEmoji: '👑' },
];

export function getLevelByXp(xp: number): Level {
  return [...LEVELS].reverse().find((level) => xp >= level.minXp) ?? LEVELS[0];
}

export function getNextLevel(xp: number): Level | null {
  return LEVELS.find((level) => level.minXp > xp) ?? null;
}