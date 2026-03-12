import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { Question } from '../logic/questions';
import { generateQuestions } from '../logic/questions';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';
import {
  normalizeNonNegativeInt,
  normalizeOptionalBoolean,
  normalizeOptionalSeed,
  normalizeOptionalString,
  normalizeStoredDifficulty,
  parseStoredObject,
} from '../../storage/persistence';

export type MentalMathState = {
  questions: Question[];
  currentIndex: number;
  correct: number;
  wrong: number;
  timeLeft: number;
  inputValue: string;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

function normalizeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (question): question is Question =>
      !!question &&
      typeof question === 'object' &&
      typeof (question as Question).text === 'string' &&
      typeof (question as Question).answer === 'number' &&
      Number.isFinite((question as Question).answer),
  );
}

function normalizeMentalMathState(parsed: Record<string, unknown>): MentalMathState {
  const difficulty = normalizeStoredDifficulty(parsed.difficulty, 'avanzado') as Difficulty;
  const seed = normalizeOptionalSeed(parsed.seed);
  const questions = normalizeQuestions(parsed.questions);
  const normalizedQuestions = questions.length > 0 ? questions : generateQuestions(difficulty, 40, seed);

  return {
    questions: normalizedQuestions,
    currentIndex: normalizeNonNegativeInt(parsed.currentIndex, 0, normalizedQuestions.length - 1),
    correct: normalizeNonNegativeInt(parsed.correct),
    wrong: normalizeNonNegativeInt(parsed.wrong),
    timeLeft: normalizeNonNegativeInt(parsed.timeLeft, 60, 60),
    inputValue: typeof parsed.inputValue === 'string' ? parsed.inputValue : '',
    sessionStarted: normalizeOptionalBoolean(parsed.sessionStarted),
    didFinish: normalizeOptionalBoolean(parsed.didFinish),
    difficulty,
    isDaily: normalizeOptionalBoolean(parsed.isDaily),
    dailyDateISO: normalizeOptionalString(parsed.dailyDateISO),
    seed,
  };
}

export async function getMentalMathState(): Promise<MentalMathState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.mentalMathState));
  if (!parsed) return null;
  return normalizeMentalMathState(parsed);
}

export async function saveMentalMathState(state: MentalMathState) {
  await setItem(STORAGE_KEYS.mentalMathState, JSON.stringify(state));
}

export async function clearMentalMathState() {
  await deleteItem(STORAGE_KEYS.mentalMathState);
}