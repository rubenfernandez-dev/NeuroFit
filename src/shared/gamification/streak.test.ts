import { describe, expect, it } from 'vitest';
import { applyDailyCompletionToStreak, diffDaysISO } from './streak';
import type { Profile } from '../storage/profile';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    themePreference: 'system',
    xpTotal: 0,
    levelId: 'bronze',
    lastActiveISO: '2026-03-12T10:00:00.000Z',
    streakCurrent: 0,
    streakBest: 0,
    seasonId: '2026-W11',
    seasonPoints: 0,
    leagueId: 'bronze',
    bestLeagueId: 'bronze',
    lastSeasonUpdateISO: '2026-03-12T10:00:00.000Z',
    preferredDifficultyByGame: {
      sudoku: 'avanzado',
      memory: 'principiante',
      mentalmath: 'avanzado',
      speedmatch: 'avanzado',
      patternmemory: 'avanzado',
      focusgrid: 'avanzado',
    },
    neuro: {
      speed: 50,
      memory: 50,
      logic: 50,
      attention: 50,
    },
    ...overrides,
  };
}

describe('streak logic', () => {
  it('computes consecutive local-day differences', () => {
    expect(diffDaysISO('2026-03-12', '2026-03-13')).toBe(1);
    expect(diffDaysISO('2026-03-12', '2026-03-15')).toBe(3);
  });

  it('starts streak at 1 on first daily completion', () => {
    const next = applyDailyCompletionToStreak(makeProfile(), '2026-03-12');
    expect(next.streakCurrent).toBe(1);
    expect(next.streakBest).toBe(1);
    expect(next.lastDailyCompletedISO).toBe('2026-03-12');
  });

  it('increments streak on consecutive local days', () => {
    const next = applyDailyCompletionToStreak(
      makeProfile({ streakCurrent: 4, streakBest: 7, lastDailyCompletedISO: '2026-03-11' }),
      '2026-03-12',
    );

    expect(next.streakCurrent).toBe(5);
    expect(next.streakBest).toBe(7);
  });

  it('resets streak after a skipped day', () => {
    const next = applyDailyCompletionToStreak(
      makeProfile({ streakCurrent: 4, streakBest: 7, lastDailyCompletedISO: '2026-03-10' }),
      '2026-03-12',
    );

    expect(next.streakCurrent).toBe(1);
    expect(next.streakBest).toBe(7);
  });
});