import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { Question } from '../logic/questions';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export type MentalMathState = {
  questions: Question[];
  currentIndex: number;
  correct: number;
  wrong: number;
  timeLeft: number;
  inputValue: string;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

export async function getMentalMathState(): Promise<MentalMathState | null> {
  const raw = await getItem(STORAGE_KEYS.mentalMathState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MentalMathState;
  } catch {
    return null;
  }
}

export async function saveMentalMathState(state: MentalMathState) {
  await setItem(STORAGE_KEYS.mentalMathState, JSON.stringify(state));
}

export async function clearMentalMathState() {
  await deleteItem(STORAGE_KEYS.mentalMathState);
}