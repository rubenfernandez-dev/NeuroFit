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
    category: 'logic',
    tags: ['Popular'],
  },
  {
    id: 'memory',
    title: 'Memoria',
    subtitle: 'Entrena memoria visual y velocidad',
    icon: '🃏',
    routeName: 'Memory',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'memory',
    tags: ['Recomendado'],
  },
  {
    id: 'mentalmath',
    title: 'Cálculo mental',
    subtitle: 'Cálculo mental bajo presión de tiempo',
    icon: '🧮',
    routeName: 'MentalMath',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'speed',
    tags: ['Popular'],
  },
  {
    id: 'speedmatch',
    title: 'Coincidencia rápida',
    subtitle: 'Decide rápido si el símbolo coincide',
    icon: '⚡',
    routeName: 'SpeedMatch',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'speed',
    tags: ['Popular'],
  },
  {
    id: 'patternmemory',
    title: 'Memoria de patrones',
    subtitle: 'Memoriza y repite patrones crecientes',
    icon: '🔷',
    routeName: 'PatternMemory',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'memory',
    tags: ['Nuevo'],
  },
  {
    id: 'focusgrid',
    title: 'Cuadrícula de enfoque',
    subtitle: 'Toca números en orden ascendente',
    icon: '🎯',
    routeName: 'FocusGrid',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'attention',
    tags: ['Reto'],
  },
  {
    id: 'numbermatch',
    title: 'Number Match',
    subtitle: 'Empareja números iguales o que sumen 10',
    icon: '🔢',
    routeName: 'NumberMatch',
    difficulties: ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'],
    enabled: true,
    category: 'logic',
    tags: ['Nuevo'],
  },
];

export function enabledGames() {
  return GAMES.filter((game) => game.enabled);
}

export function getGameById(id: string) {
  return GAMES.find((game) => game.id === id);
}