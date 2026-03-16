import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { ensureDailyToday, getDailyProgress } from '../shared/storage/daily';
import { getGameById } from '../games/registry';
import Card from '../shared/ui/Card';
import Pill from '../shared/ui/Pill';
import { useAppTheme } from '../shared/theme/theme';
import { getProfile } from '../shared/storage/profile';
import Screen from '../shared/ui/Screen';
import PrimaryButton from '../shared/ui/PrimaryButton';
import Button from '../shared/ui/Button';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import { formatDurationMsToSeconds, formatHumanDate } from '../shared/utils/dateFormatter';
import StreakWidget from '../shared/ui/StreakWidget';
import DailyChallengeStageCard from '../shared/ui/DailyChallengeStageCard';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyChallenge'>;

function getGameLabel(gameId: string): string {
  if (gameId === 'mentalmath') return 'Cálculo mental';
  if (gameId === 'memory') return 'Memoria';
  if (gameId === 'sudoku') return 'Sudoku';
  if (gameId === 'speedmatch') return 'Coincidencia rápida';
  if (gameId === 'patternmemory') return 'Memoria de patrones';
  if (gameId === 'focusgrid') return 'Cuadrícula de enfoque';
  return gameId;
}

type ConfettiSimpleProps = {
  enabled: boolean;
  durationMs?: number;
  particleCount?: number;
  onDone?: () => void;
};

type ConfettiParticle = {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  rotateDir: 1 | -1;
};

