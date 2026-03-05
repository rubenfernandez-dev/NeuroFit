import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { Difficulty, difficultyLabel, GameId } from '../games/types';
import Screen from '../shared/ui/Screen';
import { getProfile, setPreferredDifficulty } from '../shared/storage/profile';
import DifficultyModal from '../components/DifficultyModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

export default function GamesScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const games = enabledGames();
  const [preferred, setPreferred] = React.useState<Record<GameId, Difficulty>>({
    sudoku: 'avanzado',
    memory: 'principiante',
    mentalmath: 'avanzado',
    speedmatch: 'avanzado',
  });
  const [modalVisible, setModalVisible] = React.useState(false);
  const [selectedGameId, setSelectedGameId] = React.useState<GameId | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<Difficulty>('principiante');

  useFocusEffect(
    React.useCallback(() => {
      getProfile().then((profile) => {
        setPreferred(profile.preferredDifficultyByGame);
      });
    }, []),
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
      isDaily: false,
    });
  };

  return (
    <Screen>
      {games.map((game) => (
        <Pressable
          key={game.id}
          onPress={() => openGamePicker(game.id)}
        >
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 28 }}>{game.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{game.title}</Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>{game.subtitle}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.primary, marginTop: 6 }]}>
                    Dificultad: {difficultyLabel(preferred[game.id])}
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 22 }}>›</Text>
            </View>
          </Card>
        </Pressable>
      ))}

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