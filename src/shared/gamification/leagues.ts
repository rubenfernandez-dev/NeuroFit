export type LeagueId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'master'
  | 'grand_master'
  | 'legend';

export type League = {
  id: LeagueId;
  name: string;
  minSeasonPoints: number;
  baselineSeasonPoints: number;
  badgeEmoji: string;
};

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Bronce', minSeasonPoints: 0, baselineSeasonPoints: 0, badgeEmoji: '🥉' },
  { id: 'silver', name: 'Plata', minSeasonPoints: 1500, baselineSeasonPoints: 1200, badgeEmoji: '🥈' },
  { id: 'gold', name: 'Oro', minSeasonPoints: 4000, baselineSeasonPoints: 2600, badgeEmoji: '🥇' },
  { id: 'platinum', name: 'Platino', minSeasonPoints: 8000, baselineSeasonPoints: 4500, badgeEmoji: '🏆' },
  { id: 'diamond', name: 'Diamante', minSeasonPoints: 15000, baselineSeasonPoints: 7000, badgeEmoji: '💎' },
  { id: 'master', name: 'Maestro', minSeasonPoints: 25000, baselineSeasonPoints: 10000, badgeEmoji: '🧠' },
  { id: 'grand_master', name: 'Gran Maestro', minSeasonPoints: 40000, baselineSeasonPoints: 13500, badgeEmoji: '🔥' },
  { id: 'legend', name: 'Leyenda', minSeasonPoints: 70000, baselineSeasonPoints: 18000, badgeEmoji: '👑' },
];

export function getLeagueBySeasonPoints(seasonPoints: number): League {
  const points = Math.max(0, seasonPoints);
  return [...LEAGUES].reverse().find((league) => points >= league.minSeasonPoints) ?? LEAGUES[0];
}

export function getLeagueById(leagueId: LeagueId): League {
  return LEAGUES.find((league) => league.id === leagueId) ?? LEAGUES[0];
}

export function getNextLeague(leagueId: LeagueId): League | null {
  const index = LEAGUES.findIndex((league) => league.id === leagueId);
  if (index < 0 || index >= LEAGUES.length - 1) return null;
  return LEAGUES[index + 1];
}

export function getPrevLeague(leagueId: LeagueId): League | null {
  const index = LEAGUES.findIndex((league) => league.id === leagueId);
  if (index <= 0) return null;
  return LEAGUES[index - 1];
}

export function getLeagueRank(leagueId: LeagueId): number {
  return Math.max(0, LEAGUES.findIndex((league) => league.id === leagueId));
}

export function getLeagueNameEs(leagueId: LeagueId): string {
  return getLeagueById(leagueId).name;
}

function startOfIsoWeek(date: Date): Date {
  const local = new Date(date);
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + diff);
  local.setHours(0, 0, 0, 0);
  return local;
}

function isoWeekYear(date: Date): { year: number; week: number } {
  const weekStart = startOfIsoWeek(date);
  const thursday = new Date(weekStart);
  thursday.setDate(weekStart.getDate() + 3);
  const year = thursday.getFullYear();

  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = startOfIsoWeek(jan4);
  const diffDays = Math.floor((weekStart.getTime() - firstWeekStart.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.floor(diffDays / 7) + 1;

  return { year, week };
}

export function currentSeasonId(date = new Date()): string {
  const { year, week } = isoWeekYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
