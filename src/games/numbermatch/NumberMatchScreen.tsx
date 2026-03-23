import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import Screen from '../../shared/ui/Screen';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import Pill from '../../shared/ui/Pill';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock, nowISO } from '../../shared/utils/time';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { trackNumberMatchResult, trackSessionStart } from '../../shared/storage/stats';
import { playDefeatFeedback, playErrorFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';
import {
  addLineFromRemaining,
  canValuesMatch,
  computeBoardClearedPercent,
  computeRewardScoreNumberMatch,
  createInitialBoard,
  getNumberMatchConfig,
  hasAnyValidMove,
  isValidMatchConnection,
} from './logic';
import { clearNumberMatchState, getNumberMatchState, saveNumberMatchState } from './numberMatchState';
import { NumberMatchFinishReason, NumberMatchGameResult } from './types';
import { computePerformanceFromScore } from '../../core/gamification/economy';

type Props = NativeStackScreenProps<RootStackParamList, 'NumberMatch'>;

type Phase = 'idle' | 'playing' | 'finished';

type FeedbackPair = {
  kind: 'valid' | 'invalid';
  a: number;
  b: number;
};

type ResultSummary = {
  elapsedMs: number;
  rewardScore: number;
  score: number;
  validMatches: number;
  invalidMatches: number;
  bestCombo: number;
  boardClearedPercent: number;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: NumberMatchGameResult;
};

function getSessionSeed(isDaily: boolean, dailySeed?: number): number {
  if (isDaily && typeof dailySeed === 'number') return Math.max(1, Math.floor(dailySeed));
  return Math.max(1, Math.floor(Date.now() % 2_147_483_647));
}

export default function NumberMatchScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const gameRoute = normalizeGameRouteParams(route.params);
  const difficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const config = useMemo(() => getNumberMatchConfig(difficulty), [difficulty]);
  const cellCount = config.rows * config.cols;
  const mountedRef = useRef(true);

  const [sessionSeed, setSessionSeed] = useState(getSessionSeed(isDaily, dailySeed));
  const [startedAtISO, setStartedAtISO] = useState(nowISO());
  const [board, setBoard] = useState<Array<number | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedbackPair, setFeedbackPair] = useState<FeedbackPair | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [score, setScore] = useState(0);
  const [validMatches, setValidMatches] = useState(0);
  const [invalidMatches, setInvalidMatches] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lastValidAtMs, setLastValidAtMs] = useState(0);

  const [timeLeft, setTimeLeft] = useState(config.totalSeconds);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedbackPair(null);
  }, []);

  const applyPairFeedback = useCallback((next: FeedbackPair) => {
    clearFeedback();
    setFeedbackPair(next);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackPair(null);
      feedbackTimerRef.current = null;
    }, 320);
  }, [clearFeedback]);

  const prepareFreshSession = useCallback((nextSeed: number) => {
    const nextBoard = createInitialBoard(config.rows, config.cols, config.initialFilled, nextSeed);
    setSessionSeed(nextSeed);
    setStartedAtISO(nowISO());
    setBoard(nextBoard);
    setSelectedIndex(null);
    clearFeedback();
    setScore(0);
    setValidMatches(0);
    setInvalidMatches(0);
    setCombo(0);
    setBestCombo(0);
    setLastValidAtMs(0);
    setTimeLeft(config.totalSeconds);
    setPhase('idle');
    setSessionStarted(true);
    setDidFinish(false);
    setFinishing(false);
    setResultVisible(false);
    setResultSummary(null);
  }, [clearFeedback, config.cols, config.initialFilled, config.rows, config.totalSeconds]);

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
        // TODO(numbermatch-daily): numbermatch aun no forma parte del pool diario.
        setDailyBlockedReason('Number Match aun no esta habilitado para Reto diario.');
        Alert.alert('No disponible en diario', 'Number Match aun no esta habilitado para Reto diario.');
        return;
      }

      const saved = await getNumberMatchState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setStartedAtISO(saved.startedAtISO);
        setBoard(saved.board);
        setSelectedIndex(saved.selectedIndex);
        setScore(saved.score);
        setValidMatches(saved.validMatches);
        setInvalidMatches(saved.invalidMatches);
        setCombo(saved.combo);
        setBestCombo(saved.bestCombo);
        setTimeLeft(saved.timeLeft);
        setSessionSeed(saved.sessionSeed);
        setSessionStarted(Boolean(saved.started));
        setDidFinish(Boolean(saved.didFinish));
        setPhase(saved.phase === 'finished' ? 'finished' : saved.phase);

        if (!saved.started) {
          await trackSessionStart({ gameId: 'numbermatch', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      if (!mounted) return;
      const nextSeed = getSessionSeed(isDaily, dailySeed);
      prepareFreshSession(nextSeed);
      await trackSessionStart({ gameId: 'numbermatch', mode: isDaily ? 'daily' : 'normal' });
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

  const numberPersistRef = useRef<Parameters<typeof saveNumberMatchState>[0] | null>(null);
  numberPersistRef.current = sessionStarted && board.length > 0
    ? {
        startedAtISO,
        board,
        selectedIndex,
        score,
        validMatches,
        invalidMatches,
        combo,
        bestCombo,
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

  useEffect(() => {
    const p = numberPersistRef.current;
    if (!p) return;
    saveNumberMatchState(p);
  }, [board, selectedIndex, score, validMatches, invalidMatches, combo, bestCombo, phase, difficulty, isDaily, dailyDateISO, dailySeed, sessionStarted, didFinish, timeLeft, sessionSeed, startedAtISO]);

  useEffect(() => {
    const id = setInterval(() => {
      const p = numberPersistRef.current;
      if (p?.started && !p.didFinish) saveNumberMatchState(p);
    }, 20_000);

    return () => {
      clearInterval(id);
      const p = numberPersistRef.current;
      if (p?.started && !p.didFinish) saveNumberMatchState(p);
    };
  }, []);

  const finishSession = useCallback(async (reason: NumberMatchFinishReason) => {
    if (finishing || didFinish) return;
    setFinishing(true);
    setDidFinish(true);
    setPhase('finished');
    clearFeedback();

    const elapsedMs = Math.max(0, (config.totalSeconds - timeLeft) * 1000);
    const boardClearedPercent = computeBoardClearedPercent(board);
    const rewardScore = computeRewardScoreNumberMatch({
      score,
      validMatches,
      invalidMatches,
      bestCombo,
      boardClearedPercent,
    });

    await trackNumberMatchResult({
      gameId: 'numbermatch',
      score: rewardScore,
      validMatches,
      invalidMatches,
      bestCombo,
      boardClearedPercent,
      durationMs: elapsedMs,
      won: boardClearedPercent >= 85,
    });

    const completionResult = await completeGameSession({
      gameId: 'numbermatch',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won: boardClearedPercent >= 85,
      stageIndex,
      metrics: {
        durationMs: elapsedMs,
        score: rewardScore,
        mistakes: invalidMatches,
      },
    });

    const performance = computePerformanceFromScore(rewardScore, difficulty);
    const gameResult: NumberMatchGameResult = {
      gameId: 'numbermatch',
      difficulty,
      startedAt: startedAtISO,
      completedAt: nowISO(),
      metrics: {
        score: rewardScore,
        validMatches,
        invalidMatches,
        bestCombo,
        boardClearedPercent,
      },
      xpGained: completionResult.earnedXp,
      spGained: completionResult.earnedSp,
      performance,
    };

    if (boardClearedPercent >= 85) void playVictoryFeedback();
    else void playDefeatFeedback();

    if (isDaily && completionResult.dailyCompletion) {
      await clearNumberMatchState();
      setSessionStarted(false);
      setFinishing(false);

      navigation.replace('DailyChallenge', {
        completion: completionResult.dailyCompletion,
      });
      return;
    }

    await clearNumberMatchState();
    setSessionStarted(false);
    setResultSummary({
      elapsedMs,
      rewardScore,
      score,
      validMatches,
      invalidMatches,
      bestCombo,
      boardClearedPercent,
      xpGained: completionResult.earnedXp,
      spGained: completionResult.earnedSp,
      performance,
      gameResult,
    });
    setResultVisible(true);
    setFinishing(false);
  }, [bestCombo, board, clearFeedback, config.totalSeconds, didFinish, difficulty, finishing, invalidMatches, isDaily, navigation, score, stageIndex, startedAtISO, timeLeft, validMatches]);

  useEffect(() => {
    if (!sessionStarted || didFinish || timeLeft > 0 || phase !== 'playing') return;
    finishSession('timeout');
  }, [didFinish, finishSession, phase, sessionStarted, timeLeft]);

  useEffect(() => {
    if (!sessionStarted || phase !== 'playing' || didFinish) return;
    if (board.every((cell) => cell !== null)) {
      finishSession('board_full');
    }
  }, [board, didFinish, finishSession, phase, sessionStarted]);

  const handleCellPress = useCallback((index: number) => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;

    const value = board[index];
    if (value === null) return;

    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }

    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }

    const selectedValue = board[selectedIndex];
    if (selectedValue === null) {
      setSelectedIndex(index);
      return;
    }

    const valueMatches = canValuesMatch(selectedValue, value);
    const pathMatches = isValidMatchConnection(board, selectedIndex, index, config.cols);

    if (valueMatches && pathMatches) {
      void playSuccessFeedback();
      applyPairFeedback({ kind: 'valid', a: selectedIndex, b: index });

      const now = Date.now();
      const nextCombo = lastValidAtMs > 0 && now - lastValidAtMs <= 2500 ? combo + 1 : 1;
      const comboBonus = nextCombo > 1 ? (nextCombo - 1) * 2 : 0;

      setLastValidAtMs(now);
      setCombo(nextCombo);
      setBestCombo((prev) => Math.max(prev, nextCombo));
      setValidMatches((prev) => prev + 1);
      setScore((prev) => prev + 10 + comboBonus);
      setBoard((prev) => {
        const next = [...prev];
        next[selectedIndex] = null;
        next[index] = null;
        return next;
      });
      setSelectedIndex(null);
      return;
    }

    void playErrorFeedback();
    applyPairFeedback({ kind: 'invalid', a: selectedIndex, b: index });
    setInvalidMatches((prev) => prev + 1);
    setCombo(0);
    setSelectedIndex(index);
  }, [applyPairFeedback, board, combo, config.cols, dailyBlockedReason, didFinish, finishing, lastValidAtMs, phase, selectedIndex]);

  const startGame = useCallback(() => {
    if (dailyBlockedReason || didFinish || board.length === 0) return;
    if (phase !== 'playing') setPhase('playing');
  }, [board.length, dailyBlockedReason, didFinish, phase]);

  const addLine = useCallback(() => {
    if (dailyBlockedReason || didFinish || finishing || phase !== 'playing') return;
    const result = addLineFromRemaining(board, config.addLineCount);
    if (result.added <= 0) {
      finishSession('board_full');
      return;
    }

    setBoard(result.nextBoard);
    setSelectedIndex(null);
    setCombo(0);

    if (!hasAnyValidMove(result.nextBoard, config.cols) && result.nextBoard.every((cell) => cell !== null)) {
      finishSession('board_full');
    }
  }, [board, config.addLineCount, config.cols, dailyBlockedReason, didFinish, finishSession, finishing, phase]);

  const restart = useCallback(async () => {
    if (isDaily) return;
    clearFeedback();
    const nextSeed = getSessionSeed(false);
    prepareFreshSession(nextSeed);
    await trackSessionStart({ gameId: 'numbermatch', mode: 'normal' });
  }, [clearFeedback, isDaily, prepareFreshSession]);

  const exitGame = useCallback(() => {
    clearFeedback();
    navigation.navigate(isDaily ? 'DailyChallenge' : 'Games');
  }, [clearFeedback, isDaily, navigation]);

  const boardClearedPercent = computeBoardClearedPercent(board);

  return (
    <>
      <Screen>
        <Card variant="primary">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Number Match · {difficultyLabel(difficulty)}</Text>
          <View style={{ marginTop: 8 }}>
            <Pill
              label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`}
              tone={isDaily ? 'warning' : 'default'}
            />
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            Tiempo: {msToClock(timeLeft * 1000)} · Puntaje: {score} · Combo: x{Math.max(1, combo)}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Matches validos: {validMatches} · Invalidos: {invalidMatches} · Limpieza: {boardClearedPercent}%
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
              Empareja numeros iguales o que sumen 10. Deben estar conectados por fila/columna sin bloqueos.
            </Text>

            <View style={{ marginTop: 12, alignSelf: 'center' }}>
              {Array.from({ length: config.rows }).map((_, row) => (
                <View key={`row-${row}`} style={{ flexDirection: 'row' }}>
                  {Array.from({ length: config.cols }).map((__, col) => {
                    const index = row * config.cols + col;
                    const value = board[index];
                    const isSelected = selectedIndex === index;
                    const feedback = feedbackPair && (feedbackPair.a === index || feedbackPair.b === index) ? feedbackPair.kind : null;

                    return (
                      <Pressable
                        key={`cell-${index}`}
                        onPress={() => handleCellPress(index)}
                        style={{
                          width: 38,
                          height: 38,
                          margin: 2,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor:
                            feedback === 'valid'
                              ? theme.colors.green
                              : feedback === 'invalid'
                                ? theme.colors.red
                                : isSelected
                                  ? theme.colors.primary
                                  : theme.colors.border,
                          backgroundColor: value === null ? theme.colors.bg1 : theme.colors.surface,
                          opacity: value === null ? 0.4 : 1,
                        }}
                      >
                        <Text style={[theme.typography.body, { color: value === null ? theme.colors.textMuted : theme.colors.text }]}>
                          {value === null ? '' : value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={phase === 'idle' || phase === 'finished' ? 'Empezar' : 'En juego'}
            onPress={startGame}
            disabled={!!dailyBlockedReason || didFinish || phase === 'playing'}
            style={{ flex: 1 }}
          />
          <Button title="Anadir linea" variant="secondary" onPress={addLine} disabled={!!dailyBlockedReason || phase !== 'playing' || didFinish} style={{ flex: 1 }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Reintentar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} style={{ flex: 1 }} />
          <Button title="Salir" variant="secondary" onPress={exitGame} style={{ flex: 1 }} />
        </View>
      </Screen>

      <GameResultModal
        visible={resultVisible}
        onRequestClose={() => setResultVisible(false)}
        variant={resultSummary && resultSummary.boardClearedPercent >= 85 ? 'victory' : 'defeat'}
        title={resultSummary && resultSummary.boardClearedPercent >= 85 ? 'Muy bien jugado' : 'Sesion finalizada'}
        subtitle="Number Match"
        metrics={[
          { label: 'Score recompensa', value: resultSummary?.rewardScore ?? 0 },
          { label: 'Matches validos', value: resultSummary?.validMatches ?? 0 },
          { label: 'Matches invalidos', value: resultSummary?.invalidMatches ?? 0 },
          { label: 'Mejor combo', value: resultSummary?.bestCombo ?? 0 },
          { label: 'Tablero despejado', value: `${resultSummary?.boardClearedPercent ?? 0}%` },
          { label: 'XP', value: resultSummary?.xpGained ?? 0 },
          { label: 'SP', value: resultSummary?.spGained ?? 0 },
        ]}
        primaryAction={{
          label: 'Reintentar',
          onPress: () => {
            setResultVisible(false);
            void restart();
          },
        }}
        secondaryAction={{
          label: 'Salir',
          onPress: () => {
            setResultVisible(false);
            exitGame();
          },
        }}
      />
    </>
  );
}
