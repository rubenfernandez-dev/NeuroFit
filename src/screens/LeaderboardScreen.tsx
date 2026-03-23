import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
import { logEvent } from '../core/telemetry';

type LeagueStatus = 'ascenso' | 'media' | 'descenso' | 'sin_datos';

function getPromotionCutoff(): number {
  return 10;
}

function getDemotionCutoff(totalPlayers: number): number {
  if (totalPlayers <= 0) return 0;
  return Math.max(1, totalPlayers - 9);
}

function getLeagueStatus(position?: number, totalPlayers = 0): LeagueStatus {
  if (!position || totalPlayers <= 0) return 'sin_datos';
  if (position <= getPromotionCutoff()) return 'ascenso';
  if (position >= getDemotionCutoff(totalPlayers)) return 'descenso';
  return 'media';
}

function getUserDeltaToNext(players: LeaderboardEntry[], userPosition?: number): number | null {
  if (!userPosition || userPosition <= 1) return null;
  const current = players.find((entry) => entry.rank === userPosition);
  const nextAbove = players.find((entry) => entry.rank === userPosition - 1);
  if (!current || !nextAbove) return null;
  return Math.max(0, nextAbove.seasonPoints - current.seasonPoints + 1);
}

function getTimeUntilReset(now = new Date()): { days: number; hours: number; label: string } {
  const target = new Date(now);
  const day = now.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  target.setDate(now.getDate() + daysUntilMonday);
  target.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const hoursTotal = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  return { days, hours, label: `Reset en ${days}d ${hours}h` };
}

async function generateMockLeaderboard(userSP: number, leagueId: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend', seasonId: string, userName = 'Tu'): Promise<LeaderboardEntry[]> {
  return generateWeeklyLeaderboard({
    seasonId,
    leagueId,
    userSeasonPoints: userSP,
    userName,
    size: 50,
  });
}

