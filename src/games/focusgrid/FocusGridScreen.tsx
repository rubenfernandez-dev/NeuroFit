import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
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
import { trackFocusGridResult, trackSessionStart } from '../../shared/storage/stats';
import { buildShuffledGridNumbers, calcAccuracy, getFocusGridConfig } from './logic';
import { FocusGridFinishReason, FocusGridGameResult } from './types';
import { clearFocusGridState, getFocusGridState, saveFocusGridState } from './storage/focusGridState';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import FocusGridBoard from './components/FocusGridBoard';
import FocusGridResultModal from './components/FocusGridResultModal';
import { useTapFeedback } from './hooks/useTapFeedback';
import { buildFocusGridSessionResult, getSessionSeed } from './session';

type Props = NativeStackScreenProps<RootStackParamList, 'FocusGrid'>;

type Phase = 'idle' | 'playing' | 'finished';

type ResultSummary = {
  elapsedMs: number;
  score: number;
  mistakes: number;
  accuracy: number;
  completionTimeMs: number;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: FocusGridGameResult;
};

export default function FocusGridScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const config = useMemo(() => getFocusGridConfig(difficulty), [difficulty]);
  const totalCells = config.gridSize * config.gridSize;
  const mountedRef = useRef(true);

  const [sessionSeed, setSessionSeed] = useState(getSessionSeed(isDaily, dailySeed));
  const [startedAtISO, setStartedAtISO] = useState(nowISO());
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [correctTaps, setCorrectTaps] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.totalSeconds);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);
  const { tapFeedback, setTapFeedback, clearFeedback, applyTapFeedback } = useTapFeedback();

  const prepareFreshSession = useCallback(
    (nextSeed: number) => {
      setSessionSeed(nextSeed);
      setStartedAtISO(nowISO());
      setNumbers(buildShuffledGridNumbers(totalCells, nextSeed));
      setNextExpected(1);
      setMistakes(0);
      setCorrectTaps(0);
      setTotalTaps(0);
      setTimeLeft(config.totalSeconds);
      setPhase('idle');
      setSessionStarted(true);
      setDidFinish(false);
      setFinishing(false);
      setResultVisible(false);
      setResultSummary(null);
      setTapFeedback(null);
    },
    [config.totalSeconds, totalCells],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearFeedback();
    };
  }, [clearFeedback]);

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

        if (!expectedStage || expectedStage.gameId !== 'focusgrid') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'focusgrid' });
      }

      const saved = await getFocusGridState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setStartedAtISO(saved.startedAtISO);
        setNumbers(saved.numbers);
        setNextExpected(saved.nextExpected);
        setMistakes(saved.mistakes);
        setCorrectTaps(saved.correctTaps);
        setTotalTaps(saved.totalTaps);
        setTimeLeft(saved.timeLeft);
        setSessionSeed(saved.sessionSeed);
        setSessionStarted(Boolean(saved.started));
        setDidFinish(Boolean(saved.didFinish));
        setPhase(saved.phase === 'finished' ? 'finished' : saved.phase);

        if (!saved.started) {
          await trackSessionStart({ gameId: 'focusgrid', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      if (!mounted) return;
      const nextSeed = getSessionSeed(isDaily, dailySeed);
      prepareFreshSession(nextSeed);
      await trackSessionStart({ gameId: 'focusgrid', mode: isDaily ? 'daily' : 'normal' });
    };

    init();

    return () => {
      mounted = false;
    };
  }, [dailyDateISO, dailySeed, difficulty, isDaily, prepareFreshSession, stageIndex]);

  useEffect(() => {
    if (!sessionStarted || didFinish || !!dailyBlockedReason || phase !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [dailyBlockedReason, didFinish, phase, sessionStarted]);

  useEffect(() => {
    if (!sessionStarted || numbers.length === 0) return;
    saveFocusGridState({
      startedAtISO,
      numbers,
      nextExpected,
      mistakes,
      correctTaps,
      totalTaps,
      timeLeft,
      sessionSeed,
      started: sessionStarted,
      didFinish,
      phase,
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
    isDaily,
    mistakes,
    nextExpected,
    numbers,
    phase,
    sessionSeed,
    sessionStarted,
    startedAtISO,
    timeLeft,
    totalTaps,
  ]);

  const finishSession = useCallback(
    async (reason: FocusGridFinishReason) => {
      if (finishing || didFinish) return;
      setFinishing(true);
      setDidFinish(true);
      setPhase('finished');
      clearFeedback();

      const elapsedMs = Math.max(0, (config.totalSeconds - timeLeft) * 1000);
      const sessionResult = buildFocusGridSessionResult({
        reason,
        difficulty,
        startedAtISO,
        elapsedMs,
        mistakes,
        correctTaps,
        totalTaps,
        totalCells,
        targetMinMs: config.targetMinMs,
        targetMaxMs: config.targetMaxMs,
        earnedXp: 0,
        earnedSp: 0,
      });

      await trackFocusGridResult({
        gameId: 'focusgrid',
        difficulty,
        score: sessionResult.score,
        mistakes,
        accuracyPct: sessionResult.accuracy,
        durationMs: elapsedMs,
        completed: sessionResult.completed,
      });

      const completionResult = await completeGameSession({
        gameId: 'focusgrid',
        difficulty,
        mode: isDaily ? 'daily' : 'normal',
        won: sessionResult.completed,
        stageIndex,
        metrics: {
          durationMs: elapsedMs,
          score: sessionResult.score,
          mistakes,
        },
      });

      const finalizedResult = buildFocusGridSessionResult({
        reason,
        difficulty,
        startedAtISO,
        elapsedMs,
        mistakes,
        correctTaps,
        totalTaps,
        totalCells,
        targetMinMs: config.targetMinMs,
        targetMaxMs: config.targetMaxMs,
        earnedXp: completionResult.earnedXp,
        earnedSp: completionResult.earnedSp,
      });

      if (isDaily && completionResult.dailyCompletion) {
        await clearFocusGridState();
        setSessionStarted(false);
        setFinishing(false);

        navigation.replace('DailyChallenge', {
          completion: completionResult.dailyCompletion,
        });

        if (__DEV__) {
          console.log('[FocusGrid][DailyResult]', finalizedResult.gameResult);
        }

        return;
      }

      await clearFocusGridState();
      setSessionStarted(false);
      setResultSummary({
        elapsedMs,
        score: finalizedResult.score,
        mistakes,
        accuracy: finalizedResult.accuracy,
        completionTimeMs: finalizedResult.completionTimeMs,
        xpGained: completionResult.earnedXp,
        spGained: completionResult.earnedSp,
        performance: finalizedResult.performance,
        gameResult: finalizedResult.gameResult,
      });
      setResultVisible(true);
      setFinishing(false);
    },
    [
      clearFeedback,
      config.targetMaxMs,
      config.targetMinMs,
      config.totalSeconds,
      correctTaps,
      didFinish,
      difficulty,
      finishing,
      isDaily,
      mistakes,
      navigation,
      stageIndex,
      startedAtISO,
      timeLeft,
      totalCells,
      totalTaps,
    ],
  );

  useEffect(() => {
    if (!sessionStarted || didFinish || timeLeft > 0 || phase !== 'playing') return;
    finishSession('timeout');
  }, [didFinish, finishSession, phase, sessionStarted, timeLeft]);

  const startGame = useCallback(() => {
    if (dailyBlockedReason || didFinish || numbers.length === 0) return;
    if (phase !== 'playing') {
      setPhase('playing');
    }
  }, [dailyBlockedReason, didFinish, numbers.length, phase]);

  const handleNumberPress = useCallback(
    (value: number) => {
      if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;

      setTotalTaps((prev) => prev + 1);
      if (value === nextExpected) {
        setCorrectTaps((prev) => prev + 1);
        applyTapFeedback({ type: 'correct', value });

        if (value >= totalCells) {
          finishSession('completed');
          return;
        }

        setNextExpected((prev) => prev + 1);
        return;
      }

      setMistakes((prev) => prev + 1);
      applyTapFeedback({ type: 'incorrect', value });
    },
    [applyTapFeedback, dailyBlockedReason, didFinish, finishSession, finishing, nextExpected, phase, totalCells],
  );

  const restart = useCallback(async () => {
    if (isDaily) return;
    clearFeedback();
    const nextSeed = getSessionSeed(false);
    prepareFreshSession(nextSeed);
    await trackSessionStart({ gameId: 'focusgrid', mode: 'normal' });
  }, [clearFeedback, isDaily, prepareFreshSession]);

  const exitGame = useCallback(() => {
    clearFeedback();
    navigation.navigate(isDaily ? 'DailyChallenge' : 'Games');
  }, [clearFeedback, isDaily, navigation]);

  const accuracy = calcAccuracy(correctTaps, totalTaps);
  const gridGap = config.gridSize >= 6 ? 4 : 6;
  const gridMaxWidth = Math.min(width - 34, 420);
  const tileSize = Math.max(
    config.gridSize >= 7 ? 34 : 40,
    Math.floor((gridMaxWidth - gridGap * (config.gridSize - 1)) / config.gridSize),
  );

  return (
    <>
      <Screen>
        <Card variant="primary">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Focus Grid · {difficultyLabel(difficulty)}</Text>
          <View style={{ marginTop: 8 }}>
            <Pill
              label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`}
              tone={isDaily ? 'warning' : 'default'}
            />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Tiempo: {msToClock(timeLeft * 1000)} · Grid: {config.gridSize}x{config.gridSize}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Siguiente: {Math.min(nextExpected, totalCells)} · Fallos: {mistakes} · Precisión: {accuracy}%
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
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              Toca los números en orden ascendente lo más rápido posible.
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, textAlign: 'center', marginTop: 6 }]}>
              {phase === 'playing' ? `Siguiente: ${Math.min(nextExpected, totalCells)}` : 'Pulsa Empezar'}
            </Text>

            <FocusGridBoard
              numbers={numbers}
              nextExpected={nextExpected}
              tileSize={tileSize}
              gridGap={gridGap}
              gridMaxWidth={gridMaxWidth}
              gridSize={config.gridSize}
              phase={phase}
              didFinish={didFinish}
              tapFeedback={tapFeedback}
              theme={theme}
              onPressNumber={handleNumberPress}
            />
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={phase === 'idle' || phase === 'finished' ? 'Empezar' : 'En juego'}
            onPress={startGame}
            disabled={!!dailyBlockedReason || didFinish || phase === 'playing'}
            style={{ flex: 1 }}
          />
          <Button title="Salir" variant="secondary" onPress={exitGame} style={{ flex: 1 }} />
        </View>

        <Button title="Reintentar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
      </Screen>

      <FocusGridResultModal
        visible={resultVisible}
        resultSummary={resultSummary}
        theme={theme}
        onClose={() => setResultVisible(false)}
        onRestart={() => {
          setResultVisible(false);
          restart();
        }}
        onViewLeaderboard={() => {
          setResultVisible(false);
          navigation.navigate('Leaderboard');
        }}
      />
    </>
  );
}
