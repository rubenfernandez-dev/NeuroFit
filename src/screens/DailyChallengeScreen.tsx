import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { difficultyLabel } from '../games/types';
import { ensureDailyToday } from '../shared/storage/daily';
import { getGameById } from '../games/registry';
import Card from '../shared/ui/Card';
import Pill from '../shared/ui/Pill';
import Button from '../shared/ui/Button';
import { useAppTheme } from '../shared/theme/theme';
import { getProfile } from '../shared/storage/profile';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyChallenge'>;

export default function DailyChallengeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const [daily, setDaily] = useState<Awaited<ReturnType<typeof ensureDailyToday>> | null>(null);
  const [streakCurrent, setStreakCurrent] = useState(0);

  const load = useCallback(() => {
    Promise.all([ensureDailyToday(), getProfile()]).then(([dailyState, profile]) => {
      setDaily(dailyState);
      setStreakCurrent(profile.streakCurrent);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!daily) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textMuted }}>Cargando reto...</Text>
      </View>
    );
  }

  const game = getGameById(daily.dailyGameId);

  const startChallenge = () => {
    if (!game) return;
    navigation.navigate(game.routeName, {
      gameId: game.id,
      difficulty: daily.dailyDifficulty,
      isDaily: true,
      dailyDateISO: daily.lastDailyDateISO,
      dailySeed: daily.dailySeed,
    });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Reto de hoy · {daily.lastDailyDateISO}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 8 }]}>Juego: {game?.title ?? daily.dailyGameId}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 4 }]}>Dificultad: {difficultyLabel(daily.dailyDifficulty)}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 8 }]}>🔥 Racha actual: {streakCurrent} días</Text>
        <View style={{ marginTop: 12 }}>
          <Pill label={daily.completed ? 'Completado' : 'Pendiente'} tone={daily.completed ? 'success' : 'default'} />
        </View>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 10 }]}>
          {daily.completed
            ? `✅ Reto completado — Racha: ${streakCurrent}`
            : 'Completa hoy para mantener tu racha'}
        </Text>
      </Card>

      <Button title="Empezar reto" onPress={startChallenge} />
    </ScrollView>
  );
}