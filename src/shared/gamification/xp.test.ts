import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeXp } from '../../core/gamification/economy';
import { grantXp } from './xp';
import type { Profile } from '../storage/profile';

const profileMocks = vi.hoisted(() => {
  let profile: Profile;

  return {
    getProfile: vi.fn(async () => profile),
    updateProfile: vi.fn(async (patch: Partial<Profile>) => {
      profile = { ...profile, ...patch };
      return profile;
    }),
    setProfile(next: Profile) {
      profile = next;
    },
  };
});

vi.mock('../storage/profile', () => ({
  getProfile: profileMocks.getProfile,
  updateProfile: profileMocks.updateProfile,
}));

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
      numbermatch: 'avanzado',
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

describe('XP economy', () => {
  beforeEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    profileMocks.getProfile.mockClear();
    profileMocks.updateProfile.mockClear();
    profileMocks.setProfile(makeProfile());
  });

  it('awards the expected XP for a normal session', () => {
    expect(computeXp({ score: 75, difficulty: 'principiante', isDaily: false })).toBe(35);
  });

  it('awards more XP for a daily session than an equivalent normal session', () => {
    const normalXp = computeXp({ score: 75, difficulty: 'principiante', isDaily: false });
    const dailyXp = computeXp({ score: 75, difficulty: 'principiante', isDaily: true });

    expect(normalXp).toBe(35);
    expect(dailyXp).toBe(40);
    expect(dailyXp).toBeGreaterThan(normalXp);
  });

  it('applies the difficulty multiplier to the final XP', () => {
    const beginnerXp = computeXp({ score: 100, difficulty: 'principiante', isDaily: false });
    const grandMasterXp = computeXp({ score: 100, difficulty: 'gran_maestro', isDaily: false });

    expect(beginnerXp).toBe(40);
    expect(grandMasterXp).toBe(64);
    expect(grandMasterXp).toBeGreaterThan(beginnerXp);
  });

  it('changes XP with performance for the same difficulty', () => {
    const lowPerformanceXp = computeXp({ score: 0, difficulty: 'principiante', isDaily: false });
    const highPerformanceXp = computeXp({ score: 100, difficulty: 'principiante', isDaily: false });

    expect(lowPerformanceXp).toBe(20);
    expect(highPerformanceXp).toBe(40);
    expect(highPerformanceXp).toBeGreaterThan(lowPerformanceXp);
  });

  it('does not depend on streak when granting XP', async () => {
    profileMocks.setProfile(makeProfile({ streakCurrent: 0, xpTotal: 100 }));
    const lowStreakResult = await grantXp({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 75,
      mode: 'daily',
    });

    profileMocks.setProfile(makeProfile({ streakCurrent: 99, xpTotal: 100 }));
    const highStreakResult = await grantXp({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 75,
      mode: 'daily',
    });

    expect(lowStreakResult.earnedXp).toBe(40);
    expect(highStreakResult.earnedXp).toBe(40);
    expect(highStreakResult.earnedXp).toBe(lowStreakResult.earnedXp);
  });
});