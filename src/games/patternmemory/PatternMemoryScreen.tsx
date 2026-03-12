import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock, nowISO } from '../../shared/utils/time';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { computePerformanceFromScore } from '../../core/gamification/economy';
import { trackPatternMemoryResult, trackSessionStart } from '../../shared/storage/stats';
import {
  appendSequenceStep,
  calcAccuracy,
  calcReactionTimeAvg,
  calculatePatternMemoryScore,
  createInitialSequence,
  createRoundRng,
  getPatternMemoryConfig,
  isCorrectTap,
} from './logic';
import { PatternMemoryFinishReason, PatternMemoryGameResult, TileId } from './types';
import { clearPatternMemoryState, getPatternMemoryState, savePatternMemoryState } from './storage/patternMemoryState';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';

type Props = NativeStackScreenProps<RootStackParamList, 'PatternMemory'>;

type Phase = 'idle' | 'showing' | 'input' | 'finished';

type ResultSummary = {
  elapsedMs: number;
  score: number;
  maxSequence: number;
  accuracy: number;
  reactionTimeAvg: number;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: PatternMemoryGameResult;
};

const TILE_IDS: TileId[] = [0, 1, 2, 3];

function getSessionSeed(isDaily: boolean, dailySeed?: number): number {
  if (isDaily && typeof dailySeed === 'number') {
    return Math.max(1, Math.floor(dailySeed));
  }
  return Math.max(1, Math.floor(Date.now() % 2_147_483_647));
}

