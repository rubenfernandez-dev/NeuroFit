import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { MemoryCardModel } from '../logic/deck';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export type MemoryState = {
  cards: MemoryCardModel[];
  flipped: number[];
  matched: number[];
  attempts: number;
  elapsedMs: number;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

export async function getMemoryState(): Promise<MemoryState | null> {
  const raw = await getItem(STORAGE_KEYS.memoryState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MemoryState;
  } catch {
    return null;
  }
}

export async function saveMemoryState(state: MemoryState) {
  await setItem(STORAGE_KEYS.memoryState, JSON.stringify(state));
}

export async function clearMemoryState() {
  await deleteItem(STORAGE_KEYS.memoryState);
}