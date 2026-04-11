import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./secureStore', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock('../observability', () => ({
  captureException: vi.fn(),
  logWarning: vi.fn(),
}));

import { deleteItem, getItem, setItem } from './secureStore';
import { getProfile } from './profile';

describe('profile storage normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes season points, league and legacy difficulties safely', async () => {
    vi.mocked(getItem).mockResolvedValue(
      JSON.stringify({
        seasonPoints: -19,
        leagueId: 'invalid_league',
        preferredDifficultyByGame: {
          sudoku: 'easy',
          speedmatch: 'hard',
        },
      }),
    );

    const profile = await getProfile();

    expect(profile.seasonPoints).toBe(0);
    expect(profile.leagueId).toBe('bronze');
    expect(profile.preferredDifficultyByGame.sudoku).toBe('principiante');
    expect(profile.preferredDifficultyByGame.speedmatch).toBe('experto');
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('recovers with defaults on corrupt JSON and deletes bad storage payload', async () => {
    vi.mocked(getItem).mockResolvedValue('{invalid-json');

    const profile = await getProfile();

    expect(profile.xpTotal).toBe(0);
    expect(profile.seasonPoints).toBe(0);
    expect(profile.leagueId).toBe('bronze');
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
  });
});
