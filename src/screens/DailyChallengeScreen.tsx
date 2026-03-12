import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { difficultyLabel } from '../games/types';
import { ensureDailyToday, getDailyProgress } from '../shared/storage/daily';
import { getGameById } from '../games/registry';
import Card from '../shared/ui/Card';
import Pill from '../shared/ui/Pill';
import { useAppTheme } from '../shared/theme/theme';
import { getProfile } from '../shared/storage/profile';
import Screen from '../shared/ui/Screen';
import PrimaryButton from '../shared/ui/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyChallenge'>;

function getGameLabel(gameId: string): string {
  if (gameId === 'mentalmath') return 'Mental Math';
  if (gameId === 'memory') return 'Memory';
  if (gameId === 'sudoku') return 'Sudoku';
  if (gameId === 'speedmatch') return 'Speed Match';
  if (gameId === 'patternmemory') return 'Pattern Memory';
  if (gameId === 'focusgrid') return 'Focus Grid';
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
  const [showFinalConfetti, setShowFinalConfetti] = useState(completion?.kind === 'final');
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

  const load = useCallback(() => {
    Promise.all([ensureDailyToday(), getProfile()]).then(([dailyState, profile]) => {
      if (!mountedRef.current) return;
      setDaily(dailyState);
      setStreakCurrent(profile.streakCurrent);
    });
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
  }, [cancelAutoAdvance, completion?.kind, daily?.completed, nextStage]);

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

  // Root cause fixed: all hooks now run before any conditional return, keeping hook order stable across renders.
  if (!daily) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textMuted }}>Cargando reto...</Text>
      </View>
    );
  }

  if (completion?.kind === 'stage') {
    return (
      <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
        <Card variant="success" style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 58 }}>✅</Text>
          <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 8 }]}>Etapa completada</Text>
          {nextStageLabel ? (
            <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 8 }]}>
              Siguiente: {nextStageLabel}
            </Text>
          ) : null}

          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Pill label={`+${completion.earnedXp} XP`} tone="pink" />
            <Pill label={`+${completion.earnedSp} SP`} tone="cyan" />
          </View>

          <View style={{ width: '100%', marginTop: 14 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Resultado etapa</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 6 }]}>Tiempo: {completion.result?.durationMs ?? '-'} ms</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 2 }]}>Errores: {completion.result?.mistakes ?? '-'}</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: 2 }]}>Score: {completion.result?.score ?? '-'}</Text>
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
          <Text style={{ fontSize: 58 }}>🎉</Text>
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
            <PrimaryButton title="Ver resumen" onPress={clearCompletion} style={{ minHeight: 56, borderRadius: 18 }} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card variant="primary">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Reto de hoy · {daily.lastDailyDateISO}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 8 }]}>
          Circuito: {progress.completedStages}/{progress.totalStages}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>Estado: {daily.status}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 8 }]}>🔥 Racha actual: {streakCurrent} días</Text>
        <View style={{ marginTop: 12 }}>
          <Pill label={daily.completed ? 'Completado' : 'Pendiente'} tone={daily.completed ? 'success' : 'default'} />
        </View>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 10 }]}>
          {daily.completed ? '✅ Reto diario completado. Vuelve mañana para uno nuevo.' : 'Completa las 3 etapas para reclamar la recompensa diaria.'}
        </Text>
        {daily.completedAtISO ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>Completado: {daily.completedAtISO}</Text> : null}
        {daily.claimedRewardAtISO ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>Recompensa reclamada: {daily.claimedRewardAtISO}</Text> : null}
      </Card>

      <Card>
        {daily.stages.map((stage, index) => {
          const game = getGameById(stage.gameId);
          const isCurrent = index === daily.currentStageIndex && !daily.completed;
          return (
            <View key={`${stage.gameId}-${index}`} style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: index < daily.stages.length - 1 ? 1 : 0, borderColor: theme.colors.border }}>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                Etapa {index + 1}: {game?.title ?? stage.gameId}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                Dificultad: {difficultyLabel(stage.difficulty)}
              </Text>
              {stage.result ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}> 
                  Resultado · score: {stage.result.score ?? '-'} · tiempo: {stage.result.durationMs ?? '-'}ms · fallos: {stage.result.mistakes ?? '-'}
                </Text>
              ) : null}
              <View style={{ marginTop: 6, flexDirection: 'row', gap: 8 }}>
                <Pill label={stage.completed ? '✅ Completado' : isCurrent ? '▶ Actual' : '⏳ Pendiente'} tone={stage.completed ? 'success' : isCurrent ? 'cyan' : 'default'} />
              </View>
            </View>
          );
        })}
      </Card>

      <PrimaryButton
        title={daily.completed ? '✅ Reto diario completado' : progress.completedStages === 0 ? 'Iniciar reto diario' : 'Continuar reto diario'}
        onPress={startChallenge}
        disabled={daily.completed}
        style={{ minHeight: 56, borderRadius: 18 }}
      />
      {daily.completed ? <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, textAlign: 'center' }]}>Vuelve mañana para un nuevo reto</Text> : null}
    </Screen>
  );
}