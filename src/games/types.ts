export type GameId = 'sudoku' | 'memory' | 'mentalmath' | 'speedmatch' | 'patternmemory' | 'focusgrid';
export type Difficulty = 'principiante' | 'avanzado' | 'experto' | 'maestro' | 'gran_maestro';

const LEGACY_DIFFICULTY_MAP: Record<string, Difficulty> = {
  easy: 'principiante',
  medium: 'avanzado',
  hard: 'experto',
  expert: 'maestro',
  beginner: 'principiante',
  advanced: 'avanzado',
  master: 'maestro',
  grandmaster: 'gran_maestro',
  granmaestro: 'gran_maestro',
};

const SUPPORTED_DIFFICULTIES: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

export function normalizeDifficulty(value: unknown, fallback: Difficulty = 'avanzado'): Difficulty {
  if (typeof value !== 'string') return fallback;
  if ((SUPPORTED_DIFFICULTIES as string[]).includes(value)) {
    return value as Difficulty;
  }
  return LEGACY_DIFFICULTY_MAP[value.toLowerCase()] ?? fallback;
}

export function difficultyLabel(difficulty: Difficulty): string {
  return difficulty === 'gran_maestro' ? 'gran maestro' : difficulty;
}

import type { CognitiveCategory } from '../shared/theme/categoryColors';

export type GameDefinition = {
  id: GameId;
  title: string;
  subtitle: string;
  icon: string;
  routeName: 'Sudoku' | 'Memory' | 'MentalMath' | 'SpeedMatch' | 'PatternMemory' | 'FocusGrid';
  difficulties: Difficulty[];
  enabled: boolean;
  category?: CognitiveCategory;
  tags?: string[];
};