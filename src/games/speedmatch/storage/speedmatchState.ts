import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export type SpeedMatchState = {
  previousSymbol: string;
  currentSymbol: string;
  round: number;
  correct: number;
  mistakes: number;
  score: number;
  timeLeft: number;
  sessionSeed: number;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

export async function getSpeedMatchState(): Promise<SpeedMatchState | null> {
  const raw = await getItem(STORAGE_KEYS.speedMatchState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpeedMatchState;
  } catch {
    return null;
  }
}

export async function saveSpeedMatchState(state: SpeedMatchState) {
  await setItem(STORAGE_KEYS.speedMatchState, JSON.stringify(state));
}

export async function clearSpeedMatchState() {
  await deleteItem(STORAGE_KEYS.speedMatchState);
}
