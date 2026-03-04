import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { ensureSeasonCurrent, markLastWeekResultShown, Profile } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
import Pill from '../shared/ui/Pill';
import { getLeagueById } from '../shared/gamification/leagues';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const [xpTotal, setXpTotal] = useState(0);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [weeklyResult, setWeeklyResult] = useState<Profile['lastWeekResult'] | null>(null);

  useFocusEffect(
    useCallback(() => {
      ensureSeasonCurrent().then((profile) => {
        setXpTotal(profile.xpTotal);
        setSeasonPoints(profile.seasonPoints);
        setLeagueId(profile.leagueId);
        setStreakCurrent(profile.streakCurrent);
        setStreakBest(profile.streakBest);

        if (
          profile.lastWeekResult &&
          profile.lastWeekResultShownSeasonId !== profile.lastWeekResult.seasonIdPrev
        ) {
          setWeeklyResult(profile.lastWeekResult);
        }
      });
    }, []),
  );

  const level = getLevelByXp(xpTotal);
  const nextLevel = getNextLevel(xpTotal);
  const league = getLeagueById(leagueId);
  const progress = nextLevel
    ? (xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  const closeWeeklyResult = async () => {
    if (!weeklyResult) return;
    await markLastWeekResultShown(weeklyResult.seasonIdPrev);
    setWeeklyResult(null);
  };

  const weeklyStatusText =
    weeklyResult && weeklyResult.leagueAfter !== weeklyResult.leagueBefore
      ? weeklyResult.leagueAfter === leagueId
        ? '¡Cambio de liga aplicado!'
        : 'Resultado semanal actualizado'
      : 'Te mantienes en tu liga';

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Text style={[theme.typography.h1, { color: theme.colors.text }]}>NeuroFit</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>Entrena tu mente como entrenas tu cuerpo</Text>
        <Pill label={`🔥 Racha: ${streakCurrent} días · Mejor: ${streakBest}`} tone="warning" />

        <View style={{ gap: theme.spacing.sm }}>
          <Button title="Jugar" onPress={() => navigation.navigate('Games')} />
          <Button title="Reto diario" variant="secondary" onPress={() => navigation.navigate('DailyChallenge')} />
          <Button title="Ranking semanal" variant="secondary" onPress={() => navigation.navigate('Leaderboard')} />
          <Button title="Progreso" variant="secondary" onPress={() => navigation.navigate('Progress')} />
        </View>

        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Nivel actual</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 6 }]}>
            {level.badgeEmoji} {level.name} · {xpTotal} XP
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: 10 }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary }]} />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
            {nextLevel ? `Siguiente: ${nextLevel.name} (${nextLevel.minXp} XP)` : 'Nivel máximo alcanzado'}
          </Text>
        </Card>

        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Liga semanal</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 6 }]}>
            {league.badgeEmoji} {league.name} · {seasonPoints} SP
          </Text>
        </Card>

        <Button title="Ajustes" variant="ghost" onPress={() => navigation.navigate('Settings')} />
      </ScrollView>

      <Modal visible={!!weeklyResult} transparent animationType="fade" onRequestClose={closeWeeklyResult}>
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: theme.colors.background,
              opacity: 0.78,
            }}
          />
          <Card>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Resultado semanal</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{weeklyStatusText}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Liga: {weeklyResult ? getLeagueById(weeklyResult.leagueBefore).name : '-'} → {weeklyResult ? getLeagueById(weeklyResult.leagueAfter).name : '-'}
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              Puesto final: {weeklyResult?.finalRank ?? '-'} / 50
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              SP semana: {weeklyResult?.spFinal ?? 0}
            </Text>
            <View style={{ marginTop: 12 }}>
              <Button title="Continuar" onPress={closeWeeklyResult} />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});