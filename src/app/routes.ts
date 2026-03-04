import { Difficulty, GameId } from '../games/types';

export type GameRouteParams = {
  difficulty?: Difficulty;
  isDaily?: boolean;
  dailySeed?: number;
  dailyDateISO?: string;
  gameId?: GameId;
};

export type RootStackParamList = {
  Home: undefined;
  Games: undefined;
  DailyChallenge: undefined;
  Leaderboard: undefined;
  Progress: undefined;
  Settings: undefined;
  Sudoku: GameRouteParams | undefined;
  Memory: GameRouteParams | undefined;
  MentalMath: GameRouteParams | undefined;
};