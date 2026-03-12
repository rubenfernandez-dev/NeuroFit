import { createSeededRng, randomInt } from '../utils/random';
import { currentSeasonId, LeagueId } from '../gamification/leagues';

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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeBotName(index: number, rng: () => number): string {
  const offset = randomInt(0, FIRST_NAMES.length - 1, rng);
  const nameIndex = (index + offset) % FIRST_NAMES.length;
  return FIRST_NAMES[nameIndex];
}

type LeagueBandProfile = {
  top1Min: number;
  top1Max: number;
  top10Min: number;
  top10Max: number;
  midMin: number;
  midMax: number;
  bottomMin: number;
  bottomMax: number;
  hardCap: number;
};

const LEAGUE_BANDS: Record<LeagueId, LeagueBandProfile> = {
  bronze: {
    top1Min: 250,
    top1Max: 450,
    top10Min: 150,
    top10Max: 320,
    midMin: 40,
    midMax: 160,
    bottomMin: 0,
    bottomMax: 80,
    hardCap: 470,
  },
  silver: {
    top1Min: 400,
    top1Max: 650,
    top10Min: 250,
    top10Max: 500,
    midMin: 100,
    midMax: 250,
    bottomMin: 0,
    bottomMax: 120,
    hardCap: 680,
  },
  gold: {
    top1Min: 600,
    top1Max: 900,
    top10Min: 350,
    top10Max: 700,
    midMin: 150,
    midMax: 350,
    bottomMin: 0,
    bottomMax: 160,
    hardCap: 940,
  },
  platinum: {
    top1Min: 850,
    top1Max: 1200,
    top10Min: 500,
    top10Max: 950,
    midMin: 200,
    midMax: 450,
    bottomMin: 0,
    bottomMax: 220,
    hardCap: 1260,
  },
  diamond: {
    top1Min: 1100,
    top1Max: 1600,
    top10Min: 650,
    top10Max: 1250,
    midMin: 250,
    midMax: 550,
    bottomMin: 0,
    bottomMax: 300,
    hardCap: 1680,
  },
  master: {
    top1Min: 1350,
    top1Max: 1900,
    top10Min: 800,
    top10Max: 1450,
    midMin: 320,
    midMax: 680,
    bottomMin: 20,
    bottomMax: 360,
    hardCap: 1980,
  },
  grand_master: {
    top1Min: 1600,
    top1Max: 2300,
    top10Min: 950,
    top10Max: 1750,
    midMin: 420,
    midMax: 820,
    bottomMin: 40,
    bottomMax: 460,
    hardCap: 2400,
  },
  legend: {
    top1Min: 1900,
    top1Max: 2800,
    top10Min: 1200,
    top10Max: 2100,
    midMin: 520,
    midMax: 980,
    bottomMin: 80,
    bottomMax: 560,
    hardCap: 2900,
  },
};

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function curveScoreByPercentile(percentileFromTop: number, profile: LeagueBandProfile): number {
  const p = clamp(percentileFromTop, 0, 1);

  const top1Typical = (profile.top1Min + profile.top1Max) / 2;
  const top10Typical = (profile.top10Min + profile.top10Max) / 2;
  const midTypical = (profile.midMin + profile.midMax) / 2;
  const bottomTypical = (profile.bottomMin + profile.bottomMax) / 2;

  if (p <= 0.18) {
    const local = easeOutCubic(p / 0.18);
    return lerp(top1Typical, top10Typical, local);
  }

  if (p <= 0.78) {
    const local = easeOutCubic((p - 0.18) / 0.6);
    return lerp(top10Typical, midTypical, local);
  }

  const local = easeOutCubic((p - 0.78) / 0.22);
  return lerp(midTypical, bottomTypical, local);
}

function varianceByPercentile(percentileFromTop: number): number {
  if (percentileFromTop <= 0.12) return 10;
  if (percentileFromTop <= 0.4) return 14;
  if (percentileFromTop <= 0.78) return 18;
  return 22;
}

function generateBotEntries(params: { seasonId: string; leagueId: LeagueId; size: number }): Array<Omit<LeaderboardEntry, 'rank' | 'isUser'>> {
  const { seasonId, leagueId, size } = params;
  const profile = LEAGUE_BANDS[leagueId];
  const seed = hashString(`${seasonId}:${leagueId}:bots-v2`);
  const rng = createSeededRng(seed);

  const tentative = Array.from({ length: size }).map((_, index) => {
    const percentile = size > 1 ? index / (size - 1) : 0;
    const base = curveScoreByPercentile(percentile, profile);
    const noise = randomInt(-varianceByPercentile(percentile), varianceByPercentile(percentile), rng);
    const raw = Math.round(base + noise);

    return {
      name: makeBotName(index + 1, rng),
      seasonPoints: clamp(raw, profile.bottomMin, profile.hardCap),
    };
  });

  const sorted = tentative.sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
    return a.name.localeCompare(b.name);
  });

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].seasonPoints > sorted[i - 1].seasonPoints) {
      sorted[i].seasonPoints = Math.max(profile.bottomMin, sorted[i - 1].seasonPoints - 1);
    }
  }

  return sorted;
}

export async function generateWeeklyLeaderboard(params: {
  seasonId: string;
  leagueId: LeagueId;
  userSeasonPoints: number;
  userName?: string;
  size?: number;
}): Promise<LeaderboardEntry[]> {
  const { seasonId, leagueId, userSeasonPoints, userName = 'Tú', size } = params;
  const requestedSize = typeof size === 'number' ? Math.floor(size) : 50;
  const safeSize = clamp(requestedSize, 2, 200);
  const botsSize = Math.max(1, safeSize - 1);
  const profile = LEAGUE_BANDS[leagueId];
  const userPoints = Math.max(0, Math.floor(userSeasonPoints));

  const bots = generateBotEntries({ seasonId, leagueId, size: botsSize }).map((entry) => ({
    rank: 0,
    isUser: false,
    ...entry,
  }));

  const ranked = [
    ...bots,
    {
      rank: 0,
      name: userName,
      seasonPoints: clamp(userPoints, 0, profile.hardCap),
      isUser: true,
    },
  ]
    .sort((a, b) => {
      if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
      if (a.isUser !== b.isUser) return a.isUser ? 1 : -1;
      return a.name.localeCompare(b.name);
    })
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

  return board.find((entry) => entry.isUser)?.rank ?? board.length;
}

// TODO: Remove if we stop using this manual debug helper during leaderboard tuning.
export async function debugWeeklyLeaderboardBands(seasonId = currentSeasonId()) {
  const [bronze, diamond] = await Promise.all([
    generateWeeklyLeaderboard({ seasonId, leagueId: 'bronze', userSeasonPoints: 0, userName: 'Tú' }),
    generateWeeklyLeaderboard({ seasonId, leagueId: 'diamond', userSeasonPoints: 0, userName: 'Tú' }),
  ]);

  const slice = (entries: LeaderboardEntry[]) => ({
    top10: entries.slice(0, 10).map((entry) => ({ rank: entry.rank, name: entry.name, sp: entry.seasonPoints })),
    bottom10: entries.slice(-10).map((entry) => ({ rank: entry.rank, name: entry.name, sp: entry.seasonPoints })),
  });

  const result = {
    seasonId,
    bronze: slice(bronze),
    diamond: slice(diamond),
  };

  console.log('[NeuroFit] Weekly leaderboard debug', result);
  return result;
}
