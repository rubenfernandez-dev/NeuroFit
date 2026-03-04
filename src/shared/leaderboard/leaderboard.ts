import { STORAGE_KEYS } from '../storage/keys';
import { getItem, setItem } from '../storage/secureStore';
import { createSeededRng, randomInt, shuffle } from '../utils/random';
import { getLeagueById, getNextLeague, LeagueId } from '../gamification/leagues';

export type LeaderboardEntry = {
  rank: number;
  name: string;
  seasonPoints: number;
  isUser: boolean;
};

const FIRST_NAMES = [
  'Alex',
  'Sofía',
  'Leo',
  'Emma',
  'Nora',
  'Lucas',
  'Maya',
  'Bruno',
  'Iris',
  'Ava',
  'Mateo',
  'Noa',
  'Ethan',
  'Hugo',
  'Milo',
  'Luna',
  'Sara',
  'Izan',
  'Chloe',
  'Teo',
];

const SUFFIX = ['Mind', 'Zen', 'Pulse', 'Logic', 'Brain', 'Focus', 'Spark', 'Nova', 'Flow', 'Core'];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function getOrCreateDeviceSeed(): Promise<string> {
  const existing = await getItem(STORAGE_KEYS.deviceSeed);
  if (existing) return existing;

  const created = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  await setItem(STORAGE_KEYS.deviceSeed, created);
  return created;
}

function makeBotName(index: number, rng: () => number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const second = SUFFIX[randomInt(0, SUFFIX.length - 1, rng)];
  return `${first}${second}${String(index).padStart(2, '0')}`;
}

function parseSeasonId(seasonId: string): { year: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(seasonId);
  if (!match) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}

function isoWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  const diffToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(year, 0, 4 + diffToMonday);
  firstMonday.setHours(0, 0, 0, 0);
  const result = new Date(firstMonday);
  result.setDate(firstMonday.getDate() + (week - 1) * 7);
  return result;
}

function getWeekProgressRatio(seasonId: string, now = new Date()): number {
  const parsed = parseSeasonId(seasonId);
  if (!parsed) return 0;

  const start = isoWeekStartDate(parsed.year, parsed.week);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  if (now <= start) return 0;
  if (now >= end) return 1;

  const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.max(0, Math.min(1, ratio));
}

export async function generateWeeklyLeaderboard(params: {
  seasonId: string;
  leagueId: LeagueId;
  userSeasonPoints: number;
  userName?: string;
  size?: number;
}): Promise<LeaderboardEntry[]> {
  const { seasonId, leagueId, userSeasonPoints, userName = 'Tú' } = params;
  const safeSize = 50;
  const deviceSeed = await getOrCreateDeviceSeed();
  const seed = hashString(`${seasonId}:${leagueId}:${deviceSeed}`);
  const rng = createSeededRng(seed);
  const league = getLeagueById(leagueId);
  const progressRatio = getWeekProgressRatio(seasonId);
  const nextLeague = getNextLeague(leagueId);
  const weeklyTargetBase = Math.max(league.baselineSeasonPoints, Math.floor((nextLeague?.minSeasonPoints ?? league.minSeasonPoints + 900) * 0.7));
  const baseline = Math.floor(weeklyTargetBase * progressRatio);
  const userPoints = Math.max(0, Math.floor(userSeasonPoints));
  const center = Math.max(0, Math.floor(baseline * 0.7 + userPoints * 0.3));

  const entries: LeaderboardEntry[] = [
    {
      rank: 0,
      name: userName,
      seasonPoints: userPoints,
      isUser: true,
    },
  ];

  for (let index = 0; index < safeSize - 1; index += 1) {
    const spread = Math.max(30, Math.floor((baseline + 60) * 0.25));
    const bias = randomInt(-spread, spread, rng);
    const noise = randomInt(-30, 45, rng);
    const trendScale = 2 + Math.floor(progressRatio * 8);
    const trend = Math.floor((index - (safeSize - 1) / 2) * trendScale);
    const botSp = Math.max(0, Math.floor(center + bias - trend + noise));

    entries.push({
      rank: 0,
      name: makeBotName(index + 1, rng),
      seasonPoints: botSp,
      isUser: false,
    });
  }

  const ranked = shuffle(entries, rng)
    .sort((a, b) => b.seasonPoints - a.seasonPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return ranked;
}

export async function getUserRankInWeeklyLeaderboard(params: {
  seasonId: string;
  leagueId: LeagueId;
  userSeasonPoints: number;
}): Promise<number> {
  const board = await generateWeeklyLeaderboard({
    seasonId: params.seasonId,
    leagueId: params.leagueId,
    userSeasonPoints: params.userSeasonPoints,
    size: 50,
  });

  return board.find((entry) => entry.isUser)?.rank ?? 50;
}
