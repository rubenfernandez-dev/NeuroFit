import { describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/storage/profile', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

import { applyNeuroScore, computeNeuroDelta } from './neuroscore';
import type { Profile } from '../../shared/storage/profile';

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

describe('neuroscore', () => {
  it('weights daily sessions more strongly than equivalent normal sessions', () => {
    const normal = computeNeuroDelta({
      gameId: 'mentalmath',
      difficulty: 'avanzado',
      won: true,
      score: 90,
      durationMs: 30_000,
      mistakes: 0,
      mode: 'normal',
    });
    const daily = computeNeuroDelta({
      gameId: 'mentalmath',
      difficulty: 'avanzado',
      won: true,
      score: 90,
      durationMs: 30_000,
      mistakes: 0,
      mode: 'daily',
    });

    expect(Math.abs(daily.speedDelta)).toBeGreaterThan(Math.abs(normal.speedDelta));
    expect(Math.abs(daily.logicDelta)).toBeGreaterThan(Math.abs(normal.logicDelta));
  });

  it('keeps unrelated dimensions unchanged for memory games', () => {
    const profile = makeProfile();
    const next = applyNeuroScore(profile, {
      gameId: 'memory',
      difficulty: 'principiante',
      won: true,
      durationMs: 25_000,
      mistakes: 0,
      mode: 'normal',
    });

    expect(next.neuro.memory).not.toBe(profile.neuro.memory);
    expect(next.neuro.attention).toBeGreaterThanOrEqual(profile.neuro.attention);
    expect(next.neuro.speed).toBe(profile.neuro.speed);
    expect(next.neuro.logic).toBe(profile.neuro.logic);
    expect(next.neuro.updatedAtISO).toBeTypeOf('string');
  });

  it('keeps neuro dimensions within 0..100 bounds', () => {
    const highProfile = makeProfile({
      neuro: { speed: 99, memory: 99, logic: 99, attention: 99 },
    });
    const lowProfile = makeProfile({
      neuro: { speed: 1, memory: 1, logic: 1, attention: 1 },
    });

    const boosted = applyNeuroScore(highProfile, {
      gameId: 'speedmatch',
      difficulty: 'gran_maestro',
      won: true,
      score: 100,
      durationMs: 20_000,
      mistakes: 0,
      mode: 'daily',
    });
    const penalized = applyNeuroScore(lowProfile, {
      gameId: 'sudoku',
      difficulty: 'principiante',
      won: false,
      score: 0,
      durationMs: 900_000,
      mistakes: 5,
      mode: 'normal',
    });

    expect(Object.values(boosted.neuro).filter((value) => typeof value === 'number').every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(Object.values(penalized.neuro).filter((value) => typeof value === 'number').every((value) => value >= 0 && value <= 100)).toBe(true);
  });
});