import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import Screen from '../../shared/ui/Screen';
import Card from '../../shared/ui/Card';
import Button from '../../shared/ui/Button';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock, nowISO } from '../../shared/utils/time';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { trackNumberMatchResult, trackSessionStart } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import { playDefeatFeedback, playErrorFeedback, playStreakBonusFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';
import GameResultModal from '../../shared/feedback/GameResultModal';
import {
  addLineFromRemaining,
  canValuesMatch,
  compactBoard,
  computeBoardClearedPercent,
  computeRewardScoreNumberMatch,
  createInitialBoard,
  evaluateNumberMatchWin,
  getNumberMatchConfig,
  hasAnyValidMove,
  isValidMatchConnection,
} from './logic';
import { clearNumberMatchState, getNumberMatchState, saveNumberMatchState } from './numberMatchState';
import { NumberMatchFinishReason, NumberMatchGameResult } from './types';
import { computePerformanceFromScore } from '../../core/gamification/economy';
import { navigateToNextChallenge } from '../../shared/session/challengeNavigation';
import { resetSessionStreak } from '../../shared/session/sessionStreak';
import { NEURO_COIN_COSTS } from '../../shared/economy/neuroCoinCosts';
import { spendNeuroCoins } from '../../shared/economy/neuroCoinService';
import NeuroCoinActionButton from '../../shared/economy/NeuroCoinActionButton';
import HelpActionsGrid from '../../shared/economy/HelpActionsGrid';
import { formatNeuroCoinRewardCompact } from '../../shared/economy/neuroCoins';
import PlayerEconomyBar from '../../shared/economy/PlayerEconomyBar';
import { useNeuroCoinFeedback } from '../../shared/economy/useNeuroCoinFeedback';
import { RewardChestGrant } from '../../shared/gamification/rewardChest';
import { useGameBackToGames } from '../../shared/session/useBackNavigationGuards';

type Props = NativeStackScreenProps<RootStackParamList, 'NumberMatch'>;

type Phase = 'idle' | 'playing' | 'finished';

type FeedbackPair = {
  kind: 'valid' | 'invalid';
  a: number;
  b: number;
};

type SuggestedPair = {
  a: number;
  b: number;
};

function findSuggestedMove(board: Array<number | null>, cols: number): SuggestedPair | null {
  const nonEmpty = board
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  for (let i = 0; i < nonEmpty.length; i += 1) {
    for (let j = i + 1; j < nonEmpty.length; j += 1) {
      const a = nonEmpty[i];
      const b = nonEmpty[j];
      if (!canValuesMatch(a.value, b.value)) continue;
      if (isValidMatchConnection(board, a.index, b.index, cols)) {
        return { a: a.index, b: b.index };
      }
    }
  }

  return null;
}

type ResultSummary = {
  elapsedMs: number;
  rewardScore: number;
  won: boolean;
  score: number;
  validMatches: number;
  invalidMatches: number;
  bestCombo: number;
  linesUsed: number;
  boardClearedPercent: number;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: NumberMatchGameResult;
  sessionStreak: number;
  streakBonusTitle?: string;
  streakBonusLabel?: string;
  rewardChest?: RewardChestGrant;
};

function getSessionSeed(isDaily: boolean, dailySeed?: number): number {
  if (isDaily && typeof dailySeed === 'number') return Math.max(1, Math.floor(dailySeed));
  return Math.max(1, Math.floor(Date.now() % 2_147_483_647));
}

export default function NumberMatchScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  useGameBackToGames(navigation);
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
  const [suggestedPair, setSuggestedPair] = useState<SuggestedPair | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [score, setScore] = useState(0);
  const [validMatches, setValidMatches] = useState(0);
  const [invalidMatches, setInvalidMatches] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [linesUsed, setLinesUsed] = useState(0);
  const [lastValidAtMs, setLastValidAtMs] = useState(0);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [neuroCoins, setNeuroCoins] = useState(0);
  const [suggestUses, setSuggestUses] = useState(0);
  const [restoreMistakeUses, setRestoreMistakeUses] = useState(0);
  const [removeCellUses, setRemoveCellUses] = useState(0);
  const { message: economyFeedback, showNeuroCoinError, showNeuroCoinSpendFeedback, clearFeedback: clearEconomyFeedback } = useNeuroCoinFeedback();
  const MAX_SUGGEST_USES = 3;
  const MAX_RESTORE_MISTAKE_USES = 3;
  const MAX_REMOVE_CELL_USES = 3;

  const clearFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedbackPair(null);
  }, []);

  const clearSuggestion = useCallback(() => {
    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
    setSuggestedPair(null);
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
    setLinesUsed(0);
    setLastValidAtMs(0);
    setElapsedSec(0);
    setPhase('idle');
    setSessionStarted(true);
    setDidFinish(false);
    setFinishing(false);
    setResultVisible(false);
    setResultSummary(null);
    setSuggestUses(0);
    setRestoreMistakeUses(0);
    setRemoveCellUses(0);
    clearSuggestion();
    clearEconomyFeedback();
  }, [clearFeedback, config.cols, config.initialFilled, config.rows, config.totalSeconds]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearFeedback();
      clearSuggestion();
    };
  }, [clearFeedback, clearSuggestion]);

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

        if (!expectedStage || expectedStage.gameId !== 'numbermatch') {
          setDailyBlockedReason('Esta etapa no esta activa. Continua el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no esta activa. Continua desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'numbermatch' });
      }

      const profile = await getProfile();
      if (!mounted) return;
      setXpTotal(profile.xpTotal);
      setNeuroCoins(profile.seasonPoints);

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
        setLinesUsed(saved.linesUsed);
        setElapsedSec(saved.elapsedSec);
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
      setElapsedSec((prev) => prev + 1);
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
        linesUsed,
        elapsedSec,
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
  }, [board, selectedIndex, score, validMatches, invalidMatches, combo, bestCombo, linesUsed, phase, difficulty, isDaily, dailyDateISO, dailySeed, sessionStarted, didFinish, elapsedSec, sessionSeed, startedAtISO]);

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

    const elapsedMs = Math.max(0, elapsedSec * 1000);
    const boardClearedPercent = computeBoardClearedPercent(board);
    const boardEmpty = board.every((cell) => cell === null);
    const won = reason === 'no_moves'
      ? false
      : evaluateNumberMatchWin({
          boardClearedPercent,
          validMatches,
          invalidMatches,
          boardEmpty,
        });
    const rewardScore = computeRewardScoreNumberMatch({
      score,
      validMatches,
      invalidMatches,
      bestCombo,
      boardClearedPercent,
      linesUsed,
    });

    await trackNumberMatchResult({
      gameId: 'numbermatch',
      score: rewardScore,
      validMatches,
      invalidMatches,
      bestCombo,
      boardClearedPercent,
      durationMs: elapsedMs,
      won,
    });

    const completionResult = await completeGameSession({
      gameId: 'numbermatch',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won,
      rewardMultiplier: won ? 1 : validMatches === 0 ? 0 : 0.5,
      streakPolicy: won ? 'increment' : 'keep',
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

    if (won) void playVictoryFeedback();
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
    if (completionResult.streakBonus.granted) {
      void playStreakBonusFeedback();
    }
    setResultSummary({
      elapsedMs,
      rewardScore,
      won,
      score,
      validMatches,
      invalidMatches,
      bestCombo,
      linesUsed,
      boardClearedPercent,
      xpGained: completionResult.earnedXp,
      spGained: completionResult.earnedSp,
      performance,
      gameResult,
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
  }, [bestCombo, board, clearFeedback, didFinish, difficulty, elapsedSec, finishing, invalidMatches, isDaily, linesUsed, navigation, score, stageIndex, startedAtISO, validMatches]);

  useEffect(() => {
    if (!sessionStarted || phase !== 'playing' || didFinish) return;
    const boardEmpty = board.every((cell) => cell === null);
    if (boardEmpty) {
      finishSession('board_cleared');
      return;
    }

    const hasSpace = board.some((cell) => cell === null);
    const hasMove = hasAnyValidMove(board, config.cols);
    if (!hasMove && !hasSpace) {
      finishSession('no_moves');
      return;
    }

    if (!hasSpace) {
      finishSession('board_full');
    }
  }, [board, didFinish, finishSession, phase, sessionStarted]);
  // Compact board: remove all-null rows and shift content up after each board change.
  useEffect(() => {
    if (board.length === 0) return;
    const compacted = compactBoard(board, config.cols);
    if (compacted.some((v, i) => v !== board[i])) {
      clearFeedback();
      clearSuggestion();
      setBoard(compacted);
    }
  }, [board, clearFeedback, clearSuggestion, config.cols]);

  const handleCellPress = useCallback((index: number) => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;
    clearSuggestion();

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
  }, [applyPairFeedback, board, clearSuggestion, combo, config.cols, dailyBlockedReason, didFinish, finishing, lastValidAtMs, phase, selectedIndex]);

  const startGame = useCallback(() => {
    if (dailyBlockedReason || didFinish || board.length === 0) return;
    if (phase !== 'playing') setPhase('playing');
  }, [board.length, dailyBlockedReason, didFinish, phase]);

  const addLine = useCallback(() => {
    if (dailyBlockedReason || didFinish || finishing || phase !== 'playing') return;
    clearSuggestion();
    const result = addLineFromRemaining(board, config.addLineCount, config.cols);
    if (result.added <= 0) {
      const hasMove = hasAnyValidMove(board, config.cols);
      finishSession(hasMove ? 'board_full' : 'no_moves');
      return;
    }

    setBoard(result.nextBoard);
    setLinesUsed((prev) => prev + 1);
    setSelectedIndex(null);
    setCombo(0);

    if (!hasAnyValidMove(result.nextBoard, config.cols) && result.nextBoard.every((cell) => cell !== null)) {
      finishSession('board_full');
    }
  }, [board, clearSuggestion, config.addLineCount, config.cols, dailyBlockedReason, didFinish, finishSession, finishing, phase]);

  const restart = useCallback(async () => {
    if (isDaily) return;
    clearFeedback();
    clearSuggestion();
    clearEconomyFeedback();
    const nextSeed = getSessionSeed(false);
    prepareFreshSession(nextSeed);
    await trackSessionStart({ gameId: 'numbermatch', mode: 'normal' });
  }, [clearEconomyFeedback, clearFeedback, clearSuggestion, isDaily, prepareFreshSession]);

  const exitGame = useCallback(() => {
    clearFeedback();
    clearSuggestion();
    if (sessionStarted && !didFinish) {
      resetSessionStreak();
    }
    navigation.navigate(isDaily ? 'DailyChallenge' : 'Games');
  }, [clearFeedback, clearSuggestion, didFinish, isDaily, navigation, sessionStarted]);

  const handleSuggestMove = useCallback(async () => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;
    if (suggestUses >= MAX_SUGGEST_USES) return;

    const suggestion = findSuggestedMove(board, config.cols);
    if (!suggestion) {
      showNeuroCoinError('No hay movimiento disponible');
      return;
    }

    const spendResult = await spendNeuroCoins(NEURO_COIN_COSTS.numberMatchSuggestMove, 'number_match_suggest_move');
    if (!spendResult.success) {
      showNeuroCoinError('No tienes suficientes NeuroCoins');
      return;
    }

    setNeuroCoins(spendResult.newBalance);
    setSuggestUses((prev) => prev + 1);
    showNeuroCoinSpendFeedback(NEURO_COIN_COSTS.numberMatchSuggestMove);
    clearSuggestion();
    setSuggestedPair(suggestion);
    suggestionTimerRef.current = setTimeout(() => {
      setSuggestedPair(null);
      suggestionTimerRef.current = null;
    }, 1000);
  }, [board, config.cols, dailyBlockedReason, didFinish, finishing, phase, showNeuroCoinError, showNeuroCoinSpendFeedback, suggestUses, clearSuggestion]);

  const handleRestoreMistake = useCallback(async () => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;
    if (restoreMistakeUses >= MAX_RESTORE_MISTAKE_USES) return;
    if (invalidMatches <= 0) {
      showNeuroCoinError('No tienes fallos que recuperar');
      return;
    }
    const spendResult = await spendNeuroCoins(NEURO_COIN_COSTS.numberMatchRestoreMistake, 'number_match_restore_mistake');
    if (!spendResult.success) {
      showNeuroCoinError('No tienes suficientes NeuroCoins');
      return;
    }
    setNeuroCoins(spendResult.newBalance);
    setInvalidMatches((prev) => Math.max(0, prev - 1));
    setRestoreMistakeUses((prev) => prev + 1);
    showNeuroCoinSpendFeedback(NEURO_COIN_COSTS.numberMatchRestoreMistake);
  }, [dailyBlockedReason, didFinish, finishing, invalidMatches, phase, restoreMistakeUses, showNeuroCoinError, showNeuroCoinSpendFeedback]);

  const handleRemoveCell = useCallback(async () => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;
    if (removeCellUses >= MAX_REMOVE_CELL_USES) return;
    if (selectedIndex === null) {
      showNeuroCoinError('Selecciona una celda primero');
      return;
    }
    if (board[selectedIndex] === null) {
      showNeuroCoinError('La celda ya está vacía');
      return;
    }
    const spendResult = await spendNeuroCoins(NEURO_COIN_COSTS.numberMatchRemovePairFromSelected, 'number_match_remove_cell');
    if (!spendResult.success) {
      showNeuroCoinError('No tienes suficientes NeuroCoins');
      return;
    }
    const nextBoard = [...board];
    nextBoard[selectedIndex] = null;
    setBoard(nextBoard);
    setNeuroCoins(spendResult.newBalance);
    setRemoveCellUses((prev) => prev + 1);
    setSelectedIndex(null);
    showNeuroCoinSpendFeedback(NEURO_COIN_COSTS.numberMatchRemovePairFromSelected);
  }, [board, dailyBlockedReason, didFinish, finishing, phase, removeCellUses, selectedIndex, showNeuroCoinError, showNeuroCoinSpendFeedback]);

  const handlePaidAddLine = useCallback(async () => {
    if (dailyBlockedReason || phase !== 'playing' || didFinish || finishing) return;
    const spendResult = await spendNeuroCoins(NEURO_COIN_COSTS.numberMatchAddLine, 'number_match_add_line');
    if (!spendResult.success) {
      showNeuroCoinError('No tienes suficientes NeuroCoins');
      return;
    }
    setNeuroCoins(spendResult.newBalance);
    showNeuroCoinSpendFeedback(NEURO_COIN_COSTS.numberMatchAddLine);
    addLine();
  }, [addLine, dailyBlockedReason, didFinish, finishing, phase, showNeuroCoinError, showNeuroCoinSpendFeedback]);

  const boardClearedPercent = computeBoardClearedPercent(board);

  return (
    <>
      <Screen scroll={false}>
        <PlayerEconomyBar compact xp={xpTotal} neuroCoins={neuroCoins} />
        <Card
          variant="primary"
          style={{
            borderWidth: 1.6,
            borderColor: 'rgba(167,139,250,0.58)',
            backgroundColor: theme.colors.bg1,
            shadowColor: '#A78BFA',
            shadowOpacity: 0.16,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
          }}
        >
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Number Match · {difficultyLabel(difficulty)}</Text>
          <View style={{ marginTop: 8 }}>
            {isDaily ? <Text style={{ color: theme.colors.warning, fontWeight: '700' }}>Reto diario</Text> : null}
          </View>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            ⏱ {msToClock(elapsedSec * 1000)} · Puntaje: {score}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            ✔️ {validMatches} · ❌ {invalidMatches} · Limpieza: {boardClearedPercent}%
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
              Empareja numeros iguales o que sumen 10. Se permite conexion por fila, columna, diagonal y continuidad visual entre lineas.
            </Text>

            <View style={{ marginTop: 12, alignSelf: 'center' }}>
              {Array.from({ length: config.rows }).map((_, row) => (
                <View key={`row-${row}`} style={{ flexDirection: 'row' }}>
                  {Array.from({ length: config.cols }).map((__, col) => {
                    const index = row * config.cols + col;
                    const value = board[index];
                    const isSelected = selectedIndex === index;
                    const feedback = feedbackPair && (feedbackPair.a === index || feedbackPair.b === index) ? feedbackPair.kind : null;
                    const isSuggested = suggestedPair !== null && (suggestedPair.a === index || suggestedPair.b === index);

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
                                : isSuggested
                                  ? theme.colors.primary
                                : isSelected
                                  ? theme.colors.primary
                                  : theme.colors.border,
                          backgroundColor:
                            value === null
                              ? theme.colors.bg1
                              : isSuggested
                                ? theme.colors.primarySoft
                                : theme.colors.surface,
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
        </View>

        {!dailyBlockedReason ? (
          <View style={{ gap: 6 }}>
            <HelpActionsGrid>
              <NeuroCoinActionButton
                label="Sugerir"
                icon="💡"
                cost={NEURO_COIN_COSTS.numberMatchSuggestMove}
                usesLeft={MAX_SUGGEST_USES - suggestUses}
                disabled={phase !== 'playing' || didFinish || finishing || suggestUses >= MAX_SUGGEST_USES}
                onPress={handleSuggestMove}
              />
              <NeuroCoinActionButton
                label="Restaurar fallo"
                icon="🩹"
                cost={NEURO_COIN_COSTS.numberMatchRestoreMistake}
                usesLeft={MAX_RESTORE_MISTAKE_USES - restoreMistakeUses}
                disabled={phase !== 'playing' || didFinish || finishing || restoreMistakeUses >= MAX_RESTORE_MISTAKE_USES || invalidMatches <= 0}
                onPress={handleRestoreMistake}
              />
              <NeuroCoinActionButton
                label="Borrar celda"
                icon="🗑️"
                cost={NEURO_COIN_COSTS.numberMatchRemovePairFromSelected}
                usesLeft={MAX_REMOVE_CELL_USES - removeCellUses}
                disabled={phase !== 'playing' || didFinish || finishing || removeCellUses >= MAX_REMOVE_CELL_USES || selectedIndex === null}
                onPress={handleRemoveCell}
              />
              <NeuroCoinActionButton
                label="Añadir línea"
                icon="➕"
                cost={NEURO_COIN_COSTS.numberMatchAddLine}
                disabled={phase !== 'playing' || didFinish || finishing}
                onPress={handlePaidAddLine}
              />
            </HelpActionsGrid>
            {economyFeedback ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{economyFeedback}</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Reintentar" variant="ghost" onPress={restart} disabled={isDaily || !!dailyBlockedReason} style={{ flex: 1 }} />
          <Button title="Salir" variant="secondary" onPress={exitGame} style={{ flex: 1 }} />
        </View>
      </Screen>

      <GameResultModal
        visible={resultVisible}
        onRequestClose={() => setResultVisible(false)}
        variant={resultSummary?.won ? 'victory' : 'defeat'}
        title={resultSummary?.won ? 'Muy bien jugado' : 'Sesion finalizada'}
        subtitle="Number Match"
        metrics={[
          { label: 'Score recompensa', value: resultSummary?.rewardScore ?? 0 },
          { label: 'Matches validos', value: resultSummary?.validMatches ?? 0 },
          { label: 'Matches invalidos', value: resultSummary?.invalidMatches ?? 0 },
          { label: 'Mejor combo', value: resultSummary?.bestCombo ?? 0 },
          { label: 'Lineas usadas', value: resultSummary?.linesUsed ?? 0 },
          { label: 'Tablero despejado', value: `${resultSummary?.boardClearedPercent ?? 0}%` },
          { label: 'XP', value: `+${resultSummary?.xpGained ?? 0}` },
          { label: 'NC 🪙', value: formatNeuroCoinRewardCompact(resultSummary?.spGained ?? 0) },
        ]}
        sessionStreak={resultSummary?.sessionStreak ?? 0}
        streakBonusTitle={resultSummary?.streakBonusTitle}
        streakBonusText={resultSummary?.streakBonusLabel}
        rewardChest={resultSummary?.rewardChest}
        primaryAction={{
          label: 'Siguiente reto',
          onPress: () => {
            setResultVisible(false);
            navigateToNextChallenge(navigation, 'numbermatch', difficulty);
          },
        }}
        secondaryAction={{
          label: 'Jugar de nuevo',
          variant: 'secondary',
          onPress: () => {
            setResultVisible(false);
            void restart();
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
          {
            label: 'Salir',
            variant: 'ghost',
            onPress: () => {
              setResultVisible(false);
              exitGame();
            },
          },
        ]}
      />
    </>
  );
}
