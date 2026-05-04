import { GameId } from '../../games/types';
import { logEvent } from '../../core/telemetry';
import { addNeuroCoins } from '../economy/neuroCoinService';
import { getItem, setItem } from '../storage/secureStore';
import { STORAGE_KEYS } from '../storage/keys';
import { grantFlatXp } from './xp';

const GAMES_PER_CHEST = 5;

type ChestRewardType = 'neurocoins' | 'xp';

type RewardChestState = {
  gamesPlayed: number;
};

export type RewardChestGrant = {
  rewardType: ChestRewardType;
  amount: number;
  cycleGames: number;
};

type RewardChoice = {
  rewardType: ChestRewardType;
  amount: number;
};

const REWARD_POOL: RewardChoice[] = [
  { rewardType: 'neurocoins', amount: 10 },
  { rewardType: 'neurocoins', amount: 20 },
  { rewardType: 'xp', amount: 20 },
];

function clampGamesPlayed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(GAMES_PER_CHEST - 1, Math.floor(value)));
}

async function getRewardChestState(): Promise<RewardChestState> {
  const raw = await getItem(STORAGE_KEYS.rewardChestProgress);
  if (!raw) {
    return { gamesPlayed: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RewardChestState>;
    return {
      gamesPlayed: clampGamesPlayed(parsed.gamesPlayed),
    };
  } catch {
    return { gamesPlayed: 0 };
  }
}

async function saveRewardChestState(state: RewardChestState): Promise<void> {
  await setItem(STORAGE_KEYS.rewardChestProgress, JSON.stringify(state));
}

function pickRewardChoice(): RewardChoice {
  const index = Math.floor(Math.random() * REWARD_POOL.length);
  return REWARD_POOL[Math.max(0, Math.min(REWARD_POOL.length - 1, index))];
}

let rewardChestInFlight: Promise<RewardChestGrant | null> | null = null;

export async function progressRewardChest(gameId: GameId): Promise<RewardChestGrant | null> {
  if (rewardChestInFlight) {
    return rewardChestInFlight;
  }

  rewardChestInFlight = (async () => {
    try {
      const state = await getRewardChestState();
      const nextGamesPlayed = state.gamesPlayed + 1;

      if (nextGamesPlayed < GAMES_PER_CHEST) {
        await saveRewardChestState({ gamesPlayed: nextGamesPlayed });
        return null;
      }

      await saveRewardChestState({ gamesPlayed: 0 });

      const reward = pickRewardChoice();
      if (reward.rewardType === 'neurocoins') {
        await addNeuroCoins(reward.amount, 'reward_gameplay');
      } else {
        await grantFlatXp({ gameId, amount: reward.amount, source: 'manual' });
      }

      const grant: RewardChestGrant = {
        rewardType: reward.rewardType,
        amount: reward.amount,
        cycleGames: GAMES_PER_CHEST,
      };

      logEvent('reward_chest_granted', {
        gameId,
        rewardType: grant.rewardType,
        amount: grant.amount,
        cycleGames: grant.cycleGames,
      });

      return grant;
    } catch {
      return null;
    }
  })();

  try {
    return await rewardChestInFlight;
  } finally {
    rewardChestInFlight = null;
  }
}