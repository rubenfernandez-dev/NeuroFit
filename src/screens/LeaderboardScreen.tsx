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
import Button from '../shared/ui/Button';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import AnimatedProgressBar from '../shared/ui/AnimatedProgressBar';

export default function LeaderboardScreen() {
  const { theme } = useAppTheme();
  const [seasonId, setSeasonId] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [rank, setRank] = useState(50);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
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
      setLoadError(null);
    } catch (error) {
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'leaderboard.load', kind });
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
  const leagueAccent =
    leagueId === 'bronze'
      ? '#CD7F32'
      : leagueId === 'silver'
        ? '#94A3B8'
        : leagueId === 'gold'
          ? '#F59E0B'
          : leagueId === 'platinum'
            ? '#06B6D4'
            : leagueId === 'diamond'
              ? '#60A5FA'
              : leagueId === 'master'
                ? '#EC4899'
                : leagueId === 'grand_master'
                  ? '#F97316'
                  : '#A78BFA';
  const tierIcon =
    leagueId === 'bronze'
      ? '🥉'
      : leagueId === 'silver'
        ? '🥈'
        : leagueId === 'gold'
          ? '🥇'
          : leagueId === 'platinum'
            ? '🏆'
            : leagueId === 'diamond'
              ? '💎'
              : leagueId === 'master'
                ? '🧠'
                : leagueId === 'grand_master'
                  ? '🔥'
                  : '👑';

  return (
    <Screen>
      {loadError ? (
        <Card variant="warning">
          <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Reintentar" onPress={load} variant="secondary" />
          </View>
        </Card>
      ) : null}

      <Card
        style={{
          borderColor: `${leagueAccent}66`,
          borderWidth: 1,
          backgroundColor: theme.mode === 'dark' ? theme.colors.bg1 : `${leagueAccent}11`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 30 }}>{tierIcon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Liga {league.name}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Temporada {seasonId}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill label={`${seasonPoints} SP`} tone="cyan" />
          <Pill label={`Puesto #${rank}`} tone={rank <= 10 ? 'success' : rank >= 41 ? 'danger' : 'default'} />
        </View>
        <View style={{ marginTop: 12 }}>
          <AnimatedProgressBar value={progress} color={leagueAccent} label={nextLeague ? `Objetivo ${nextLeague.name}` : 'Liga máxima alcanzada'} durationMs={520} />
        </View>
        <View style={{ marginTop: 10 }}>
          <AnimatedProgressBar value={spToTop10 > 0 ? Math.max(0, Math.min(1, seasonPoints / (seasonPoints + spToTop10))) : 1} color={leagueAccent} label={spToTop10 > 0 ? `Te faltan ${spToTop10} SP para Top 10` : '¡Ya estás en zona de ascenso!'} durationMs={520} height={10} />
        </View>
        <Text style={{ color: theme.colors.muted, marginTop: 8 }}>Reinicio de temporada cada lunes</Text>
        <Text style={{ color: theme.colors.muted, marginTop: 4 }}>
          Ranking local simulado en este dispositivo (sin backend global).
        </Text>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: 10 }]}>Ranking local semanal</Text>

        <View style={{ marginBottom: 8 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.green, marginBottom: 6 }]}>Zona de ascenso (Top 10)</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.red }]}>Zona de descenso (Últimos 10)</Text>
        </View>

        {isLoading ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Cargando ranking local...</Text>
        ) : entries.length === 0 ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>No pudimos generar el ranking ahora mismo.</Text>
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
