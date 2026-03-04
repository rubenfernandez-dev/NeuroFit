import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { generateWeeklyLeaderboard, LeaderboardEntry } from '../shared/leaderboard/leaderboard';
import { getLeagueById, getNextLeague } from '../shared/gamification/leagues';

export default function LeaderboardScreen() {
  const { theme } = useAppTheme();
  const [seasonId, setSeasonId] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');

  const load = useCallback(async () => {
    const profile = await ensureSeasonCurrent();
    const board = await generateWeeklyLeaderboard({
      seasonId: profile.seasonId,
      leagueId: profile.leagueId,
      userSeasonPoints: profile.seasonPoints,
      userName: 'Tú',
      size: 50,
    });

    setSeasonId(profile.seasonId);
    setSeasonPoints(profile.seasonPoints);
    setLeagueId(profile.leagueId);
    setEntries(board);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const league = useMemo(() => getLeagueById(leagueId), [leagueId]);
  const nextLeague = useMemo(() => getNextLeague(leagueId), [leagueId]);
  const progress = nextLeague
    ? Math.min(
        1,
        Math.max(0, (seasonPoints - league.minSeasonPoints) / Math.max(1, nextLeague.minSeasonPoints - league.minSeasonPoints)),
      )
    : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
          {league.badgeEmoji} Liga {league.name}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>SP: {seasonPoints}</Text>
        <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.colors.border, marginTop: 10 }}>
          <View style={{ height: '100%', width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary }} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          {nextLeague ? `Objetivo sugerido: ${nextLeague.name} (${nextLeague.minSeasonPoints} SP)` : 'Liga máxima alcanzada'}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>Temporada: {seasonId} (se reinicia los lunes)</Text>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: 8 }]}>Top semanal · 50 jugadores</Text>
        {showRules ? (
          <Text style={{ color: theme.colors.textMuted, marginBottom: 10 }}>
            Cómo funciona: Top 10 ascienden, puestos 11-40 se mantienen, últimos 10 descienden.
          </Text>
        ) : null}
        <View style={{ marginBottom: 10 }}>
          <Text onPress={() => setShowRules((prev) => !prev)} style={{ color: theme.colors.primary, fontWeight: '600' }}>
            {showRules ? 'Ocultar cómo funciona' : 'Cómo funciona'}
          </Text>
        </View>

        {entries.map((entry) => (
          <View
            key={`${entry.name}-${entry.rank}`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 7,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor:
                entry.isUser
                  ? theme.colors.primarySoft
                  : entry.rank <= 10
                    ? theme.colors.card
                    : entry.rank >= 41
                      ? theme.colors.card
                      : 'transparent',
              borderWidth: entry.rank <= 10 || entry.rank >= 41 ? 1 : 0,
              borderColor: entry.rank <= 10 ? theme.colors.success : entry.rank >= 41 ? theme.colors.danger : 'transparent',
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: entry.isUser ? '700' : '500' }}>
              #{entry.rank} {entry.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontWeight: entry.isUser ? '700' : '500' }}>{entry.seasonPoints} SP</Text>
          </View>
        ))}

        <View style={{ marginTop: 10 }}>
          <Text style={{ color: theme.colors.success }}>Zona de ascenso (Top 10)</Text>
          <Text style={{ color: theme.colors.danger, marginTop: 4 }}>Zona de descenso (Últimos 10)</Text>
        </View>
      </Card>
    </ScrollView>
  );
}
