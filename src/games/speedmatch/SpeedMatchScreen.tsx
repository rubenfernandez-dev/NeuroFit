import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { computeSpeedMatchRewardScore, evaluateSpeedMatchWin, getSpeedMatchConfig } from './logic';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import TimerDisplay from '../../shared/ui/TimerDisplay';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { createSeededRng, pickOne } from '../../shared/utils/random';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import { clearSpeedMatchState, getSpeedMatchState, saveSpeedMatchState } from './storage/speedmatchState';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { playDefeatFeedback, playErrorFeedback, playStreakBonusFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';
import { navigateToNextChallenge } from '../../shared/session/challengeNavigation';
import { NEURO_COIN_COSTS } from '../../shared/economy/neuroCoinCosts';
import { spendNeuroCoins } from '../../shared/economy/neuroCoinService';
import NeuroCoinActionButton from '../../shared/economy/NeuroCoinActionButton';
import { formatNeuroCoinRewardCompact } from '../../shared/economy/neuroCoins';
import PlayerEconomyBar from '../../shared/economy/PlayerEconomyBar';
import { useNeuroCoinFeedback } from '../../shared/economy/useNeuroCoinFeedback';
import { RewardChestGrant } from '../../shared/gamification/rewardChest';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeedMatch'>;

type ResultSummary = {
  earnedXp: number;
  earnedSp: number;
  elapsedMs: number;
  correct: number;
  mistakes: number;
  score: number;
  won: boolean;
  accuracyPct: number;
  sessionStreak: number;
  streakBonusTitle?: string;
  streakBonusLabel?: string;
  rewardChest?: RewardChestGrant;
};

const SYMBOL_LIBRARY = ['●', '■', '▲', '◆', '★', '✚', '⬢', '◉', '☼'];

function getSessionSeed(isDaily: boolean, dailySeed?: number): number {
  if (isDaily && typeof dailySeed === 'number') {
    return Math.max(1, Math.floor(dailySeed));
  }
  return Math.max(1, Math.floor(Date.now() % 2_147_483_647));
}

function pickInitialSymbol(pool: string[], sessionSeed: number, offset: number): string {
  const rng = createSeededRng(sessionSeed + offset * 41 + 13);
  return pickOne(pool, rng);
}

function nextSymbolFrom(
  previousSymbol: string,
  pool: string[],
  sessionSeed: number,
  round: number,
  matchProbability: number,
): string {
  const rng = createSeededRng(sessionSeed + round * 101 + 17);
  const shouldMatch = rng() < matchProbability;
  if (shouldMatch) return previousSymbol;

  const alternatives = pool.filter((symbol) => symbol !== previousSymbol);
  return pickOne(alternatives.length > 0 ? alternatives : pool, rng);
}

function createSession(symbolPool: string[], config: ReturnType<typeof getSpeedMatchConfig>, sessionSeed: number) {
  const previousSymbol = pickInitialSymbol(symbolPool, sessionSeed, 0);
  const currentSymbol = nextSymbolFrom(previousSymbol, symbolPool, sessionSeed, 1, config.matchProbability);

  return {
    previousSymbol,
    currentSymbol,
    round: 1,
    correct: 0,
    mistakes: 0,
    score: 0,
    timeLeft: config.durationSec,
    sessionSeed,
    sessionStarted: true,
    didFinish: false,
  };
}

export default function SpeedMatchScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const config = getSpeedMatchConfig(difficulty);
  const symbolPool = useMemo(() => SYMBOL_LIBRARY.slice(0, config.symbolCount), [config.symbolCount]);

  const [previousSymbol, setPreviousSymbol] = useState('');
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.durationSec);
  const [sessionSeed, setSessionSeed] = useState(getSessionSeed(isDaily, dailySeed));
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);
  const [inputLocked, setInputLocked] = useState(false);
  const [xpTotal, setXpTotal] = useState(0);
  const [neuroCoins, setNeuroCoins] = useState(0);
  const [extraTimeUses, setExtraTimeUses] = useState(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { message: economyFeedback, showNeuroCoinError, showNeuroCoinSpendFeedback, clearFeedback: clearEconomyFeedback } = useNeuroCoinFeedback();
  const MAX_EXTRA_TIME_USES = 2;

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

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

        if (!expectedStage || expectedStage.gameId !== 'speedmatch') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'speedmatch' });
      }

      const profile = await getProfile();
      if (!mounted) return;
      setXpTotal(profile.xpTotal);
      setNeuroCoins(profile.seasonPoints);

      const saved = await getSpeedMatchState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;

        setPreviousSymbol(saved.previousSymbol);
        setCurrentSymbol(saved.currentSymbol);
        setRound(saved.round);
        setCorrect(saved.correct);
        setMistakes(saved.mistakes);
        setScore(saved.score);
        setTimeLeft(saved.timeLeft);
        setSessionSeed(saved.sessionSeed);
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));

        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'speedmatch', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      const nextSeed = getSessionSeed(isDaily, dailySeed);
      const base = createSession(symbolPool, config, nextSeed);

      if (!mounted) return;
      setPreviousSymbol(base.previousSymbol);
      setCurrentSymbol(base.currentSymbol);
      setRound(base.round);
      setCorrect(base.correct);
      setMistakes(base.mistakes);
      setScore(base.score);
      setTimeLeft(base.timeLeft);
      setSessionSeed(base.sessionSeed);
      setSessionStarted(true);
      setDidFinish(false);
      setResultVisible(false);
      setResultSummary(null);
      setInputLocked(false);
      setExtraTimeUses(0);
      clearEconomyFeedback();
      await trackSessionStart({ gameId: 'speedmatch', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
      clearAdvanceTimer();
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex, config, symbolPool]);

  useEffect(() => {
    if (!sessionStarted || didFinish || dailyBlockedReason) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, didFinish, dailyBlockedReason]);

  // Ref keeps the full save payload current on every render.
  const speedPersistRef = useRef<Parameters<typeof saveSpeedMatchState>[0] | null>(null);
  speedPersistRef.current = previousSymbol && currentSymbol
    ? {
        previousSymbol,
        currentSymbol,
        round,
        correct,
        mistakes,
        score,
        timeLeft,
        sessionSeed,
        sessionStarted,
        didFinish,
        difficulty,
        isDaily,
        dailyDateISO,
        seed: dailySeed,
      }
    : null;

  // Persist on each answered round (round / correct / mistakes / score / symbols change).
  // timeLeft is excluded — it ticks every second and would otherwise cause 1 write/s.
  // It is still captured via the ref when an answer triggers a save.
  useEffect(() => {
    const p = speedPersistRef.current;
    if (!p) return;
    saveSpeedMatchState(p);
  }, [previousSymbol, currentSymbol, round, correct, mistakes, score, sessionSeed, sessionStarted, didFinish, difficulty, isDaily, dailyDateISO, dailySeed]);

  // Checkpoint every 30 s + save on unmount (handles back-navigation mid-game).
  useEffect(() => {
    const id = setInterval(() => {
      const p = speedPersistRef.current;
      if (p?.sessionStarted && !p.didFinish) saveSpeedMatchState(p);
    }, 30_000);
    return () => {
      clearInterval(id);
      const p = speedPersistRef.current;
      if (p?.sessionStarted && !p.didFinish) saveSpeedMatchState(p);
    };
  }, []);

  const finishSession = async () => {
    if (finishing || didFinish) return;
    clearAdvanceTimer();
    setInputLocked(false);
    setFinishing(true);
    setDidFinish(true);

    const elapsedMs = Math.max(0, (config.durationSec - timeLeft) * 1000);
    const totalAnswers = correct + mistakes;
    const accuracyPct = Math.round((correct / Math.max(1, totalAnswers)) * 100);
    const rewardScore = computeSpeedMatchRewardScore({
      correct,
      mistakes,
      elapsedSec: Math.max(1, Math.round(elapsedMs / 1000)),
      difficulty,
    });
    const won = evaluateSpeedMatchWin({ correct, mistakes, difficulty });
    const rewardMultiplier = won ? 1 : correct === 0 ? 0 : 0.5;

    if (won) {
      await trackWin({
        gameId: 'speedmatch',
        mode: isDaily ? 'daily' : 'normal',
        difficulty,
        durationMs: elapsedMs,
        score: rewardScore,
        mistakes,
      });
    }

    const completionResult = await completeGameSession({
      gameId: 'speedmatch',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won,
      rewardMultiplier,
      streakPolicy: won ? 'increment' : 'keep',
      stageIndex,
      metrics: {
        durationMs: elapsedMs,
        score: rewardScore,
        mistakes,
      },
      neuroScoreOverride: isDaily ? correct : undefined,
    });

    if (isDaily && completionResult.dailyCompletion) {
      if (won) void playVictoryFeedback();
      else void playDefeatFeedback();
      await clearSpeedMatchState();
      setSessionStarted(false);
      setFinishing(false);

      navigation.replace('DailyChallenge', {
        completion: completionResult.dailyCompletion,
      });
      return;
    }

    await clearSpeedMatchState();
    setSessionStarted(false);
    if (won) void playVictoryFeedback();
    else void playDefeatFeedback();
    if (completionResult.streakBonus.granted) {
      void playStreakBonusFeedback();
    }
    setResultSummary({
      earnedXp: completionResult.earnedXp,
      earnedSp: completionResult.earnedSp,
      elapsedMs,
      correct,
      mistakes,
      score: rewardScore,
      won,
      accuracyPct,
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
  };

  useEffect(() => {
    if (timeLeft === 0 && !didFinish) {
      finishSession();
    }
  }, [timeLeft, didFinish]);

  useEffect(() => {
    if (!didFinish && mistakes >= config.maxMistakes) {
      finishSession();
    }
  }, [config.maxMistakes, didFinish, mistakes]);

  const answer = (isMatchChoice: boolean) => {
    if (dailyBlockedReason || didFinish || !sessionStarted || inputLocked) return;

    const expectedMatch = previousSymbol === currentSymbol;
    const wasCorrect = isMatchChoice === expectedMatch;
    if (wasCorrect) void playSuccessFeedback();
    else void playErrorFeedback();
    const nextCorrect = wasCorrect ? correct + 1 : correct;
    const nextMistakes = wasCorrect ? mistakes : mistakes + 1;
    const nextScore = wasCorrect ? score + 10 : Math.max(0, score - 5);
    const nextRound = round + 1;
    const nextSymbol = nextSymbolFrom(
      currentSymbol,
      symbolPool,
      sessionSeed,
      nextRound,
      config.matchProbability,
    );

    setCorrect(nextCorrect);
    setMistakes(nextMistakes);
    setScore(nextScore);
    setInputLocked(true);
    clearAdvanceTimer();
    advanceTimerRef.current = setTimeout(() => {
      setPreviousSymbol(currentSymbol);
      setCurrentSymbol(nextSymbol);
      setRound(nextRound);
      setInputLocked(false);
      advanceTimerRef.current = null;
    }, config.stimulusIntervalMs);
  };

  const restart = async () => {
    if (isDaily) return;
    clearAdvanceTimer();
    const nextSeed = getSessionSeed(false);
    const base = createSession(symbolPool, config, nextSeed);

    setPreviousSymbol(base.previousSymbol);
    setCurrentSymbol(base.currentSymbol);
    setRound(base.round);
    setCorrect(base.correct);
    setMistakes(base.mistakes);
    setScore(base.score);
    setTimeLeft(base.timeLeft);
    setSessionSeed(base.sessionSeed);
    setDidFinish(false);
    setResultVisible(false);
    setResultSummary(null);
    setInputLocked(false);
    setExtraTimeUses(0);
    clearEconomyFeedback();
    setSessionStarted(true);
    await trackSessionStart({ gameId: 'speedmatch', mode: 'normal' });
  };

  const handleBuyExtraTime = async () => {
    if (dailyBlockedReason || didFinish || extraTimeUses >= MAX_EXTRA_TIME_USES) return;

    const spendResult = await spendNeuroCoins(NEURO_COIN_COSTS.speedMatchExtraTime, 'speed_match_extra_time');
    if (!spendResult.success) {
      showNeuroCoinError('No tienes suficientes NeuroCoins');
      return;
    }

    setTimeLeft((prev) => prev + 2);
    setNeuroCoins(spendResult.newBalance);
    setExtraTimeUses((prev) => prev + 1);
    showNeuroCoinSpendFeedback(NEURO_COIN_COSTS.speedMatchExtraTime);
  };

  const accuracyPct = Math.round((correct / Math.max(1, correct + mistakes)) * 100);

  return (
    <>
      <Screen>
        <PlayerEconomyBar compact xp={xpTotal} neuroCoins={neuroCoins} />
        <Card variant="cyan">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, flexShrink: 1 }]}>Speed Match · {difficultyLabel(difficulty)}</Text>
            <TimerDisplay timeLeft={timeLeft} showAlarmIn={5} maxTime={config.durationSec} compact align="right" />
          </View>
          <View style={{ marginTop: 8 }}>
            <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Ronda: {round}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Score: {score} · Aciertos: {correct} · Fallos: {mistakes} · Precisión: {accuracyPct}%
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Máx. fallos: {config.maxMistakes}
          </Text>
        </Card>

        {!dailyBlockedReason ? (
          <Card style={{ padding: 10 }}>
            <NeuroCoinActionButton
              label="+2s"
              icon="⏱"
              cost={NEURO_COIN_COSTS.speedMatchExtraTime}
              usesLeft={MAX_EXTRA_TIME_USES - extraTimeUses}
              disabled={didFinish || extraTimeUses >= MAX_EXTRA_TIME_USES}
              onPress={handleBuyExtraTime}
            />
            {economyFeedback ? <Text style={{ color: theme.colors.textMuted, marginTop: 6, fontSize: 12 }}>{economyFeedback}</Text> : null}
          </Card>
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
          <Card variant="primary" style={{ alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Anterior</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 40, marginTop: 6 }}>{previousSymbol}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 14 }]}>Actual</Text>
            <Text style={{ color: theme.colors.text, fontSize: 74, marginTop: 4 }}>{currentSymbol}</Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 8 }]}>¿Coincide con el símbolo anterior?</Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 4 }]}>Ritmo: {Math.round(1000 / config.stimulusIntervalMs * 10) / 10} est./s</Text>

            <View style={{ marginTop: 14, width: '100%', flexDirection: 'row', gap: 10 }}>
              <Button title="Match" onPress={() => answer(true)} style={{ flex: 1 }} disabled={inputLocked} />
              <Button title="No Match" variant="secondary" onPress={() => answer(false)} style={{ flex: 1 }} disabled={inputLocked} />
            </View>
          </Card>
        ) : null}

        <Button title="Reiniciar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
      </Screen>

      <GameResultModal
        visible={resultVisible}
        onRequestClose={() => setResultVisible(false)}
        variant={resultSummary?.won ? 'victory' : 'defeat'}
        title={resultSummary?.won ? '¡Sesión completada!' : 'Sesión finalizada'}
        subtitle={resultSummary?.won ? 'Buen foco y velocidad de decisión.' : 'No se alcanzó el umbral mínimo de rendimiento.'}
        metrics={[
          { label: 'Score', value: resultSummary?.score ?? 0 },
          { label: 'Aciertos', value: resultSummary?.correct ?? 0 },
          { label: 'Fallos', value: resultSummary?.mistakes ?? 0 },
          { label: 'Precisión', value: `${resultSummary?.accuracyPct ?? 0}%` },
          { label: 'Tiempo', value: msToClock(resultSummary?.elapsedMs ?? 0) },
          { label: 'XP', value: `+${resultSummary?.earnedXp ?? 0}` },
          { label: 'NC 🪙', value: formatNeuroCoinRewardCompact(resultSummary?.earnedSp ?? 0) },
        ]}
        sessionStreak={resultSummary?.sessionStreak ?? 0}
        streakBonusTitle={resultSummary?.streakBonusTitle}
        streakBonusText={resultSummary?.streakBonusLabel}
        rewardChest={resultSummary?.rewardChest}
        primaryAction={{
            label: 'Siguiente reto',
          onPress: () => {
            setResultVisible(false);
              navigateToNextChallenge(navigation, 'speedmatch', difficulty);
          },
        }}
        secondaryAction={{
            label: 'Jugar de nuevo',
          variant: 'secondary',
          onPress: () => {
            setResultVisible(false);
              restart();
          },
        }}
        auxiliaryActions={[
          {
            label: 'Ver ranking local',
            variant: 'ghost',
            onPress: () => {
              setResultVisible(false);
              navigation.navigate('Leaderboard');
            },
          },
        ]}
      />
    </>
  );
}
