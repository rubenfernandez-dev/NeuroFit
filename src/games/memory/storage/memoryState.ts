import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { MemoryCardModel } from '../logic/deck';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';
import {
  normalizeIndexArray,
  normalizeNonNegativeInt,
  normalizeOptionalBoolean,
  normalizeOptionalSeed,
  normalizeOptionalString,
  normalizeStoredDifficulty,
  parseStoredObject,
} from '../../storage/persistence';

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

function normalizeCards(value: unknown): MemoryCardModel[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (card): card is MemoryCardModel =>
      !!card &&
      typeof card === 'object' &&
      typeof (card as MemoryCardModel).id === 'string' &&
      typeof (card as MemoryCardModel).pairId === 'string' &&
      typeof (card as MemoryCardModel).emoji === 'string',
  );
}

function normalizeMemoryState(parsed: Record<string, unknown>): MemoryState | null {
  const cards = normalizeCards(parsed.cards);
  if (cards.length === 0) return null;

  const matched = normalizeIndexArray(parsed.matched, cards.length);
  const matchedSet = new Set(matched);
  const flipped = normalizeIndexArray(parsed.flipped, cards.length)
    .filter((index) => !matchedSet.has(index))
    .slice(0, 2);

  return {
    cards,
    flipped,
    matched,
    attempts: normalizeNonNegativeInt(parsed.attempts),
    elapsedMs: normalizeNonNegativeInt(parsed.elapsedMs),
    sessionStarted: normalizeOptionalBoolean(parsed.sessionStarted),
    didFinish: normalizeOptionalBoolean(parsed.didFinish),
    difficulty: normalizeStoredDifficulty(parsed.difficulty, 'principiante') as Difficulty,
    isDaily: normalizeOptionalBoolean(parsed.isDaily),
    dailyDateISO: normalizeOptionalString(parsed.dailyDateISO),
    seed: normalizeOptionalSeed(parsed.seed),
  };
}

export async function getMemoryState(): Promise<MemoryState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.memoryState));
  if (!parsed) return null;
  return normalizeMemoryState(parsed);
}

export async function saveMemoryState(state: MemoryState) {
  await setItem(STORAGE_KEYS.memoryState, JSON.stringify(state));
}

export async function clearMemoryState() {
  await deleteItem(STORAGE_KEYS.memoryState);
}