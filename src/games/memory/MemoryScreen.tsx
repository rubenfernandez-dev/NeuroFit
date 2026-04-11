import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { buildDeck, getMemoryDifficultyConfig } from './logic/deck';
import { applyMemoryAttempt, computeMemoryRewardScore } from './logic/scoring';
import MemoryCard from './components/MemoryCard';
import { clearMemoryState, getMemoryState, saveMemoryState } from './storage/memoryState';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { playErrorFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

type ResultSummary = {
  score: number;
  rewardScore: number;
  bestStreak: number;
  mismatches: number;
  earnedXp: number;
  earnedSp: number;
  elapsedMs: number;
  attempts: number;
};

export default function MemoryScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'principiante') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;

  const [cards, setCards] = useState<ReturnType<typeof buildDeck>>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [mismatches, setMismatches] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lockInput, setLockInput] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memoryConfig = useMemo(() => getMemoryDifficultyConfig(difficulty), [difficulty]);
  const { cols } = memoryConfig;

  const clearPreviewTimer = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  const clearMismatchTimer = () => {
    if (mismatchTimerRef.current) {
      clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
  };

  const startPreviewWindow = () => {
    clearPreviewTimer();
    setPreviewActive(true);
    setLockInput(true);

    previewTimerRef.current = setTimeout(() => {
      setPreviewActive(false);
      setLockInput(false);
      previewTimerRef.current = null;
    }, memoryConfig.previewTimeMs);
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

        if (!expectedStage || expectedStage.gameId !== 'memory') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'memory' });
      }

      const saved = await getMemoryState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setCards(saved.cards);
        setFlipped(saved.flipped);
        setMatched(saved.matched);
        setAttempts(saved.attempts);
        setMismatches(saved.mismatches ?? 0);
        setCurrentStreak(saved.currentStreak ?? 0);
        setBestStreak(saved.bestStreak ?? 0);
        setRoundScore(saved.roundScore ?? 0);
        setElapsedMs(saved.elapsedMs);
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));
        setPreviewActive(false);
        setLockInput(false);

        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }

        return;
      }
      if (!mounted) return;
      setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
      setFlipped([]);
      setMatched([]);
      setAttempts(0);
      setMismatches(0);
      setCurrentStreak(0);
      setBestStreak(0);
      setRoundScore(0);
      setElapsedMs(0);
      setDidFinish(false);
      setResultVisible(false);
      setResultSummary(null);
      setSessionStarted(true);
      startPreviewWindow();
      await trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
    };
    init();

    return () => {
      mounted = false;
      clearPreviewTimer();
      clearMismatchTimer();
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, stageIndex, memoryConfig.previewTimeMs]);

  useEffect(() => {
    if (!sessionStarted || cards.length === 0 || didFinish || dailyBlockedReason) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, cards.length, didFinish, dailyBlockedReason]);

  useEffect(() => {
    if (!cards.length) return;
    saveMemoryState({
      cards,
      flipped,
      matched,
      attempts,
      mismatches,
      currentStreak,
      bestStreak,
      roundScore,
      elapsedMs,
      difficulty,
      isDaily,
      dailyDateISO,
      seed: dailySeed,
      sessionStarted,
      didFinish,
    });
  }, [cards, flipped, matched, attempts, mismatches, currentStreak, bestStreak, roundScore, elapsedMs, difficulty, isDaily, dailyDateISO, dailySeed, sessionStarted, didFinish]);

  const isComplete = useMemo(() => cards.length > 0 && matched.length === cards.length, [cards.length, matched.length]);

  useEffect(() => {
    if (!isComplete || finishing || didFinish) return;
    const finalize = async () => {
      setFinishing(true);
      setDidFinish(true);
      const totalPairs = cards.length / 2;
      const rewardScore = computeMemoryRewardScore({
        totalPairs,
        attempts,
        matches: totalPairs,
        bestStreak,
        rawScore: roundScore,
      });
      await trackWin({
        gameId: 'memory',
        mode: isDaily ? 'daily' : 'normal',
        difficulty,
        durationMs: elapsedMs,
        score: rewardScore,
      });
      const completionResult = await completeGameSession({
        gameId: 'memory',
        difficulty,
        mode: isDaily ? 'daily' : 'normal',
        won: true,
        stageIndex,
        metrics: {
          durationMs: elapsedMs,
          score: rewardScore,
          mistakes: mismatches,
        },
      });

      if (isDaily && completionResult.dailyCompletion) {
        void playVictoryFeedback();
        await clearMemoryState();
        setSessionStarted(false);
        setFinishing(false);

        navigation.replace('DailyChallenge', {
          completion: completionResult.dailyCompletion,
        });
        return;
      }

      await clearMemoryState();
      setSessionStarted(false);
      void playVictoryFeedback();
      setResultSummary({
        score: roundScore,
        rewardScore,
        bestStreak,
        mismatches,
        earnedXp: completionResult.earnedXp,
        earnedSp: completionResult.earnedSp,
        elapsedMs,
        attempts,
      });
      setResultVisible(true);
      setFinishing(false);
    };
    finalize();
  }, [isComplete, finishing, didFinish, cards.length, attempts, bestStreak, difficulty, elapsedMs, isDaily, mismatches, roundScore]);

  const onCardPress = (index: number) => {
    if (dailyBlockedReason) return;
    if (previewActive || lockInput || flipped.includes(index) || matched.includes(index)) return;
    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const [a, b] = nextFlipped;
      const match = cards[a].pairId === cards[b].pairId;
      const nextRound = applyMemoryAttempt(
        {
          score: roundScore,
          streak: currentStreak,
          bestStreak,
          matches: matched.length / 2,
          mismatches,
          attempts,
        },
        match,
      );

      setAttempts(nextRound.attempts);
      setMismatches(nextRound.mismatches);
      setCurrentStreak(nextRound.streak);
      setBestStreak(nextRound.bestStreak);
      setRoundScore(nextRound.score);

      if (match) {
        void playSuccessFeedback();
        setMatched((prev) => [...prev, a, b]);
        setFlipped([]);
      } else {
        void playErrorFeedback();
        clearMismatchTimer();
        if (memoryConfig.mismatchLockMs <= 0) {
          setFlipped([]);
          return;
        }

        setLockInput(true);
        mismatchTimerRef.current = setTimeout(() => {
          setFlipped([]);
          setLockInput(false);
          mismatchTimerRef.current = null;
        }, memoryConfig.mismatchLockMs);
      }
    }
  };

  const restart = () => {
    if (isDaily) return;
    setCards(buildDeck(difficulty, isDaily ? dailySeed : undefined));
    setFlipped([]);
    setMatched([]);
    setAttempts(0);
    setMismatches(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setRoundScore(0);
    setElapsedMs(0);
    setDidFinish(false);
    setResultVisible(false);
    setResultSummary(null);
    setSessionStarted(true);
    setLockInput(false);
    startPreviewWindow();
    trackSessionStart({ gameId: 'memory', mode: isDaily ? 'daily' : 'normal' });
  };

  return (
    <>
    <Screen>
      <Card variant="cyan">
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Memory · {difficultyLabel(difficulty)}</Text>
        <View style={{ marginTop: 8 }}>
          <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Tiempo: {msToClock(elapsedMs)} · Intentos: {attempts}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Puntos: {roundScore} · Racha: x{Math.max(1, currentStreak)} · Fallos: {mismatches}
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {cards.map((card, index) => (
          <MemoryCard
            key={card.id}
            emoji={card.emoji}
            isFaceUp={previewActive || flipped.includes(index)}
            isMatched={matched.includes(index)}
            onPress={() => onCardPress(index)}
          />
        ))}
        </View>
      ) : null}

      <Button title="Reiniciar" onPress={restart} disabled={isDaily || !!dailyBlockedReason} />
    </Screen>
    <GameResultModal
      visible={resultVisible}
      onRequestClose={() => setResultVisible(false)}
      variant="victory"
      title="¡Memory completado!"
      subtitle="Gran memoria visual, sigue sumando racha."
      metrics={[
        { label: 'Score ronda', value: resultSummary?.score ?? 0 },
        { label: 'Score recompensa', value: resultSummary?.rewardScore ?? 0 },
        { label: 'Mejor racha', value: resultSummary?.bestStreak ?? 0 },
        { label: 'Intentos', value: resultSummary?.attempts ?? 0 },
        { label: 'Fallos', value: resultSummary?.mismatches ?? 0 },
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