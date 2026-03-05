import { Difficulty, GameId } from '../games/types';

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
  mode?: 'normal' | 'daily';
  difficulty?: Difficulty;
  isDaily?: boolean;
  dailySeed?: number;
  dailyDateISO?: string;
  stageIndex?: number;
  gameId?: GameId;
};

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
};