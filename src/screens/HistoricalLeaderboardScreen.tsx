import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { generateHistoricalLeaderboard, LeaderboardEntry } from '../shared/leaderboard/leaderboard';
import Screen from '../shared/ui/Screen';
import Button from '../shared/ui/Button';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import PlayerEconomyBar from '../shared/economy/PlayerEconomyBar';
import { RootStackParamList } from '../app/routes';

function formatXp(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString()} XP`;
}

export default function HistoricalLeaderboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [neuroCoins, setNeuroCoins] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoggedScroll = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await ensureSeasonCurrent();
      const board = await generateHistoricalLeaderboard({
        userXpTotal: profile.xpTotal,
        userName: 'Tu',
        size: 50,
      });

      setEntries(board);
      setXpTotal(profile.xpTotal);
      setNeuroCoins(profile.seasonPoints);
      setLoadError(null);
    } catch (error) {
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'historical_leaderboard.load', kind });
      setLoadError(formatLoadFailureMessage(kind));
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const userEntry = useMemo(() => entries.find((entry) => entry.isUser) ?? null, [entries]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (hasLoggedScroll.current) return;
          hasLoggedScroll.current = true;
        }}
      >
        <View style={{ marginBottom: 12 }}>
          <PlayerEconomyBar compact xp={xpTotal} neuroCoins={neuroCoins} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Button title="Ranking semanal" variant="secondary" onPress={() => navigation.navigate('Leaderboard')} style={{ flex: 1 }} />
          <Button title="Ranking histórico" variant="primary" onPress={() => {}} style={{ flex: 1 }} />
        </View>

        {loadError ? (
          <Card variant="warning">
            <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
            <View style={{ marginTop: 10 }}>
              <Button title="Reintentar" onPress={load} variant="secondary" />
            </View>
          </Card>
        ) : null}

        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Ranking historico</Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 6 }]}>Basado en XP total acumulada. No se reinicia.</Text>
          {userEntry ? (
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 10 }]}>Tu posicion actual: #{userEntry.rank}</Text>
          ) : null}
        </Card>

        <Card>
          {isLoading ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Cargando ranking...</Text>
          ) : entries.length === 0 ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>No hay jugadores para mostrar.</Text>
          ) : entries.map((entry) => (
            <View
              key={`${entry.name}-${entry.rank}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: entry.isUser ? theme.colors.primarySoft : 'transparent',
                borderWidth: 1,
                borderColor: entry.isUser ? theme.colors.primary : theme.colors.border,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.bg1,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{entry.rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: entry.isUser ? '700' : '600' }}>{entry.name}</Text>
                {entry.isUser ? <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>Tu cuenta</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{formatXp(entry.seasonPoints)}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
