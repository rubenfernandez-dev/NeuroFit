import { GameDefinition } from './types';

export const GAMES: GameDefinition[] = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    subtitle: 'Lógica y concentración en cuadrícula 9x9',
    icon: '🧩',
    routeName: 'Sudoku',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
  {
    id: 'memory',
    title: 'Memory',
    subtitle: 'Entrena memoria visual y velocidad',
    icon: '🃏',
    routeName: 'Memory',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
  {
    id: 'mentalmath',
    title: 'Mental Math',
    subtitle: 'Cálculo mental bajo presión de tiempo',
    icon: '➗',
    routeName: 'MentalMath',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
  {
    id: 'speedmatch',
    title: 'Speed Match',
    subtitle: 'Decide rápido si el símbolo coincide',
    icon: '⚡',
    routeName: 'SpeedMatch',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
  {
    id: 'patternmemory',
    title: 'Pattern Memory',
    subtitle: 'Memoriza y repite patrones crecientes',
    icon: '🟦',
    routeName: 'PatternMemory',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
  {
    id: 'focusgrid',
    title: 'Focus Grid',
    subtitle: 'Toca numeros en orden ascendente',
    icon: '🔢',
    routeName: 'FocusGrid',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
  },
];

export function enabledGames() {
  return GAMES.filter((game) => game.enabled);
}

export function getGameById(id: string) {
  return GAMES.find((game) => game.id === id);
}