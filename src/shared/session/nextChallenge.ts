import { GameStackRouteName } from '../../app/routes';
import { getGameById } from '../../games/registry';
import { Difficulty, GameId } from '../../games/types';

const DIFFICULTY_ORDER: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

const CHALLENGE_ROTATION: GameId[] = [
  'focusgrid',
  'speedmatch',
  'mentalmath',
  'patternmemory',
  'memory',
  'sudoku',
  'numbermatch',
];

export type NextChallenge = {
  gameId: GameId;
  routeName: GameStackRouteName;
  difficulty: Difficulty;
};

function resolveDifficulty(currentDifficulty: Difficulty, supportedDifficulties: Difficulty[]): Difficulty {
  if (supportedDifficulties.includes(currentDifficulty)) {
    return currentDifficulty;
  }

  const currentIndex = DIFFICULTY_ORDER.indexOf(currentDifficulty);
  if (currentIndex >= 0) {
    for (let offset = 1; offset < DIFFICULTY_ORDER.length; offset += 1) {
      const lower = DIFFICULTY_ORDER[currentIndex - offset];
      if (lower && supportedDifficulties.includes(lower)) return lower;

      const upper = DIFFICULTY_ORDER[currentIndex + offset];
      if (upper && supportedDifficulties.includes(upper)) return upper;
    }
  }

  if (supportedDifficulties.includes('principiante')) {
    return 'principiante';
  }

  return supportedDifficulties[0] ?? 'principiante';
}

export function getNextChallenge(currentGameId: GameId, currentDifficulty: Difficulty): NextChallenge {
  const startIndex = CHALLENGE_ROTATION.indexOf(currentGameId);
  const safeStartIndex = startIndex >= 0 ? startIndex : -1;

  for (let step = 1; step <= CHALLENGE_ROTATION.length; step += 1) {
    const rotationIndex = (safeStartIndex + step + CHALLENGE_ROTATION.length) % CHALLENGE_ROTATION.length;
    const nextGameId = CHALLENGE_ROTATION[rotationIndex];
    const nextGame = getGameById(nextGameId);

    if (!nextGame || !nextGame.enabled) {
      continue;
    }

    return {
      gameId: nextGame.id,
      routeName: nextGame.routeName,
      difficulty: resolveDifficulty(currentDifficulty, nextGame.difficulties),
    };
  }

  const fallbackGame = getGameById(currentGameId);
  if (!fallbackGame) {
    const first = getGameById('focusgrid');
    if (!first) {
      return {
        gameId: 'sudoku',
        routeName: 'Sudoku',
        difficulty: 'principiante',
      };
    }

    return {
      gameId: first.id,
      routeName: first.routeName,
      difficulty: resolveDifficulty(currentDifficulty, first.difficulties),
    };
  }

  return {
    gameId: fallbackGame.id,
    routeName: fallbackGame.routeName,
    difficulty: resolveDifficulty(currentDifficulty, fallbackGame.difficulties),
  };
}