export default function LeaderboardScreen() {
  const { theme } = useAppTheme();
  const [seasonId, setSeasonId] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [rank, setRank] = useState(50);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoggedScroll = useRef(false);
  const previousRankRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await ensureSeasonCurrent();
      const board = await generateMockLeaderboard(profile.seasonPoints, profile.leagueId, profile.seasonId, 'Tu');

      setSeasonId(profile.seasonId);
      setSeasonPoints(profile.seasonPoints);
      setLeagueId(profile.leagueId);
      setEntries(board);
      const nextRank = board.find((entry) => entry.isUser)?.rank ?? 50;
      if (previousRankRef.current !== null && previousRankRef.current !== nextRank) {
        logEvent('league_position_changed', {
          seasonId: profile.seasonId,
          previousRank: previousRankRef.current,
          rank: nextRank,
          seasonPoints: profile.seasonPoints,
          leagueId: profile.leagueId,
        });
      }
      previousRankRef.current = nextRank;
      setRank(nextRank);
      setLoadError(null);
      logEvent('league_screen_viewed', {
        seasonId: profile.seasonId,
        leagueId: profile.leagueId,
        rank: nextRank,
        seasonPoints: profile.seasonPoints,
      });
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

  const userEntry = useMemo(() => entries.find((entry) => entry.isUser) ?? null, [entries]);
  const top10Cut = entries.find((entry) => entry.rank === getPromotionCutoff())?.seasonPoints ?? seasonPoints;
  const spToTop10 = Math.max(0, top10Cut - seasonPoints + 1);
  const deltaToNext = getUserDeltaToNext(entries, userEntry?.rank);
  const demotionCutoff = getDemotionCutoff(entries.length);
  const demotionEntry = entries.find((entry) => entry.rank === demotionCutoff);
  const spOverDemotion = demotionEntry ? seasonPoints - demotionEntry.seasonPoints : null;
  const leagueStatus = getLeagueStatus(userEntry?.rank, entries.length);
  const resetClock = getTimeUntilReset();

  const leagueStatusCopy =
    leagueStatus === 'ascenso'
      ? 'Estas en zona de ascenso'
      : leagueStatus === 'descenso'
        ? 'Estas en zona de descenso'
        : leagueStatus === 'media'
          ? 'Estas en zona media'
          : 'Aun sin posicion definida';

  const statusTone: 'success' | 'danger' | 'default' =
    leagueStatus === 'ascenso' ? 'success' : leagueStatus === 'descenso' ? 'danger' : 'default';

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (hasLoggedScroll.current) return;
          hasLoggedScroll.current = true;
          logEvent('leaderboard_scrolled', { seasonId, leagueId });
        }}
      >
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
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Temporada {seasonId || '-'}</Text>
            </View>
            <Pill label={`${seasonPoints} SP`} tone="cyan" />
          </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Pill label={`Puesto #${rank}`} tone={statusTone} />
                  <Pill label={leagueStatusCopy} tone={statusTone} />
                  <Pill label={resetClock.label} tone="default" />
                </View>

                <View style={{ marginTop: 12 }}>
                  <AnimatedProgressBar
                    value={progress}
                    color={leagueAccent}
                    label={nextLeague ? `Objetivo: ${nextLeague.name}` : 'Liga maxima alcanzada'}
                    durationMs={520}
                  />
                </View>
                <View style={{ marginTop: 10 }}>
                  <AnimatedProgressBar
                    value={spToTop10 > 0 ? Math.max(0, Math.min(1, seasonPoints / (seasonPoints + spToTop10))) : 1}
                    color={leagueAccent}
                    label={spToTop10 > 0 ? `Te faltan ${spToTop10} SP para Top 10` : 'Ya estas en zona de ascenso'}
                    durationMs={520}
                    height={10}
                  />
                </View>

                <View style={{ marginTop: 10, gap: 4 }}>
                  <Text style={{ color: theme.colors.muted }}>
                    {spOverDemotion !== null
                      ? spOverDemotion >= 0
                        ? `Margen sobre descenso: +${spOverDemotion} SP`
                        : `Estas a ${Math.abs(spOverDemotion)} SP de salir de descenso`
                      : 'Sin referencia de descenso disponible'}
                  </Text>
                  <Text style={{ color: theme.colors.muted }}>
                    Reinicio semanal: cada lunes 00:00 (hora local).
                  </Text>
                </View>
              </Card>

        <Card style={{ borderWidth: 1, borderColor: theme.colors.primary }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: 8 }]}>Tu Posicion</Text>

                {userEntry ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Ranking actual</Text>
                      <Text style={[theme.typography.h3, { color: theme.colors.text }]}>#{userEntry.rank}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Season Points</Text>
                      <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{userEntry.seasonPoints} SP</Text>
                    </View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 10 }]}>
                      {deltaToNext === null
                        ? 'Estas en la cima de tu liga. Excelente trabajo.'
                        : `Te faltan ${deltaToNext} SP para superar al siguiente jugador.`}
                    </Text>
                  </>
                ) : (
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Aun no hay posicion disponible.</Text>
                )}
              </Card>

        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: 10 }]}>Ranking semanal</Text>

                <View style={{ marginBottom: 8 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.green, marginBottom: 6 }]}>Zona de ascenso: Top {getPromotionCutoff()}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.red }]}>Zona de descenso: desde #{demotionCutoff}</Text>
                </View>

                {isLoading ? (
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Cargando ranking...</Text>
                ) : entries.length === 0 ? (
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>No hay jugadores para mostrar en este momento.</Text>
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
                          : entry.rank <= getPromotionCutoff()
                            ? `${theme.colors.green}1A`
                            : entry.rank >= demotionCutoff
                              ? `${theme.colors.red}1A`
                              : 'transparent',
                      borderWidth: 1,
                      borderColor: entry.isUser
                        ? theme.colors.primary
                        : entry.rank <= getPromotionCutoff()
                          ? theme.colors.green
                          : entry.rank >= demotionCutoff
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
                      <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{entry.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: entry.isUser ? '700' : '600' }}>
                        {entry.name}
                      </Text>
                      {entry.isUser ? <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>Tu cuenta</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{entry.seasonPoints} SP</Text>
                      {entry.rank <= getPromotionCutoff() ? <Pill label="Ascenso" tone="success" /> : null}
                      {entry.rank >= demotionCutoff ? <Pill label="Descenso" tone="danger" /> : null}
                    </View>
                  </View>
                ))}

                <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 4 }]}>Clasificacion local simulada en dispositivo (sin backend global).</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
