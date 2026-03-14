import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { createSeededRng, pickOne } from '../../shared/utils/random';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { clearSpeedMatchState, getSpeedMatchState, saveSpeedMatchState } from './storage/speedmatchState';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { playErrorFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeedMatch'>;

type ResultSummary = {
  earnedXp: number;
  earnedSp: number;
  elapsedMs: number;
  correct: number;
  mistakes: number;
  score: number;
  accuracyPct: number;
};

const MATCH_PROBABILITY = 0.35;
const SYMBOL_LIBRARY = ['●', '■', '▲', '◆', '★', '✚', '⬢', '◉', '☼'];
const SPEEDMATCH_CONFIG: Record<Difficulty, { durationSec: number; symbolCount: number }> = {
  principiante: { durationSec: 60, symbolCount: 3 },
  avanzado: { durationSec: 70, symbolCount: 4 },
  experto: { durationSec: 80, symbolCount: 5 },
  maestro: { durationSec: 95, symbolCount: 6 },
  gran_maestro: { durationSec: 110, symbolCount: 7 },
};

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

function nextSymbolFrom(previousSymbol: string, pool: string[], sessionSeed: number, round: number): string {
  const rng = createSeededRng(sessionSeed + round * 101 + 17);
  const shouldMatch = rng() < MATCH_PROBABILITY;
  if (shouldMatch) return previousSymbol;

  const alternatives = pool.filter((symbol) => symbol !== previousSymbol);
  return pickOne(alternatives.length > 0 ? alternatives : pool, rng);
}

function createSession(symbolPool: string[], durationSec: number, sessionSeed: number) {
  const previousSymbol = pickInitialSymbol(symbolPool, sessionSeed, 0);
  const currentSymbol = nextSymbolFrom(previousSymbol, symbolPool, sessionSeed, 1);

  return {
    previousSymbol,
    currentSymbol,
    round: 1,
    correct: 0,
    mistakes: 0,
    score: 0,
    timeLeft: durationSec,
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
  const config = SPEEDMATCH_CONFIG[difficulty];
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
      const base = createSession(symbolPool, config.durationSec, nextSeed);

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
      await trackSessionStart({ gameId: 'speedmatch', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex, config.durationSec, symbolPool]);

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
    setFinishing(true);
    setDidFinish(true);

    const elapsedMs = Math.max(0, (config.durationSec - timeLeft) * 1000);
    const totalAnswers = correct + mistakes;
    const accuracyPct = Math.round((correct / Math.max(1, totalAnswers)) * 100);
    const rewardScore = Math.max(0, Math.min(100, accuracyPct));

    await trackWin({
      gameId: 'speedmatch',
      mode: isDaily ? 'daily' : 'normal',
      difficulty,
      durationMs: elapsedMs,
      score: rewardScore,
      mistakes,
    });

    const completionResult = await completeGameSession({
      gameId: 'speedmatch',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won: true,
      stageIndex,
      metrics: {
        durationMs: elapsedMs,
        score: rewardScore,
        mistakes,
      },
      neuroScoreOverride: isDaily ? correct : undefined,
    });

    if (isDaily && completionResult.dailyCompletion) {
      void playVictoryFeedback();
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
    void playVictoryFeedback();
    setResultSummary({
      earnedXp: completionResult.earnedXp,
      earnedSp: completionResult.earnedSp,
      elapsedMs,
      correct,
      mistakes,
      score,
      accuracyPct,
    });
    setResultVisible(true);
    setFinishing(false);
  };

  useEffect(() => {
    if (timeLeft === 0 && !didFinish) {
      finishSession();
    }
  }, [timeLeft, didFinish]);

  const answer = (isMatchChoice: boolean) => {
    if (dailyBlockedReason || didFinish || !sessionStarted) return;

    const expectedMatch = previousSymbol === currentSymbol;
    const wasCorrect = isMatchChoice === expectedMatch;
    if (wasCorrect) void playSuccessFeedback();
    else void playErrorFeedback();
    const nextCorrect = wasCorrect ? correct + 1 : correct;
    const nextMistakes = wasCorrect ? mistakes : mistakes + 1;
    const nextScore = wasCorrect ? score + 10 : Math.max(0, score - 5);
    const nextRound = round + 1;
    const nextSymbol = nextSymbolFrom(currentSymbol, symbolPool, sessionSeed, nextRound);

    setCorrect(nextCorrect);
    setMistakes(nextMistakes);
    setScore(nextScore);
    setPreviousSymbol(currentSymbol);
    setCurrentSymbol(nextSymbol);
    setRound(nextRound);
  };

  const restart = async () => {
    if (isDaily) return;
    const nextSeed = getSessionSeed(false);
    const base = createSession(symbolPool, config.durationSec, nextSeed);

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
    setSessionStarted(true);
    await trackSessionStart({ gameId: 'speedmatch', mode: 'normal' });
  };

  const accuracyPct = Math.round((correct / Math.max(1, correct + mistakes)) * 100);

  return (
    <>
      <Screen>
        <Card variant="cyan">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Speed Match · {difficultyLabel(difficulty)}</Text>
          <View style={{ marginTop: 8 }}>
            <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Tiempo: {msToClock(timeLeft * 1000)} · Ronda: {round}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Score: {score} · Aciertos: {correct} · Fallos: {mistakes} · Precisión: {accuracyPct}%
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
          <Card variant="primary" style={{ alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Anterior</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 40, marginTop: 6 }}>{previousSymbol}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 14 }]}>Actual</Text>
            <Text style={{ color: theme.colors.text, fontSize: 74, marginTop: 4 }}>{currentSymbol}</Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 8 }]}>¿Coincide con el símbolo anterior?</Text>

            <View style={{ marginTop: 14, width: '100%', flexDirection: 'row', gap: 10 }}>
              <Button title="Match" onPress={() => answer(true)} style={{ flex: 1 }} />
              <Button title="No Match" variant="secondary" onPress={() => answer(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        <Button title="Reiniciar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
      </Screen>

      <GameResultModal
        visible={resultVisible}
        onRequestClose={() => setResultVisible(false)}
        variant="victory"
        title="¡Sesión completada!"
        subtitle="Buen foco y velocidad de decisión."
        metrics={[
          { label: 'Score', value: resultSummary?.score ?? 0 },
          { label: 'Aciertos', value: resultSummary?.correct ?? 0 },
          { label: 'Fallos', value: resultSummary?.mistakes ?? 0 },
          { label: 'Precisión', value: `${resultSummary?.accuracyPct ?? 0}%` },
          { label: 'Tiempo', value: msToClock(resultSummary?.elapsedMs ?? 0) },
          { label: 'XP', value: `+${resultSummary?.earnedXp ?? 0}` },
          { label: 'SP', value: `+${resultSummary?.earnedSp ?? 0}` },
        ]}
        primaryAction={{
          label: 'Jugar de nuevo',
          onPress: () => {
            setResultVisible(false);
            restart();
          },
        }}
        secondaryAction={{
          label: 'Ver ranking local',
          variant: 'secondary',
          onPress: () => {
            setResultVisible(false);
            navigation.navigate('Leaderboard');
          },
        }}
      />
    </>
  );
}
