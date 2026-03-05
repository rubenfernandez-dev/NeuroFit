import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { generateWeeklyLeaderboard, LeaderboardEntry } from '../shared/leaderboard/leaderboard';
import { getLeagueById, getNextLeague } from '../shared/gamification/leagues';
import Screen from '../shared/ui/Screen';
import Pill from '../shared/ui/Pill';
import ProgressBar from '../shared/ui/ProgressBar';

export default function LeaderboardScreen() {
  const { theme } = useAppTheme();
  const [seasonId, setSeasonId] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [rank, setRank] = useState(50);

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
    setRank(board.find((entry) => entry.isUser)?.rank ?? 50);
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

  const top10Cut = entries.find((entry) => entry.rank === 10)?.seasonPoints ?? seasonPoints;
  const spToTop10 = Math.max(0, top10Cut - seasonPoints + 1);

  return (
    <Screen>
      <Card variant="primary">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
          {league.badgeEmoji} Liga {league.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill label={`${seasonPoints} SP`} tone="cyan" />
          <Pill label={`Puesto #${rank}`} tone={rank <= 10 ? 'success' : rank >= 41 ? 'danger' : 'default'} />
        </View>
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={progress} label={nextLeague ? `Objetivo ${nextLeague.name}` : 'Liga máxima alcanzada'} />
        </View>
        <Text style={{ color: theme.colors.muted, marginTop: 8 }}>
          {spToTop10 > 0 ? `Te faltan ${spToTop10} SP para Top 10` : '¡Ya estás en zona de ascenso!'}
        </Text>
        <Text style={{ color: theme.colors.muted, marginTop: 6 }}>Temporada: {seasonId} (reinicio los lunes)</Text>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: 10 }]}>Ranking semanal</Text>

        <View style={{ marginBottom: 8 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.green, marginBottom: 6 }]}>Zona de ascenso (Top 10)</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.red }]}>Zona de descenso (Últimos 10)</Text>
        </View>

        {entries.map((entry) => (
          <View
            key={`${entry.name}-${entry.rank}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 9,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor:
                entry.isUser
                  ? theme.colors.primarySoft
                  : entry.rank <= 10
                    ? `${theme.colors.green}1A`
                    : entry.rank >= 41
                      ? `${theme.colors.red}1A`
                      : 'transparent',
              borderWidth: 1,
              borderColor: entry.isUser
                ? theme.colors.primary
                : entry.rank <= 10
                  ? theme.colors.green
                  : entry.rank >= 41
                    ? theme.colors.red
                    : theme.colors.border,
              marginBottom: 6,
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
              <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{entry.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: entry.isUser ? '700' : '600' }}>
                #{entry.rank} {entry.name}
              </Text>
              {entry.isUser ? <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>Tú</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{entry.seasonPoints} SP</Text>
              {entry.rank <= 10 ? <Pill label="Ascenso" tone="success" /> : null}
              {entry.rank >= 41 ? <Pill label="Descenso" tone="danger" /> : null}
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