function ConfettiSimple({ enabled, durationMs = 1600, particleCount = 20, onDone }: ConfettiSimpleProps) {
  const { width, height } = useWindowDimensions();
  const mountedRef = useRef(true);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const [visible, setVisible] = useState(enabled);
  const particlesRef = useRef<ConfettiParticle[] | null>(null);
  const translateValuesRef = useRef<Animated.Value[] | null>(null);
  const rotateValuesRef = useRef<Animated.Value[] | null>(null);
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  if (!particlesRef.current || particlesRef.current.length !== particleCount) {
    particlesRef.current = Array.from({ length: particleCount }).map((_, index) => ({
      id: index,
      emoji: ['🎉', '✨', '🎊'][index % 3],
      x: ((index * 47 + 13) % 100) / 100,
      delay: (index * 73) % 420,
      rotateDir: index % 2 === 0 ? 1 : -1,
    }));
    translateValuesRef.current = particlesRef.current.map(() => new Animated.Value(-20));
    rotateValuesRef.current = particlesRef.current.map(() => new Animated.Value(0));
  }

  const particles = particlesRef.current;
  const translateValues = translateValuesRef.current ?? [];
  const rotateValues = rotateValuesRef.current ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (doneTimeoutRef.current) {
        clearTimeout(doneTimeoutRef.current);
      }
      animationsRef.current.forEach((animation) => animation.stop());
      translateValues.forEach((value) => value.stopAnimation());
      rotateValues.forEach((value) => value.stopAnimation());
      animationsRef.current = [];
    };
  }, [rotateValues, translateValues]);

  useEffect(() => {
    if (!enabled || startedRef.current || particles.length === 0) return;
    startedRef.current = true;
    setVisible(true);

    const nextAnimations = particles.map((particle, index) => {
      translateValues[index].setValue(-20);
      rotateValues[index].setValue(0);

      const fallDuration = Math.max(600, durationMs - particle.delay);
      return Animated.parallel([
        Animated.timing(translateValues[index], {
          toValue: height + 40,
          duration: fallDuration,
          delay: particle.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotateValues[index], {
          toValue: particle.rotateDir,
          duration: fallDuration,
          delay: particle.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);
    });

    animationsRef.current = nextAnimations;
    nextAnimations.forEach((animation) => animation.start());

    doneTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setVisible(false);
      if (onDone) onDone();
    }, durationMs + 50);

    return () => {
      if (doneTimeoutRef.current) {
        clearTimeout(doneTimeoutRef.current);
      }
      nextAnimations.forEach((animation) => animation.stop());
      translateValues.forEach((value) => value.stopAnimation());
      rotateValues.forEach((value) => value.stopAnimation());
      animationsRef.current = [];
    };
  }, [durationMs, enabled, height, onDone, particles, rotateValues, translateValues]);

  if (!enabled || !visible) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {particles.map((particle, index) => (
        <Animated.Text
          key={particle.id}
          style={{
            position: 'absolute',
            left: particle.x * (width - 24),
            transform: [
              { translateY: translateValues[index] },
              {
                rotate: rotateValues[index].interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-20deg', '20deg'],
                }),
              },
            ],
            fontSize: 22,
          }}
        >
          {particle.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

export default function DailyChallengeScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const completion = route.params?.completion;
  const [daily, setDaily] = useState<Awaited<ReturnType<typeof ensureDailyToday>> | null>(null);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFinalConfetti, setShowFinalConfetti] = useState(completion?.kind === 'final');
  const rewardScale = useRef(new Animated.Value(1)).current;
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearCompletion = useCallback(() => {
    navigation.replace('DailyChallenge');
  }, [navigation]);

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  const progress = useMemo(
    () => (daily ? getDailyProgress(daily) : { completedStages: 0, totalStages: 3 }),
    [daily],
  );
  const currentStage = useMemo(() => (daily ? daily.stages[daily.currentStageIndex] ?? null : null), [daily]);
  const nextStage = useMemo(
    () => (completion?.kind === 'stage' && daily ? daily.stages[daily.currentStageIndex] ?? null : null),
    [completion?.kind, daily],
  );
  const nextStageLabel = useMemo(() => (nextStage ? getGameLabel(nextStage.gameId) : null), [nextStage]);

  const startChallenge = useCallback(() => {
    if (!daily || !currentStage || daily.completed) return;
    const game = getGameById(currentStage.gameId);
    if (!game) return;

    navigation.navigate(game.routeName, {
      gameId: currentStage.gameId,
      difficulty: currentStage.difficulty,
      mode: 'daily',
      dailyDateISO: daily.lastDailyDateISO,
      dailySeed: currentStage.seed,
      stageIndex: daily.currentStageIndex,
    });
  }, [currentStage, daily, navigation]);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);

    try {
      const [dailyState, profile] = await Promise.all([ensureDailyToday(), getProfile()]);
      if (!mountedRef.current) return;
      setDaily(dailyState);
      setStreakCurrent(profile.streakCurrent);
      setLoadError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'daily.load', kind });
      setLoadError(formatLoadFailureMessage(kind));
      setDaily(null);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    setShowFinalConfetti(completion?.kind === 'final');
  }, [completion?.kind]);

  useEffect(() => {
    if (completion?.kind !== 'final') return;
    Animated.sequence([
      Animated.timing(rewardScale, { toValue: 1.12, duration: 260, useNativeDriver: true }),
      Animated.timing(rewardScale, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [completion?.kind, rewardScale]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAutoAdvance();
    };
  }, [cancelAutoAdvance]);

  useEffect(() => {
    cancelAutoAdvance();
    if (!daily) return;
    if (completion?.kind !== 'stage') return;
    if (!nextStage || daily.completed) return;

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      startChallenge();
    }, 1500);

    return () => {
      cancelAutoAdvance();
    };
  }, [cancelAutoAdvance, completion?.kind, daily?.completed, nextStage, startChallenge, daily]);

  useFocusEffect(
    useCallback(() => {
      if (completion?.kind !== 'stage') return () => {};
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        cancelAutoAdvance();
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          clearCompletion();
        }
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [cancelAutoAdvance, clearCompletion, completion?.kind, navigation]),
  );

  if (!daily) {
    return (
      <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
        <Card variant={loadError ? 'warning' : 'primary'}>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Reto diario</Text>
          <Text style={[theme.typography.bodySmall, { color: loadError ? theme.colors.red : theme.colors.textMuted, marginTop: 8 }]}>
            {loadError ?? (isLoading ? 'Cargando reto...' : 'No pudimos cargar el reto diario.')}
          </Text>
          {!isLoading ? (
            <View style={{ marginTop: 12 }}>
              <Button title="Reintentar" onPress={load} variant="secondary" />
            </View>
          ) : null}
        </Card>
      </Screen>
    );
  }

  if (completion?.kind === 'stage') {
    return (
      <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
        <Card variant="success" style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 58 }}>✅</Text>
          <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 8 }]}>Etapa completada</Text>
          {nextStageLabel ? (
            <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 8 }]}>Siguiente: {nextStageLabel}</Text>
          ) : null}

          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Pill label={`+${completion.earnedXp} XP`} tone="pink" />
            <Pill label={`+${completion.earnedSp} SP`} tone="cyan" />
          </View>

          <View style={{ width: '100%', marginTop: 14 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Resultado etapa</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 6 }]}>Tiempo: {formatDurationMsToSeconds(completion.result?.durationMs)}</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 2 }]}>Errores: {completion.result?.mistakes ?? '-'}</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 2 }]}>Puntuacion: {completion.result?.score ?? '-'}</Text>
          </View>

          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 10 }]}>
            Progreso: {completion.progress.completedStages}/{completion.progress.totalStages}
          </Text>

          <View style={{ width: '100%', marginTop: 16 }}>
            <PrimaryButton
              title={nextStageLabel ? `Continuar → ${nextStageLabel}` : 'Ver resumen'}
              onPress={() => {
                cancelAutoAdvance();
                if (daily.completed) {
                  clearCompletion();
                  return;
                }
                startChallenge();
              }}
              style={{ minHeight: 56, borderRadius: 18 }}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  if (completion?.kind === 'final') {
    return (
      <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
        <ConfettiSimple enabled={showFinalConfetti} durationMs={1600} particleCount={20} onDone={() => setShowFinalConfetti(false)} />
        <Card variant="primary" style={{ alignItems: 'center' }}>
          <Animated.Text style={{ fontSize: 58, transform: [{ scale: rewardScale }] }}>🎉</Animated.Text>
          <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 8 }]}>Reto diario completado</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 8 }]}>Has completado el circuito de hoy</Text>

          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Pill label={`+${completion.earnedXp} XP total`} tone="pink" />
            <Pill label={`+${completion.earnedSp} SP total`} tone="cyan" />
          </View>

          <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 14 }]}>
            {completion.progress.completedStages}/{completion.progress.totalStages} etapas
          </Text>

          <View style={{ width: '100%', marginTop: 16 }}>
            <PrimaryButton title="Volver al reto diario" onPress={clearCompletion} style={{ minHeight: 56, borderRadius: 18 }} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card variant="primary">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Reto de hoy · {formatHumanDate(daily.lastDailyDateISO)}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={[styles.metricChip, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[styles.metricValue, { color: theme.colors.primary }]}>{progress.completedStages}/{progress.totalStages}</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>Etapas completadas</Text>
          </View>
          <View style={{ flex: 1 }}>
            <StreakWidget current={streakCurrent} />
          </View>
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pill label={daily.completed ? 'Completado' : 'Pendiente'} tone={daily.completed ? 'success' : 'warning'} />
          <Pill label={`Estado: ${daily.status}`} tone={daily.completed ? 'success' : 'warning'} />
        </View>

        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 10 }]}>
          {daily.completed ? '✅ Reto diario completado. Vuelve mañana para uno nuevo.' : 'Completa las 3 etapas para reclamar la recompensa diaria.'}
        </Text>
        {daily.completedAtISO ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>Completado: {formatHumanDate(daily.completedAtISO)}</Text> : null}
        {daily.claimedRewardAtISO ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>Recompensa reclamada: {formatHumanDate(daily.claimedRewardAtISO)}</Text> : null}
      </Card>

      <View style={{ gap: 12 }}>
        {daily.stages.map((stage, index) => {
          const game = getGameById(stage.gameId);
          const isCurrent = index === daily.currentStageIndex && !daily.completed;

          return (
            <DailyChallengeStageCard
              key={`${stage.gameId}-${index}`}
              stage={stage}
              index={index}
              title={game?.title ?? stage.gameId}
              isCurrent={isCurrent}
            />
          );
        })}
      </View>

      <PrimaryButton
        title={daily.completed ? '✅ Reto diario completado' : progress.completedStages === 0 ? 'Iniciar reto diario' : 'Continuar reto diario'}
        onPress={startChallenge}
        disabled={daily.completed}
      />
      {daily.completed ? <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, textAlign: 'center' }]}>Vuelve mañana para un nuevo reto</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 66,
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
});
