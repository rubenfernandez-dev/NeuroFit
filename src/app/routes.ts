import { Difficulty, GameId } from '../games/types';
import { GAMES } from '../games/registry';

export type GameSessionMode = 'normal' | 'daily';

export type DailyCompletionPayload = {
  kind: 'stage' | 'final';
  stageIndex: number;
  earnedXp: number;
  earnedSp: number;
  result?: {
    durationMs?: number;
    mistakes?: number;
    score?: number;
  };
  progress: {
    completedStages: number;
    totalStages: number;
  };
};

export type DailyChallengeRouteParams = {
  completion?: DailyCompletionPayload;
};

export type GameRouteParams = {
  // Source of truth for session routing.
  mode?: GameSessionMode;
  difficulty?: Difficulty;
  // Legacy compatibility only. When mode is present, mode wins.
  isDaily?: boolean;
  dailySeed?: number;
  dailyDateISO?: string;
  stageIndex?: number;
  gameId?: GameId;
};

export type NormalizedGameRouteParams = Omit<GameRouteParams, 'mode' | 'isDaily'> & {
  mode: GameSessionMode;
  isDaily: boolean;
};

export function normalizeGameRouteParams(params?: GameRouteParams): NormalizedGameRouteParams {
  const explicitMode = params?.mode;
  const legacyIsDaily = params?.isDaily;

  if (__DEV__ && explicitMode && typeof legacyIsDaily === 'boolean' && (explicitMode === 'daily') !== legacyIsDaily) {
    console.warn('[Routes] Inconsistent game route params: mode takes precedence over legacy isDaily.', params);
  }

  const mode = explicitMode ?? (legacyIsDaily ? 'daily' : 'normal');

  return {
    ...(params ?? {}),
    mode,
    isDaily: mode === 'daily',
  };
}

export type RootStackParamList = {
  Home: undefined;
  Games: undefined;
  DailyChallenge: DailyChallengeRouteParams | undefined;
  Leaderboard: undefined;
  Progress: undefined;
  Settings: undefined;
  Sudoku: GameRouteParams | undefined;
  Memory: GameRouteParams | undefined;
  MentalMath: GameRouteParams | undefined;
  SpeedMatch: GameRouteParams | undefined;
  PatternMemory: GameRouteParams | undefined;
  FocusGrid: GameRouteParams | undefined;
  NumberMatch: GameRouteParams | undefined;
};

export type GameStackRouteName = (typeof GAMES)[number]['routeName'];

const GAME_ROUTE_NAMES = new Set<GameStackRouteName>(GAMES.map((game) => game.routeName));

export function isGameRouteName(routeName?: string): routeName is GameStackRouteName {
  if (!routeName) return false;
  return GAME_ROUTE_NAMES.has(routeName as GameStackRouteName);
}