export default function PatternMemoryScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const config = useMemo(() => getPatternMemoryConfig(difficulty), [difficulty]);

  const tileAnimRefs = useRef<Animated.Value[]>([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  const playbackTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mountedRef = useRef(true);

  const [sessionSeed, setSessionSeed] = useState(getSessionSeed(isDaily, dailySeed));
  const [startedAtISO, setStartedAtISO] = useState(nowISO());
  const [sequence, setSequence] = useState<TileId[]>([]);
  const [round, setRound] = useState(1);
  const [maxSequence, setMaxSequence] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [correctTaps, setCorrectTaps] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [reactionAccumMs, setReactionAccumMs] = useState(0);
  const [reactionSamples, setReactionSamples] = useState(0);
  const [promptAtMs, setPromptAtMs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.totalSeconds);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);

  const tileBaseColors = useMemo(
    () => [theme.colors.primary, theme.colors.cyan, theme.colors.pink, theme.colors.orange],
    [theme.colors.cyan, theme.colors.orange, theme.colors.pink, theme.colors.primary],
  );

  const clearPlaybackQueue = useCallback(() => {
    playbackTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    playbackTimeoutsRef.current = [];
    tileAnimRefs.current.forEach((anim) => {
      anim.stopAnimation();
      anim.setValue(0);
    });
  }, []);

  const flashTile = useCallback(
    (tileId: TileId) => {
      const anim = tileAnimRefs.current[tileId];
      anim.stopAnimation();
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: Math.floor(config.tileOnMs * 0.55),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: Math.floor(config.tileOnMs * 0.45),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [config.tileOnMs],
  );

  const playSequence = useCallback(
    (sequenceToShow: TileId[]) => {
      clearPlaybackQueue();
      setPhase('showing');
      setInputIndex(0);

      let cursor = 320;
      sequenceToShow.forEach((tileId) => {
        const timeout = setTimeout(() => {
          if (!mountedRef.current || didFinish) return;
          flashTile(tileId);
        }, cursor);
        playbackTimeoutsRef.current.push(timeout);
        cursor += config.tileOnMs + config.tilePauseMs;
      });

      const readyTimeout = setTimeout(() => {
        if (!mountedRef.current || didFinish) return;
        setPhase('input');
        setPromptAtMs(Date.now());
      }, cursor + 120);
      playbackTimeoutsRef.current.push(readyTimeout);
    },
    [clearPlaybackQueue, config.tileOnMs, config.tilePauseMs, didFinish, flashTile],
  );

  const prepareFreshSession = useCallback(
    (nextSeed: number) => {
      const rng = createRoundRng(nextSeed);
      const initialSequence = createInitialSequence(rng);
      setSessionSeed(nextSeed);
      setStartedAtISO(nowISO());
      setSequence(initialSequence);
      setRound(1);
      setMaxSequence(0);
      setInputIndex(0);
      setPhase('idle');
      setCorrectTaps(0);
      setTotalTaps(0);
      setMistakes(0);
      setReactionAccumMs(0);
      setReactionSamples(0);
      setPromptAtMs(0);
      setTimeLeft(config.totalSeconds);
      setSessionStarted(true);
      setDidFinish(false);
      setFinishing(false);
      setResultVisible(false);
      setResultSummary(null);
    },
    [config.totalSeconds],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPlaybackQueue();
    };
  }, [clearPlaybackQueue]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (isDaily) {
        const daily = await ensureDailyToday();
        const expectedStage = daily.stages[daily.currentStageIndex];

        if (daily.completed) {
          setDailyBlockedReason('Reto diario ya completado, vuelve mañana.');
          Alert.alert('Reto diario completado', 'Reto diario ya completado, vuelve mañana.');
          return;
        }

        if (!expectedStage || expectedStage.gameId !== 'patternmemory') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'patternmemory' });
      }

      const saved = await getPatternMemoryState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setSequence(saved.sequence);
        setStartedAtISO(typeof saved.startedAtISO === 'string' ? saved.startedAtISO : nowISO());
        setRound(saved.round);
        setMaxSequence(saved.maxSequence);
        setInputIndex(saved.inputIndex);
        setPhase(saved.phase === 'showing' ? 'input' : saved.phase);
        setCorrectTaps(saved.correctTaps);
        setTotalTaps(saved.totalTaps);
        setMistakes(saved.mistakes);
        setReactionAccumMs(saved.reactionAccumMs);
        setReactionSamples(saved.reactionSamples);
        setPromptAtMs(saved.promptAtMs);
        setTimeLeft(saved.timeLeft);
        setSessionSeed(saved.sessionSeed);
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));

        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'patternmemory', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      if (!mounted) return;
      const nextSeed = getSessionSeed(isDaily, dailySeed);
      prepareFreshSession(nextSeed);
      await trackSessionStart({ gameId: 'patternmemory', mode: isDaily ? 'daily' : 'normal' });
    };

    init();

    return () => {
      mounted = false;
    };
  }, [dailyDateISO, dailySeed, difficulty, isDaily, prepareFreshSession, stageIndex]);

  useEffect(() => {
    if (!sessionStarted || didFinish || !!dailyBlockedReason) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [dailyBlockedReason, didFinish, sessionStarted]);

  useEffect(() => {
    if (sequence.length === 0) return;
    savePatternMemoryState({
      startedAtISO,
      sequence,
      round,
      maxSequence,
      inputIndex,
      phase,
      correctTaps,
      totalTaps,
      mistakes,
      reactionAccumMs,
      reactionSamples,
      promptAtMs,
      timeLeft,
      sessionSeed,
      sessionStarted,
      didFinish,
      difficulty,
      isDaily,
      dailyDateISO,
      seed: dailySeed,
    });
  }, [
    correctTaps,
    dailyDateISO,
    dailySeed,
    didFinish,
    difficulty,
    inputIndex,
    isDaily,
    startedAtISO,
    maxSequence,
    mistakes,
    phase,
    promptAtMs,
    reactionAccumMs,
    reactionSamples,
    round,
    sequence,
    sessionSeed,
    sessionStarted,
    timeLeft,
    totalTaps,
  ]);

  const finishSession = useCallback(
    async (reason: PatternMemoryFinishReason) => {
      if (finishing || didFinish) return;
      setFinishing(true);
      setDidFinish(true);
      setPhase('finished');
      clearPlaybackQueue();

      const elapsedMs = Math.max(0, (config.totalSeconds - timeLeft) * 1000);
      const accuracy = calcAccuracy(correctTaps, totalTaps);
      const reactionTimeAvg = calcReactionTimeAvg(reactionAccumMs, reactionSamples);
      const score = calculatePatternMemoryScore({
        maxSequence,
        maxRound: config.maxRound,
        accuracy,
        reactionTimeAvg,
        reactionBestMs: config.reactionBestMs,
        reactionWorstMs: config.reactionWorstMs,
      });
      const performance = computePerformanceFromScore(score, difficulty);
      const won = reason !== 'failed';

      await trackPatternMemoryResult({
        gameId: 'patternmemory',
        score,
        maxSequence,
        accuracyPct: accuracy,
        reactionTimeAvgMs: reactionTimeAvg,
        durationMs: elapsedMs,
        won,
      });

      const completionResult = await completeGameSession({
        gameId: 'patternmemory',
        difficulty,
        mode: isDaily ? 'daily' : 'normal',
        won,
        stageIndex,
        metrics: {
          durationMs: elapsedMs,
          score,
          mistakes,
        },
      });

      if (isDaily && completionResult.dailyCompletion) {

        const gameResult: PatternMemoryGameResult = {
          gameId: 'patternmemory',
          difficulty,
          startedAt: startedAtISO,
          completedAt: nowISO(),
          metrics: {
            score,
            accuracy,
            reactionTimeAvg,
            maxSequence,
            totalTaps,
            correctTaps,
          },
          xpGained: completionResult.earnedXp,
          spGained: completionResult.earnedSp,
          performance,
        };

        await clearPatternMemoryState();
        setSessionStarted(false);
        setFinishing(false);

        navigation.replace('DailyChallenge', {
          completion: completionResult.dailyCompletion,
        });

        if (__DEV__) {
          console.log('[PatternMemory][DailyResult]', gameResult);
        }

        return;
      }

      const gameResult: PatternMemoryGameResult = {
        gameId: 'patternmemory',
        difficulty,
        startedAt: startedAtISO,
        completedAt: nowISO(),
        metrics: {
          score,
          accuracy,
          reactionTimeAvg,
          maxSequence,
          totalTaps,
          correctTaps,
        },
        xpGained: completionResult.earnedXp,
        spGained: completionResult.earnedSp,
        performance,
      };

      await clearPatternMemoryState();
      setSessionStarted(false);
      setResultSummary({
        elapsedMs,
        score,
        maxSequence,
        accuracy,
        reactionTimeAvg,
        xpGained: completionResult.earnedXp,
        spGained: completionResult.earnedSp,
        performance,
        gameResult,
      });
      setResultVisible(true);
      setFinishing(false);
    },
    [
      clearPlaybackQueue,
      config.maxRound,
      config.reactionBestMs,
      config.reactionWorstMs,
      config.totalSeconds,
      correctTaps,
      difficulty,
      didFinish,
      finishing,
      isDaily,
      maxSequence,
      mistakes,
      navigation,
      reactionAccumMs,
      reactionSamples,
      stageIndex,
      startedAtISO,
      timeLeft,
      totalTaps,
    ],
  );

  useEffect(() => {
    if (!sessionStarted || didFinish || timeLeft > 0) return;
    finishSession('timeout');
  }, [didFinish, finishSession, sessionStarted, timeLeft]);

  const startOrContinue = useCallback(() => {
    if (dailyBlockedReason || didFinish) return;
    if (phase === 'showing') return;
    playSequence(sequence);
  }, [dailyBlockedReason, didFinish, phase, playSequence, sequence]);

  const handleTilePress = useCallback(
    (tileId: TileId) => {
      if (dailyBlockedReason || phase !== 'input' || didFinish || finishing) return;

      const now = Date.now();
      const reactionDelta = promptAtMs > 0 ? Math.max(0, now - promptAtMs) : 0;
      const correctTap = isCorrectTap(sequence, inputIndex, tileId);

      setTotalTaps((prev) => prev + 1);
      if (correctTap) {
        setCorrectTaps((prev) => prev + 1);
        if (reactionDelta > 0) {
          setReactionAccumMs((prev) => prev + reactionDelta);
          setReactionSamples((prev) => prev + 1);
        }

        const isRoundComplete = inputIndex + 1 >= sequence.length;
        if (!isRoundComplete) {
          setInputIndex((prev) => prev + 1);
          setPromptAtMs(Date.now());
          return;
        }

        const completedRound = round;
        setMaxSequence((prev) => Math.max(prev, completedRound));

        if (completedRound >= config.maxRound) {
          finishSession('max_round');
          return;
        }

        const rng = createRoundRng(sessionSeed + completedRound * 101);
        const nextSequence = appendSequenceStep(sequence, rng);
        setSequence(nextSequence);
        setRound((prev) => prev + 1);
        setInputIndex(0);

        const queueNext = setTimeout(() => {
          if (!mountedRef.current || didFinish) return;
          playSequence(nextSequence);
        }, 320);
        playbackTimeoutsRef.current.push(queueNext);
        return;
      }

      setMistakes((prev) => prev + 1);
      finishSession('failed');
    },
    [
      config.maxRound,
      dailyBlockedReason,
      didFinish,
      finishSession,
      finishing,
      inputIndex,
      phase,
      playSequence,
      promptAtMs,
      round,
      sequence,
      sessionSeed,
    ],
  );

  const restart = useCallback(async () => {
    if (isDaily) return;
    clearPlaybackQueue();
    const nextSeed = getSessionSeed(false);
    prepareFreshSession(nextSeed);
    await trackSessionStart({ gameId: 'patternmemory', mode: 'normal' });
  }, [clearPlaybackQueue, isDaily, prepareFreshSession]);

  const exitGame = useCallback(() => {
    clearPlaybackQueue();
    navigation.navigate(isDaily ? 'DailyChallenge' : 'Games');
  }, [clearPlaybackQueue, isDaily, navigation]);

  const accuracy = calcAccuracy(correctTaps, totalTaps);
  const reactionTimeAvg = calcReactionTimeAvg(reactionAccumMs, reactionSamples);

  return (
    <>
      <Screen>
        <Card variant="primary">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Pattern Memory · {difficultyLabel(difficulty)}</Text>
          <View style={{ marginTop: 8 }}>
            <Pill
              label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`}
              tone={isDaily ? 'warning' : 'default'}
            />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Tiempo: {msToClock(timeLeft * 1000)} · Ronda: {round}/{config.maxRound}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Mejor secuencia: {maxSequence} · Precisión: {accuracy}% · RT medio: {reactionTimeAvg} ms
          </Text>
        </Card>

        {dailyBlockedReason ? (
          <Card>
            <Text style={[theme.typography.body, { color: theme.colors.warning }]}>{dailyBlockedReason}</Text>
            <View style={{ marginTop: 10 }}>
              <Button title="Volver al reto diario" onPress={() => navigation.navigate('DailyChallenge')} />
            </View>
          </Card>
        ) : null}

        {!dailyBlockedReason ? (
          <Card variant="cyan">
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, textAlign: 'center' }]}>Memoriza la secuencia y repítela en orden.</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, textAlign: 'center', marginTop: 6 }]}>
              {phase === 'showing' ? 'Observa el patrón' : phase === 'input' ? 'Tu turno' : 'Pulsa Empezar'}
            </Text>

            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {TILE_IDS.map((tileId) => {
                const pulseValue = tileAnimRefs.current[tileId];
                const scale = pulseValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.08],
                });
                const glowOpacity = pulseValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1],
                });

                return (
                  <Pressable
                    key={tileId}
                    onPress={() => handleTilePress(tileId)}
                    disabled={phase !== 'input' || didFinish}
                    style={{ width: '47%' }}
                  >
                    <Animated.View
                      style={{
                        minHeight: 106,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: tileBaseColors[tileId],
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ scale }],
                        opacity: glowOpacity,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 24 }}>{tileId + 1}</Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={phase === 'idle' || phase === 'finished' ? 'Empezar' : 'Repetir secuencia'}
            onPress={startOrContinue}
            disabled={!!dailyBlockedReason || didFinish || phase === 'showing'}
            style={{ flex: 1 }}
          />
          <Button title="Salir" variant="secondary" onPress={exitGame} style={{ flex: 1 }} />
        </View>

        <Button title="Reintentar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
      </Screen>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
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
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Sesión finalizada</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>Score: {resultSummary?.score ?? 0}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Max secuencia: {resultSummary?.maxSequence ?? 0}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Precisión: {resultSummary?.accuracy ?? 0}%</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>RT medio: {resultSummary?.reactionTimeAvg ?? 0} ms</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Tiempo: {msToClock(resultSummary?.elapsedMs ?? 0)}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>XP: +{resultSummary?.xpGained ?? 0}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>SP: +{resultSummary?.spGained ?? 0}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button
                title="Jugar de nuevo"
                onPress={() => {
                  setResultVisible(false);
                  restart();
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Ver ranking"
                variant="secondary"
                onPress={() => {
                  setResultVisible(false);
                  navigation.navigate('Leaderboard');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}
