import { describe, expect, it } from 'vitest';
import { generateWeeklyLeaderboard, getUserRankInWeeklyLeaderboard } from './leaderboard';

describe('leaderboard', () => {
  it('respects the requested size and keeps a single user entry', async () => {
    const board = await generateWeeklyLeaderboard({
      seasonId: '2026-W11',
      leagueId: 'bronze',
      userSeasonPoints: 180,
      userName: 'Tú',
      size: 12,
    });

    expect(board).toHaveLength(12);
    expect(board.filter((entry) => entry.isUser)).toHaveLength(1);
    expect(board.map((entry) => entry.rank)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  });

  it('is deterministic for the same season, league and user points', async () => {
    const first = await generateWeeklyLeaderboard({
      seasonId: '2026-W11',
      leagueId: 'diamond',
      userSeasonPoints: 640,
      userName: 'Tú',
      size: 20,
    });
    const second = await generateWeeklyLeaderboard({
      seasonId: '2026-W11',
      leagueId: 'diamond',
      userSeasonPoints: 640,
      userName: 'Tú',
      size: 20,
    });

    expect(second).toEqual(first);
  });

  it('returns the same user rank as the generated board', async () => {
    const board = await generateWeeklyLeaderboard({
      seasonId: '2026-W11',
      leagueId: 'gold',
      userSeasonPoints: 9999,
      userName: 'Tú',
      size: 50,
    });
    const rank = await getUserRankInWeeklyLeaderboard({
      seasonId: '2026-W11',
      leagueId: 'gold',
      userSeasonPoints: 9999,
    });

    expect(rank).toBe(board.find((entry) => entry.isUser)?.rank);
    expect(rank).toBe(1);
  });
});