import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Text, View, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { normalizeGameRouteParams, RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { getPuzzle } from './logic/generator';
import { findConflicts, isSolved } from './logic/validate';
import { clearSudokuState, createInitialSudokuState, getSudokuState, saveSudokuState } from './storage/sudokuState';
import SudokuGrid from './components/SudokuGrid';
import Keypad from './components/Keypad';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { trackGameOver, trackSessionStart, trackWin } from '../../shared/storage/stats';
import { ensureDailyToday, markDailyStageStarted } from '../../shared/storage/daily';
import { SudokuCellPosition, SudokuHistoryEntry } from './model/types';
import Screen from '../../shared/ui/Screen';
import Pill from '../../shared/ui/Pill';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';
import { completeGameSession } from '../../shared/gamification/sessionCompletion';
import { playDefeatFeedback, playErrorFeedback, playSuccessFeedback, playVictoryFeedback } from '../../shared/feedback/gameFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Sudoku'>;
const MAX_MISTAKES = 5;
const ERROR_FLASH_MS = 800;
const SUDOKU_DIFFICULTIES: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

type VictorySummary = {
  earnedXp: number;
  earnedSp: number;
  elapsedMs: number;
  mistakes: number;
};

export default function SudokuScreen({ route, navigation }: Props) {
  const { theme } = useAppTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const gameRoute = normalizeGameRouteParams(route.params);
  const { isDaily, dailyDateISO, dailySeed, stageIndex } = gameRoute;
  const hasPresetDifficulty = isDaily || !!route.params?.difficulty;

  const [difficulty, setDifficulty] = useState<Difficulty>(normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty);
  const [difficultyConfirmed, setDifficultyConfirmed] = useState(hasPresetDifficulty);
  const [puzzle, setPuzzle] = useState<number[]>([]);
  const [solution, setSolution] = useState<number[]>([]);
  const [grid, setGrid] = useState<number[][]>([]);
  const [givens, setGivens] = useState<boolean[][]>([]);
  const [notes, setNotes] = useState<number[][][]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [history, setHistory] = useState<SudokuHistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [lastErrorCell, setLastErrorCell] = useState<SudokuCellPosition | null>(null);
  const [didWin, setDidWin] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [victoryVisible, setVictoryVisible] = useState(false);
  const [victorySummary, setVictorySummary] = useState<VictorySummary | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [dailyBlockedReason, setDailyBlockedReason] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(92);
  const [controlsHeight, setControlsHeight] = useState(250);

  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedCol = selectedIndex % 9;
  const compactLayout = windowHeight <= 700 || windowWidth <= 360;
  const horizontalPadding = theme.spacing.lg * 2;
  const verticalPadding = theme.spacing.lg * 2;
  const availableBoardHeight = Math.max(180, windowHeight - verticalPadding - headerHeight - controlsHeight - 20);
  const boardSize = Math.max(180, Math.floor(Math.min(windowWidth - horizontalPadding, availableBoardHeight)));
  const keypadButtonSize = compactLayout ? 40 : 50;
  const controlsGap = compactLayout ? 6 : 8;

  const flattenGrid = (rows: number[][]) => rows.flat();
  const cloneGrid = (rows: number[][]) => rows.map((row) => [...row]);
  const cloneNotes = (matrix: number[][][]) => matrix.map((row) => row.map((cell) => [...cell]));

  useEffect(() => {
    const nextDifficulty = normalizeDifficulty(gameRoute.difficulty, 'avanzado') as Difficulty;
    setDifficulty(nextDifficulty);
    setDifficultyConfirmed(isDaily || !!route.params?.difficulty);
  }, [gameRoute.difficulty, isDaily, route.params?.difficulty]);

  useEffect(() => {
    if (!difficultyConfirmed) return;
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

        if (!expectedStage || expectedStage.gameId !== 'sudoku') {
          setDailyBlockedReason('Esta etapa no está activa. Continúa el circuito desde Reto diario.');
          return;
        }

        if (typeof stageIndex === 'number' && stageIndex !== daily.currentStageIndex) {
          setDailyBlockedReason('Esta etapa ya no está activa. Continúa desde Reto diario.');
          return;
        }

        await markDailyStageStarted({ stageIndex, gameId: 'sudoku' });
      }

      const saved = await getSudokuState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setPuzzle(saved.puzzle);
        setSolution(saved.solution);
        setGrid(saved.grid);
        setGivens(saved.givens);
        setNotes(saved.notes);
        setNoteMode(saved.noteMode);
        setHistory(saved.history);
        setElapsedMs(saved.elapsedMs);
        setMistakes(saved.mistakes);
        setGameOver(saved.gameOver);
        setLastErrorCell(saved.lastErrorCell);
        setDidWin(saved.didWin);
        setSessionStarted(saved.sessionStarted);
        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      const generated = getPuzzle(difficulty, isDaily ? dailySeed : undefined);
      const initialState = createInitialSudokuState(generated.puzzle);
      if (!mounted) return;
      setPuzzle(generated.puzzle);
      setSolution(generated.solution);
      setGrid(initialState.grid);
      setGivens(initialState.givens);
      setNotes(initialState.notes);
      setNoteMode(false);
      setHistory([]);
      setElapsedMs(0);
      setMistakes(0);
      setGameOver(false);
      setLastErrorCell(null);
      setDidWin(false);
      setSessionStarted(true);
      setVictoryVisible(false);
      setVictorySummary(null);
      setShowErrors(false);
      await trackSessionStart({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed, difficultyConfirmed, stageIndex]);

  useEffect(() => {
    if (!sessionStarted || grid.length !== 9 || gameOver || didWin || !!dailyBlockedReason) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted, grid.length, gameOver, didWin, dailyBlockedReason]);

  useEffect(() => {
    if (!lastErrorCell) return;
    const timeout = setTimeout(() => {
      setLastErrorCell((prev) =>
        prev && prev.row === lastErrorCell.row && prev.col === lastErrorCell.col ? null : prev,
      );
    }, ERROR_FLASH_MS);
    return () => clearTimeout(timeout);
  }, [lastErrorCell]);

  // Ref keeps the full save payload current on every render — the unmount cleanup
  // and the periodic checkpoint always write the latest state (including elapsedMs).
  const sudokuPersistRef = useRef<Parameters<typeof saveSudokuState>[0] | null>(null);
  sudokuPersistRef.current =
    grid.length === 9 && puzzle.length === 81 && solution.length === 81
      ? { grid, givens, notes, noteMode, history, puzzle, solution, difficulty, elapsedMs, isDaily, dailyDateISO, mistakes, gameOver, lastErrorCell, didWin, sessionStarted }
      : null;

  // Persist on user interactions (cell fill, notes, clear, game events).
  // elapsedMs is read from the ref — not in the dep array — so the 1 s timer tick
  // no longer triggers a write on its own.
  useEffect(() => {
    const p = sudokuPersistRef.current;
    if (!p) return;
    saveSudokuState(p);
  }, [grid, givens, notes, noteMode, history, puzzle, solution, difficulty, isDaily, dailyDateISO, mistakes, gameOver, lastErrorCell, didWin, sessionStarted]);

  // Checkpoint every 30 s + save on unmount (handles back-navigation mid-game).
  useEffect(() => {
    const id = setInterval(() => {
      const p = sudokuPersistRef.current;
      if (p?.sessionStarted && !p.didWin && !p.gameOver) saveSudokuState(p);
    }, 30_000);
    return () => {
      clearInterval(id);
      const p = sudokuPersistRef.current;
      if (p?.sessionStarted && !p.didWin && !p.gameOver) saveSudokuState(p);
    };
  }, []);

  const conflicts = useMemo(() => (showErrors ? findConflicts(flattenGrid(grid)) : new Set<number>()), [grid, showErrors]);
  const canClear =
    !gameOver &&
    !didWin &&
    !givens[selectedRow]?.[selectedCol] &&
    (noteMode ? notes[selectedRow]?.[selectedCol]?.length > 0 : grid[selectedRow]?.[selectedCol] !== 0 || notes[selectedRow]?.[selectedCol]?.length > 0);

  const showGameOverAlert = () => {
    Alert.alert('Partida terminada', 'Has alcanzado 5 fallos. Partida terminada.', [
      { text: 'Nuevo', onPress: handleNew },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  };

  const completeIfSolved = async (nextGrid: number[][]) => {
    if (finishing || gameOver || didWin) return;
    const flatGrid = flattenGrid(nextGrid);
    if (!isSolved(flatGrid, solution)) return;
    if (findConflicts(flatGrid).size > 0) return;

    setFinishing(true);
    setDidWin(true);
    await trackWin({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal', difficulty, durationMs: elapsedMs, mistakes });

    const completionResult = await completeGameSession({
      gameId: 'sudoku',
      difficulty,
      mode: isDaily ? 'daily' : 'normal',
      won: true,
      stageIndex,
      metrics: {
        durationMs: elapsedMs,
        mistakes,
        score: 100,
      },
    });

    if (isDaily && completionResult.dailyCompletion) {
      void playVictoryFeedback();
      await clearSudokuState();
      setSessionStarted(false);
      setFinishing(false);

      navigation.replace('DailyChallenge', {
        completion: completionResult.dailyCompletion,
      });
      return;
    }

    await clearSudokuState();
    setSessionStarted(false);
    void playVictoryFeedback();
    setVictorySummary({
      earnedXp: completionResult.earnedXp,
      earnedSp: completionResult.earnedSp,
      elapsedMs,
      mistakes,
    });
    setVictoryVisible(true);
    setFinishing(false);
  };

  const toggleNote = (row: number, col: number, value: number) => {
    if (dailyBlockedReason) return;
    if (value < 1 || value > 9) return;
    if (givens[row]?.[col] || gameOver || didWin) return;

    setNotes((prev) => {
      const next = cloneNotes(prev);
      const current = next[row][col];
      next[row][col] = current.includes(value)
        ? current.filter((note) => note !== value)
        : [...current, value].sort((a, b) => a - b);
      return next;
    });
  };

  const setNumber = async (value: number) => {
    if (dailyBlockedReason) return;
    if (givens[selectedRow]?.[selectedCol] || gameOver || didWin) return;

    if (noteMode && value !== 0) {
      toggleNote(selectedRow, selectedCol, value);
      return;
    }

    const currentValue = grid[selectedRow][selectedCol];
    const currentNotes = notes[selectedRow][selectedCol];

    if (currentValue === value && currentNotes.length === 0) return;

    const nextGrid = cloneGrid(grid);
    nextGrid[selectedRow][selectedCol] = value;

    const nextNotes = cloneNotes(notes);
    nextNotes[selectedRow][selectedCol] = [];

    const index = selectedRow * 9 + selectedCol;
    const wrongInput = value !== 0 && value !== solution[index];
    const mistakesDelta = wrongInput ? 1 : 0;
    const nextMistakes = Math.min(MAX_MISTAKES, mistakes + mistakesDelta);
    const nextGameOver = nextMistakes >= MAX_MISTAKES;
    const nextErrorCell = wrongInput ? { row: selectedRow, col: selectedCol } : null;

    setGrid(nextGrid);
    setNotes(nextNotes);
    setMistakes(nextMistakes);
    setGameOver(nextGameOver);
    setLastErrorCell(nextErrorCell);
    setShowErrors(false);

    if (value !== 0 && !wrongInput) {
      void playSuccessFeedback();
    }
    if (wrongInput) {
      void playErrorFeedback();
    }

    if (nextGameOver) {
      void playDefeatFeedback();
      await trackGameOver({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal', difficulty, durationMs: elapsedMs, mistakes: nextMistakes });
      await updateNeuroAfterGame({
        gameId: 'sudoku',
        difficulty,
        won: false,
        durationMs: elapsedMs,
        score: 0,
        mistakes: nextMistakes,
        mode: isDaily ? 'daily' : 'normal',
      });
      setSessionStarted(false);
      showGameOverAlert();
      return;
    }

    await completeIfSolved(nextGrid);
  };

  const clearCell = async () => {
    if (dailyBlockedReason) return;
    if (givens[selectedRow]?.[selectedCol] || gameOver || didWin) return;

    if (noteMode) {
      if (notes[selectedRow][selectedCol].length === 0) return;
      const nextNotes = cloneNotes(notes);
      nextNotes[selectedRow][selectedCol] = [];
      setNotes(nextNotes);
      return;
    }

    await setNumber(0);
  };

  const handleNew = () => {
    if (isDaily && !gameOver) return;
    const generated = getPuzzle(difficulty, isDaily ? dailySeed : undefined);
    const initialState = createInitialSudokuState(generated.puzzle);
    setPuzzle(generated.puzzle);
    setSolution(generated.solution);
    setGrid(initialState.grid);
    setGivens(initialState.givens);
    setNotes(initialState.notes);
    setNoteMode(false);
    setHistory([]);
    setElapsedMs(0);
    setMistakes(0);
    setGameOver(false);
    setLastErrorCell(null);
    setDidWin(false);
    setSessionStarted(true);
    setVictoryVisible(false);
    setVictorySummary(null);
    setShowErrors(false);
    trackSessionStart({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal' });
  };

  const checkBoard = async () => {
    if (gameOver || didWin) {
      showGameOverAlert();
      return;
    }

    if (grid.length !== 9 || solution.length !== 81) return;
    setShowErrors(true);

    const flatGrid = flattenGrid(grid);
    const wrongCells = flatGrid.reduce((acc, value, index) => (value !== 0 && value !== solution[index] ? acc + 1 : acc), 0);
    const empties = flatGrid.filter((value) => value === 0).length;
    const conflictsCount = findConflicts(flatGrid).size;

    if (!isSolved(flatGrid, solution) || conflictsCount > 0) {
      Alert.alert('Revisión del tablero', `Vacías: ${empties} · Incorrectas: ${wrongCells} · Conflictos: ${conflictsCount}`);
    }

    await completeIfSolved(grid);
  };

  if (!difficultyConfirmed) {
    return (
      <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
        <Card variant="primary">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Elige dificultad</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>Selecciona el nivel para iniciar Sudoku.</Text>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUDOKU_DIFFICULTIES.map((option) => (
            <Button
              key={option}
              title={difficultyLabel(option)}
              variant={difficulty === option ? 'primary' : 'secondary'}
              onPress={() => setDifficulty(option)}
              style={{ width: '48%' }}
            />
          ))}
        </View>

        <Button title="Empezar" onPress={() => setDifficultyConfirmed(true)} />
      </Screen>
    );
  }

  return (
    <>
      <Screen scroll={false} contentStyle={{ flex: 1, gap: compactLayout ? 8 : theme.spacing.md }}>
        <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
          <Card variant="cyan" style={{ padding: compactLayout ? 12 : 16 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]} numberOfLines={1}>Sudoku · {difficultyLabel(difficulty)}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
              <Pill label={isDaily ? `Reto diario · ${difficultyLabel(difficulty)}` : `Modo normal · ${difficultyLabel(difficulty)}`} tone={isDaily ? 'warning' : 'default'} />
              <Text style={{ color: mistakes >= 4 ? theme.colors.danger : theme.colors.textMuted, fontSize: compactLayout ? 12 : 14 }} numberOfLines={1}>Fallos: {mistakes}/{MAX_MISTAKES}</Text>
            </View>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: compactLayout ? 12 : 14 }} numberOfLines={1}>
              Tiempo: {msToClock(elapsedMs)} {isDaily ? '· Daily' : ''}
            </Text>
            {gameOver ? <Text style={{ color: theme.colors.danger, marginTop: 2, fontSize: 12 }} numberOfLines={2}>Entrada bloqueada por límite de fallos.</Text> : null}
          </Card>
        </View>

        {dailyBlockedReason ? (
          <Card>
            <Text style={[theme.typography.body, { color: theme.colors.warning }]}>{dailyBlockedReason}</Text>
            <View style={{ marginTop: 10 }}>
              <Button title="Volver al reto diario" onPress={() => navigation.navigate('DailyChallenge')} />
            </View>
          </Card>
        ) : null}

        <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          {!dailyBlockedReason && grid.length === 9 ? (
            <SudokuGrid
              size={boardSize}
              grid={grid}
              notes={notes}
              givens={givens}
              selectedIndex={selectedIndex}
              conflicts={conflicts}
              errorCell={lastErrorCell}
              locked={gameOver || didWin}
              onSelect={setSelectedIndex}
            />
          ) : !dailyBlockedReason ? (
            <Text style={{ color: theme.colors.textMuted }}>Cargando puzzle...</Text>
          ) : null}
        </View>

        {!dailyBlockedReason ? (
        <View onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}>
          <Card style={{ padding: compactLayout ? 8 : 12 }}>
            <Keypad
              onInput={setNumber}
              onClear={clearCell}
              disabled={gameOver || didWin}
              clearDisabled={!canClear}
              compact={compactLayout}
              buttonSize={keypadButtonSize}
              gap={compactLayout ? 4 : 6}
              showClear={false}
            />

          <View style={{ flexDirection: 'row', gap: controlsGap, marginTop: controlsGap }}>
            <Button
              title="✏️ Notas"
              variant={noteMode ? 'primary' : 'secondary'}
              onPress={() => setNoteMode((prev) => !prev)}
              disabled={gameOver || didWin}
              style={{ flex: 1, minHeight: compactLayout ? 38 : 44, paddingVertical: compactLayout ? 6 : 8, paddingHorizontal: 8 }}
            />
            <Button
              title="Borrar"
              variant="secondary"
              onPress={clearCell}
              disabled={gameOver || didWin || !canClear}
              style={{ flex: 1, minHeight: compactLayout ? 38 : 44, paddingVertical: compactLayout ? 6 : 8, paddingHorizontal: 8 }}
            />
            <Button
              title="Comprobar"
              variant="secondary"
              onPress={checkBoard}
              disabled={grid.length !== 9 || finishing || didWin}
              style={{ flex: 1, minHeight: compactLayout ? 38 : 44, paddingVertical: compactLayout ? 6 : 8, paddingHorizontal: 8 }}
            />
          </View>
          </Card>
        </View>
        ) : null}

        <Button
          title={isDaily ? 'Reintentar etapa' : 'Nuevo'}
          onPress={handleNew}
          disabled={(isDaily && !gameOver) || !!dailyBlockedReason}
          style={{ minHeight: compactLayout ? 40 : 46, marginBottom: theme.spacing.sm }}
        />
      </Screen>

      <Modal visible={victoryVisible} transparent animationType="fade" onRequestClose={() => setVictoryVisible(false)}>
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
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>¡Completado!</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>XP: +{victorySummary?.earnedXp ?? 0}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>SP: +{victorySummary?.earnedSp ?? 0}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Tiempo: {msToClock(victorySummary?.elapsedMs ?? 0)}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Fallos: {victorySummary?.mistakes ?? 0}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button
                title="Nueva partida"
                onPress={() => {
                  setVictoryVisible(false);
                  handleNew();
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Ver ranking local"
                variant="secondary"
                onPress={() => {
                  setVictoryVisible(false);
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