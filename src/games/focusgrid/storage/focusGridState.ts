import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export type FocusGridState = {
  startedAtISO: string;
  numbers: number[];
  nextExpected: number;
  mistakes: number;
  correctTaps: number;
  totalTaps: number;
  timeLeft: number;
  sessionSeed: number;
  started: boolean;
  didFinish: boolean;
  phase: 'idle' | 'playing' | 'finished';
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

export async function getFocusGridState(): Promise<FocusGridState | null> {
  const raw = await getItem(STORAGE_KEYS.focusGridState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FocusGridState;
  } catch {
    return null;
  }
}

export async function saveFocusGridState(state: FocusGridState) {
  await setItem(STORAGE_KEYS.focusGridState, JSON.stringify(state));
}

export async function clearFocusGridState() {
  await deleteItem(STORAGE_KEYS.focusGridState);
}
