export type CognitiveCategory = 'speed' | 'memory' | 'logic' | 'attention';

const lightCategoryColors: Record<CognitiveCategory, string> = {
  speed: '#F97316',
  memory: '#EC4899',
  logic: '#7C3AED',
  attention: '#3B82F6',
};

const darkCategoryColors: Record<CognitiveCategory, string> = {
  speed: '#FB923C',
  memory: '#F472B6',
  logic: '#A78BFA',
  attention: '#60A5FA',
};

export function getCategoryColors(mode: 'light' | 'dark'): Record<CognitiveCategory, string> {
  return mode === 'dark' ? darkCategoryColors : lightCategoryColors;
}

export const CATEGORY_LABELS: Record<CognitiveCategory, string> = {
  speed: 'Velocidad',
  memory: 'Memoria',
  logic: 'Lógica',
  attention: 'Atención',
};

export const GAME_CATEGORIES: Record<string, CognitiveCategory> = {
  sudoku: 'logic',
  memory: 'memory',
  mentalmath: 'speed',
  speedmatch: 'speed',
  patternmemory: 'memory',
  focusgrid: 'attention',
  numbermatch: 'logic',
};

export const DIFFICULTY_COLORS_LIGHT: Record<string, string> = {
  principiante: '#22C55E',
  avanzado: '#F97316',
  experto: '#EC4899',
  maestro: '#7C3AED',
  gran_maestro: '#EF4444',
};

export const DIFFICULTY_COLORS_DARK: Record<string, string> = {
  principiante: '#4ADE80',
  avanzado: '#FB923C',
  experto: '#F472B6',
  maestro: '#A78BFA',
  gran_maestro: '#F87171',
};

export function getDifficultyColor(difficulty: string, mode: 'light' | 'dark'): string {
  const map = mode === 'dark' ? DIFFICULTY_COLORS_DARK : DIFFICULTY_COLORS_LIGHT;
  return map[difficulty] ?? (mode === 'dark' ? '#94A3B8' : '#64748B');
}
