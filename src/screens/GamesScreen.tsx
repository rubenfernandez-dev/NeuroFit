import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { Difficulty, GameId } from '../games/types';
import Screen from '../shared/ui/Screen';
import { getProfile, setPreferredDifficulty } from '../shared/storage/profile';
import DifficultyModal from '../components/DifficultyModal';
import Button from '../shared/ui/Button';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import { GAME_CATEGORIES } from '../shared/theme/categoryColors';
import GameListItem from '../shared/ui/GameListItem';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

export default function GamesScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const games = enabledGames();
  const [preferred, setPreferred] = React.useState<Record<GameId, Difficulty>>({
    sudoku: 'avanzado',
    memory: 'principiante',
    mentalmath: 'avanzado',
    speedmatch: 'avanzado',
    patternmemory: 'avanzado',
    focusgrid: 'avanzado',
  });
  const [modalVisible, setModalVisible] = React.useState(false);
  const [selectedGameId, setSelectedGameId] = React.useState<GameId | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<Difficulty>('principiante');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      const load = async () => {
        try {
          const profile = await getProfile();
          setPreferred(profile.preferredDifficultyByGame);
          setLoadError(null);
        } catch (error) {
          const kind = classifyDataFailure(error);
          captureException(error, { area: 'games.load', kind });
          setLoadError(formatLoadFailureMessage(kind));
        }
      };

      load();
    }, [reloadNonce]),
  );

  const selectedGame = selectedGameId ? games.find((game) => game.id === selectedGameId) ?? null : null;
  const modalDifficulties = selectedGame?.difficulties ?? [];

  const openGamePicker = (gameId: GameId) => {
    const game = games.find((entry) => entry.id === gameId);
    if (!game) return;
    const fallback = game.difficulties.includes('principiante') ? 'principiante' : game.difficulties[0];
    const preselected = preferred[gameId] && game.difficulties.includes(preferred[gameId]) ? preferred[gameId] : fallback;
    setSelectedGameId(gameId);
    setSelectedDifficulty(preselected);
    setModalVisible(true);
  };

  const cancelPicker = () => {
    setModalVisible(false);
    setSelectedGameId(null);
  };

  const confirmPicker = async (difficulty: Difficulty) => {
    if (!selectedGame) {
      cancelPicker();
      return;
    }

    const profile = await setPreferredDifficulty(selectedGame.id, difficulty);
    setPreferred(profile.preferredDifficultyByGame);
    cancelPicker();

    navigation.navigate(selectedGame.routeName, {
      gameId: selectedGame.id,
      difficulty,
      mode: 'normal',
    });
  };

  return (
    <Screen>
      {loadError ? (
        <Card variant="warning">
          <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Reintentar carga" onPress={() => setReloadNonce((current) => current + 1)} variant="secondary" />
          </View>
        </Card>
      ) : null}

      {games.map((game) => {
        const catKey = game.category ?? GAME_CATEGORIES[game.id];
        const category = catKey ?? 'logic';

        return (
          <GameListItem
            key={game.id}
            title={game.title}
            subtitle={game.subtitle}
            icon={game.icon}
            category={category}
            difficulty={preferred[game.id]}
            tags={game.tags}
            onPress={() => openGamePicker(game.id)}
          />
        );
      })}

      <DifficultyModal
        visible={modalVisible}
        gameId={selectedGameId}
        difficulties={modalDifficulties}
        initialValue={selectedDifficulty}
        onCancel={cancelPicker}
        onConfirm={confirmPicker}
      />
    </Screen>
  );
}
