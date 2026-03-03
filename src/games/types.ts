export type GameId = 'sudoku' | 'memory' | 'mentalmath';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type GameDefinition = {
  id: GameId;
  title: string;
  subtitle: string;
  icon: string;
  routeName: 'Sudoku' | 'Memory' | 'MentalMath';
  difficulties: Difficulty[];
  enabled: boolean;
};