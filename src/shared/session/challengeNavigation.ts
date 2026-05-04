import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../app/routes';
import { Difficulty, GameId } from '../../games/types';
import { getNextChallenge } from './nextChallenge';

export function navigateToNextChallenge(
  navigation: NavigationProp<RootStackParamList>,
  currentGameId: GameId,
  currentDifficulty: Difficulty,
) {
  const next = getNextChallenge(currentGameId, currentDifficulty);
  navigation.navigate(next.routeName, {
    mode: 'normal',
    gameId: next.gameId,
    difficulty: next.difficulty,
  });
  return next;
}
