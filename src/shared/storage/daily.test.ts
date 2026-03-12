import { describe, expect, it } from 'vitest';
import { migrateLegacyUtcDailyToLocalDay } from './dailyDay';

type DailyState = {
  dateISO: string;
  lastDailyDateISO: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completed: boolean;
  rewardClaimed: boolean;
  dailySeed: number;
  stages: Array<{
    gameId: 'memory' | 'sudoku' | 'speedmatch';
    difficulty: 'principiante' | 'avanzado' | 'experto';
    seed: number;
    completed: boolean;
    startedAtISO?: string;
  }>;
  currentStageIndex: number;
  startedAtISO?: string;
};

function makeDailyState(dateISO: string): DailyState {
  return {
    dateISO,
    lastDailyDateISO: dateISO,
    status: 'in_progress',
    completed: false,
    rewardClaimed: false,
    dailySeed: 123456,
    stages: [
      { gameId: 'memory', difficulty: 'principiante', seed: 1, completed: true, startedAtISO: '2026-03-12T00:10:00.000Z' },
      { gameId: 'sudoku', difficulty: 'avanzado', seed: 2, completed: false },
      { gameId: 'speedmatch', difficulty: 'experto', seed: 3, completed: false },
    ],
    currentStageIndex: 1,
    startedAtISO: '2026-03-12T00:10:00.000Z',
  };
}

describe('daily local-day migration', () => {
  it('migrates an active UTC-keyed daily to the local day key', () => {
    const current = makeDailyState('2026-03-13');
    const migrated = migrateLegacyUtcDailyToLocalDay(current, '2026-03-12', '2026-03-13');

    expect(migrated).not.toBeNull();
    expect(migrated?.dateISO).toBe('2026-03-12');
    expect(migrated?.lastDailyDateISO).toBe('2026-03-12');
    expect(migrated?.dailySeed).toBe(current.dailySeed);
    expect(migrated?.currentStageIndex).toBe(current.currentStageIndex);
  });

  it('does nothing when local and UTC day keys already match', () => {
    const current = makeDailyState('2026-03-12');
    expect(migrateLegacyUtcDailyToLocalDay(current, '2026-03-12', '2026-03-12')).toBeNull();
  });

  it('does nothing when current daily is not keyed to the UTC day being migrated', () => {
    const current = makeDailyState('2026-03-11');
    expect(migrateLegacyUtcDailyToLocalDay(current, '2026-03-12', '2026-03-13')).toBeNull();
  });
});