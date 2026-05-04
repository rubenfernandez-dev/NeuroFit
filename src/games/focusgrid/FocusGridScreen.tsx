import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Screen from '../../shared/ui/Screen';
import TimerDisplay from '../../shared/ui/TimerDisplay';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock, nowISO } from '../../shared/utils/time';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import { trackFocusGridResult, trackSessionStart } from '../../shared/storage/stats';
import { applyFocusGridCorrectTimeBonus, buildShuffledGridNumbers, calcAccuracy, getFocusGridConfig } from './logic';
import { FocusGridFinishReason, FocusGridGameResult } from './types';
import { clearFocusGridState, getFocusGridState, saveFocusGridState } from './storage/focusGridState';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import FocusGridBoard from './components/FocusGridBoard';
import FocusGridResultModal from './components/FocusGridResultModal';
import { useTapFeedback } from './hooks/useTapFeedback';
import { buildFocusGridSessionResult, getSessionSeed } from './session';
import { playDefeatFeedback, playErrorFeedback, playStreakBonusFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import { navigateToNextChallenge } from '../../shared/session/challengeNavigation';
import { resetSessionStreak } from '../../shared/session/sessionStreak';
import { formatNeuroCoinRewardCompact } from '../../shared/economy/neuroCoins';
import { NEURO_COIN_COSTS } from '../../shared/economy/neuroCoinCosts';
import NeuroCoinActionButton from '../../shared/economy/NeuroCoinActionButton';
import PlayerEconomyBar from '../../shared/economy/PlayerEconomyBar';
import useGameHelp from '../../shared/economy/useGameHelp';
import { RewardChestGrant } from '../../shared/gamification/rewardChest';

type Props = NativeStackScreenProps<RootStackParamList, 'FocusGrid'>;

type Phase = 'idle' | 'playing' | 'finished';

type ResultSummary = {
  elapsedMs: number;
  score: number;
  mistakes: number;
  accuracy: number;
  completionTimeMs: number;
  won: boolean;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: FocusGridGameResult;
  sessionStreak: number;
  streakBonusTitle?: string;
  streakBonusLabel?: string;
  rewardChest?: RewardChestGrant;
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
  const [xpTotal, setXpTotal] = useState(0);
  const [neuroCoins, setNeuroCoins] = useState(0);
  const [hintedValue, setHintedValue] = useState<number | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tapFeedback, setTapFeedback, clearFeedback, applyTapFeedback } = useTapFeedback();

  const clearHint = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
    setHintedValue(null);
  }, []);

  const {
    message: revealFeedback,
    usesLeft: revealUsesLeft,
    canUse: canReveal,
    resetHelp: resetRevealHelp,
    executeHelp: handleRevealNext,
  } = useGameHelp({
    helpId: 'focus_grid_reveal_next',
    cost: NEURO_COIN_COSTS.focusGridRevealNext,
    maxUses: 2,
    isAvailable: () => !(dailyBlockedReason || phase !== 'playing' || didFinish || finishing),
    performEffect: ({ newBalance }) => {
      setNeuroCoins(newBalance);
      clearHint();
      setHintedValue(nextExpected);
      hintTimeoutRef.current = setTimeout(() => {
        setHintedValue((current) => (current === nextExpected ? null : current));
        hintTimeoutRef.current = null;
      }, 1000);
    },
  });

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
      clearHint();
      resetRevealHelp();
    },
    [clearHint, config.totalSeconds, resetRevealHelp, totalCells],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearFeedback();
      clearHint();
    };
  }, [clearFeedback, clearHint]);

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

      const profile = await getProfile();
      if (!mounted) return;
      setXpTotal(profile.xpTotal);
      setNeuroCoins(profile.seasonPoints);

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

  // Ref keeps the full save payload current on every render.
  const focusPersistRef = useRef<Parameters<typeof saveFocusGridState>[0] | null>(null);
  focusPersistRef.current = sessionStarted && numbers.length > 0
    ? {
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
      }
    : null;

  // Persist on meaningful progress: next expected number (tap advance), mistakes,
  // phase transitions, and session init.
  // timeLeft, correctTaps, totalTaps are excluded — timeLeft ticks every second;
  // correctTaps/totalTaps are derivable on restore (correctTaps = nextExpected − 1,
  // totalTaps = correctTaps + mistakes). All are still captured via the ref.
  useEffect(() => {
    const p = focusPersistRef.current;
    if (!p) return;
    saveFocusGridState(p);
  }, [nextExpected, mistakes, phase, numbers, sessionSeed, sessionStarted, didFinish, difficulty, isDaily, dailyDateISO, dailySeed, startedAtISO]);

  // Checkpoint every 30 s + save on unmount (handles back-navigation mid-game).
  useEffect(() => {
    const id = setInterval(() => {
      const p = focusPersistRef.current;
      if (p?.started && !p.didFinish) saveFocusGridState(p);
    }, 30_000);
    return () => {
      clearInterval(id);
      const p = focusPersistRef.current;
      if (p?.started && !p.didFinish) saveFocusGridState(p);
    };
  }, []);

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
        rewardMultiplier: sessionResult.completed ? 1 : correctTaps === 0 ? 0 : 0.5,
        streakPolicy: sessionResult.completed ? 'increment' : 'keep',
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

      if (sessionResult.completed) void playVictoryFeedback();
      else void playDefeatFeedback();

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
      if (completionResult.streakBonus.granted) {
        void playStreakBonusFeedback();
      }
      setResultSummary({
        elapsedMs,
        score: finalizedResult.score,
        mistakes,
        accuracy: finalizedResult.accuracy,
        completionTimeMs: finalizedResult.completionTimeMs,
        won: finalizedResult.completed,
        xpGained: completionResult.earnedXp,
        spGained: completionResult.earnedSp,
        performance: finalizedResult.performance,
        gameResult: finalizedResult.gameResult,
        sessionStreak: completionResult.sessionStreak,
        streakBonusTitle: completionResult.streakBonus.granted
          ? `🔥 RACHA x${completionResult.streakBonus.milestone ?? completionResult.sessionStreak} COMPLETADA`
          : undefined,
        streakBonusLabel: completionResult.streakBonus.granted
          ? `+${completionResult.streakBonus.xp} XP · ${formatNeuroCoinRewardCompact(completionResult.streakBonus.sp)}`
          : undefined,
        rewardChest: completionResult.rewardChest,
      });
      setXpTotal((prev) => prev + completionResult.earnedXp);
      setNeuroCoins((prev) => prev + completionResult.earnedSp);
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
        void playSuccessFeedback();
        setCorrectTaps((prev) => prev + 1);
        setTimeLeft((prev) => applyFocusGridCorrectTimeBonus(prev, config.totalSeconds));
        applyTapFeedback({ type: 'correct', value });

        if (value >= totalCells) {
          finishSession('completed');
          return;
        }

        setNextExpected((prev) => prev + 1);
        return;
      }

      setMistakes((prev) => prev + 1);
      void playErrorFeedback();
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
    clearHint();
    if (sessionStarted && !didFinish) {
      resetSessionStreak();
    }
    navigation.navigate(isDaily ? 'DailyChallenge' : 'Games');
  }, [clearFeedback, clearHint, didFinish, isDaily, navigation, sessionStarted]);

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
        <PlayerEconomyBar compact xp={xpTotal} neuroCoins={neuroCoins} />
        <Card
          variant="primary"
          style={{
            borderWidth: 1.6,
            borderColor: 'rgba(34,211,238,0.58)',
            backgroundColor: theme.colors.bg1,
            shadowColor: '#22D3EE',
            shadowOpacity: 0.16,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, flexShrink: 1 }]}>Focus Grid · {difficultyLabel(difficulty)}</Text>
            <TimerDisplay timeLeft={timeLeft} showAlarmIn={5} maxTime={config.totalSeconds} compact align="right" />
          </View>
          <View style={{ marginTop: 8 }}>
            {isDaily ? <Text style={{ color: theme.colors.warning, fontWeight: '700' }}>Reto diario</Text> : null}
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Grid: {config.gridSize}x{config.gridSize}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Siguiente: {Math.min(nextExpected, totalCells)} · Fallos: {mistakes} · Precisión: {accuracy}%
          </Text>
        </Card>

        {!dailyBlockedReason ? (
          <View style={{ gap: 6 }}>
            <NeuroCoinActionButton
              label="Mostrar"
              icon="👁"
              cost={NEURO_COIN_COSTS.focusGridRevealNext}
              usesLeft={revealUsesLeft}
              disabled={!canReveal}
              onPress={handleRevealNext}
              tone="blue"
            />
            {revealFeedback ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{revealFeedback}</Text> : null}
          </View>
        ) : null}

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
            {phase === 'playing' ? (
              <Text style={[theme.typography.body, { color: theme.colors.text, textAlign: 'center', marginTop: 6 }]}>
                {`Siguiente: ${Math.min(nextExpected, totalCells)}`}
              </Text>
            ) : null}

            <FocusGridBoard
              numbers={numbers}
              nextExpected={nextExpected}
              hintedValue={hintedValue}
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
            style={{ flex: 1, minHeight: 44 }}
          />
          <Button
            title="Reiniciar"
            variant="ghost"
            onPress={restart}
            disabled={isDaily || !!dailyBlockedReason}
            style={{ flex: 1, minHeight: 44 }}
          />
          <Button
            title="Salir"
            variant="primary"
            onPress={exitGame}
            style={{ flex: 1, minHeight: 44, backgroundColor: theme.colors.red, borderColor: theme.colors.red }}
          />
        </View>
      </Screen>

      <FocusGridResultModal
        visible={resultVisible}
        resultSummary={resultSummary}
        onClose={() => setResultVisible(false)}
        onNextChallenge={() => {
          setResultVisible(false);
          navigateToNextChallenge(navigation, 'focusgrid', difficulty);
        }}
        onRestart={() => {
          setResultVisible(false);
          restart();
        }}
        onViewLeaderboard={() => {
          setResultVisible(false);
          navigation.navigate('Leaderboard');
        }}
        onExit={() => {
          setResultVisible(false);
          exitGame();
        }}
      />
    </>
  );
}
