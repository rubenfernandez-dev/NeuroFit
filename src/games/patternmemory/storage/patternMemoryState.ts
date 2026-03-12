import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { TileId } from '../types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export type PatternMemoryState = {
  startedAtISO: string;
  sequence: TileId[];
  round: number;
  maxSequence: number;
  inputIndex: number;
  phase: 'idle' | 'showing' | 'input' | 'finished';
  correctTaps: number;
  totalTaps: number;
  mistakes: number;
  reactionAccumMs: number;
  reactionSamples: number;
  promptAtMs: number;
  timeLeft: number;
  sessionSeed: number;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

export async function getPatternMemoryState(): Promise<PatternMemoryState | null> {
  const raw = await getItem(STORAGE_KEYS.patternMemoryState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PatternMemoryState;
  } catch {
    return null;
  }
}

export async function savePatternMemoryState(state: PatternMemoryState) {
  await setItem(STORAGE_KEYS.patternMemoryState, JSON.stringify(state));
}

export async function clearPatternMemoryState() {
  await deleteItem(STORAGE_KEYS.patternMemoryState);
}
