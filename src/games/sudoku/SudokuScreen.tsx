import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
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
import { grantXp } from '../../shared/gamification/xp';
import { grantSeasonPoints } from '../../shared/gamification/seasonPoints';
import { claimDailyReward, markDailyCompleted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';
import { SudokuCellPosition, SudokuHistoryEntry } from './model/types';

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
  const isDaily = !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;
  const hasPresetDifficulty = isDaily || !!route.params?.difficulty;

  const [difficulty, setDifficulty] = useState<Difficulty>(normalizeDifficulty(route.params?.difficulty, 'avanzado') as Difficulty);
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

  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedCol = selectedIndex % 9;

  const flattenGrid = (rows: number[][]) => rows.flat();
  const cloneGrid = (rows: number[][]) => rows.map((row) => [...row]);
  const cloneNotes = (matrix: number[][][]) => matrix.map((row) => row.map((cell) => [...cell]));

  useEffect(() => {
    const nextDifficulty = normalizeDifficulty(route.params?.difficulty, 'avanzado') as Difficulty;
    setDifficulty(nextDifficulty);
    setDifficultyConfirmed(isDaily || !!route.params?.difficulty);
  }, [route.params?.difficulty, isDaily]);

  useEffect(() => {
    if (!difficultyConfirmed) return;
    let mounted = true;

    const init = async () => {
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
  }, [difficulty, isDaily, dailyDateISO, dailySeed, difficultyConfirmed]);

  useEffect(() => {
    if (grid.length !== 9 || gameOver || didWin) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [grid.length, gameOver, didWin]);

  useEffect(() => {
    if (!lastErrorCell) return;
    const timeout = setTimeout(() => {
      setLastErrorCell((prev) =>
        prev && prev.row === lastErrorCell.row && prev.col === lastErrorCell.col ? null : prev,
      );
    }, ERROR_FLASH_MS);
    return () => clearTimeout(timeout);
  }, [lastErrorCell]);

  useEffect(() => {
    if (grid.length !== 9 || puzzle.length !== 81 || solution.length !== 81) return;
    saveSudokuState({
      grid,
      givens,
      notes,
      noteMode,
      history,
      puzzle,
      solution,
      difficulty,
      elapsedMs,
      isDaily,
      dailyDateISO,
      mistakes,
      gameOver,
      lastErrorCell,
      didWin,
      sessionStarted,
    });
  }, [grid, givens, notes, noteMode, history, puzzle, solution, difficulty, elapsedMs, isDaily, dailyDateISO, mistakes, gameOver, lastErrorCell, didWin, sessionStarted]);

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

    let earnedXp = 0;
    let earnedSp = 0;

    if (isDaily) {
      await markDailyCompleted();
      const { alreadyClaimed } = await claimDailyReward();
      if (!alreadyClaimed) {
        const profile = await getProfile();
        const xpResult = await grantXp({
          gameId: 'sudoku',
          difficulty,
          won: true,
          durationMs: elapsedMs,
          score: 100,
          mode: 'daily',
          streakCurrent: profile.streakCurrent,
        });
        earnedXp = xpResult.earnedXp;

        const spResult = await grantSeasonPoints({
          gameId: 'sudoku',
          difficulty,
          mistakes,
          durationMs: elapsedMs,
          isDaily: true,
          dailyCompletedAndClaimable: true,
        });
        earnedSp = spResult.earnedSeasonPoints;
      }
    } else {
      const xpResult = await grantXp({
        gameId: 'sudoku',
        difficulty,
        won: true,
        durationMs: elapsedMs,
        score: 100,
        mode: 'normal',
      });
      earnedXp = xpResult.earnedXp;

      const spResult = await grantSeasonPoints({
        gameId: 'sudoku',
        difficulty,
        mistakes,
        durationMs: elapsedMs,
        isDaily: false,
      });
      earnedSp = spResult.earnedSeasonPoints;
    }

    await clearSudokuState();
    setSessionStarted(false);
    setVictorySummary({ earnedXp, earnedSp, elapsedMs, mistakes });
    setVictoryVisible(true);
    setFinishing(false);
  };

  const toggleNote = (row: number, col: number, value: number) => {
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
    if (givens[selectedRow]?.[selectedCol] || gameOver || didWin) return;

    if (noteMode && value !== 0) {
      toggleNote(selectedRow, selectedCol, value);
      return;
    }

    const prevValue = grid[selectedRow][selectedCol];
    const prevNotes = [...notes[selectedRow][selectedCol]];

    if (prevValue === value && prevNotes.length === 0) return;

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
    setHistory((prev) => [
      ...prev,
      {
        row: selectedRow,
        col: selectedCol,
        prevValue,
        nextValue: value,
        prevNotes,
        mistakesDelta,
        prevGameOver: gameOver,
        prevErrorCell: lastErrorCell,
      },
    ]);

    if (nextGameOver) {
      await trackGameOver({ gameId: 'sudoku', mode: isDaily ? 'daily' : 'normal', difficulty, durationMs: elapsedMs, mistakes: nextMistakes });
      setSessionStarted(false);
      showGameOverAlert();
      return;
    }

    await completeIfSolved(nextGrid);
  };

  const undoLastMove = () => {
    if (history.length === 0 || didWin) return;

    const last = history[history.length - 1];
    const nextGrid = cloneGrid(grid);
    nextGrid[last.row][last.col] = last.prevValue;

    const nextNotes = cloneNotes(notes);
    nextNotes[last.row][last.col] = [...last.prevNotes].sort((a, b) => a - b);

    setGrid(nextGrid);
    setNotes(nextNotes);
    setMistakes((prev) => Math.max(0, prev - Math.max(0, last.mistakesDelta ?? 0)));
    setGameOver(last.prevGameOver ?? false);
    setLastErrorCell(last.prevErrorCell ?? null);
    setDidWin(false);
    setShowErrors(false);
    setHistory((prev) => prev.slice(0, -1));
  };

  const clearCell = async () => {
    if (givens[selectedRow]?.[selectedCol] || gameOver || didWin) return;

    if (noteMode) {
      if (notes[selectedRow][selectedCol].length === 0) return;
      const nextNotes = cloneNotes(notes);
      const prevNotes = [...notes[selectedRow][selectedCol]];
      nextNotes[selectedRow][selectedCol] = [];
      setNotes(nextNotes);
      setHistory((prev) => [
        ...prev,
        {
          row: selectedRow,
          col: selectedCol,
          prevValue: grid[selectedRow][selectedCol],
          nextValue: grid[selectedRow][selectedCol],
          prevNotes,
          mistakesDelta: 0,
          prevGameOver: gameOver,
          prevErrorCell: lastErrorCell,
        },
      ]);
      return;
    }

    await setNumber(0);
  };

  const handleNew = () => {
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
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
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
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Sudoku · {difficultyLabel(difficulty)}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Tiempo: {msToClock(elapsedMs)} {isDaily ? '· Daily' : ''}
          </Text>
          <Text style={{ color: mistakes >= 4 ? theme.colors.danger : theme.colors.textMuted, marginTop: 6 }}>Fallos: {mistakes}/{MAX_MISTAKES}</Text>
          {gameOver ? <Text style={{ color: theme.colors.danger, marginTop: 4 }}>Entrada bloqueada por límite de fallos.</Text> : null}
        </Card>

        {grid.length === 9 ? (
          <SudokuGrid
            grid={grid}
            notes={notes}
            givens={givens}
            selectedIndex={selectedIndex}
            conflicts={conflicts}
            errorCell={lastErrorCell}
            locked={gameOver || didWin}
            onSelect={setSelectedIndex}
          />
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>Cargando puzzle...</Text>
        )}

        <Keypad onInput={setNumber} onClear={clearCell} disabled={gameOver || didWin} clearDisabled={!canClear} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="✏️ Notas"
            variant={noteMode ? 'primary' : 'secondary'}
            onPress={() => setNoteMode((prev) => !prev)}
            disabled={gameOver || didWin}
            style={{ flex: 1 }}
          />
          <Button title="↩ Undo" variant="ghost" onPress={undoLastMove} disabled={history.length === 0 || didWin} style={{ flex: 1 }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Nuevo" onPress={handleNew} disabled={isDaily && !gameOver} style={{ flex: 1 }} />
          <Button title="Comprobar" variant="secondary" onPress={checkBoard} disabled={grid.length !== 9 || finishing || didWin} style={{ flex: 1 }} />
        </View>

        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          Validación: inmediata por celda al introducir número; “Comprobar” revisa globalmente el tablero.
        </Text>
      </ScrollView>

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
                title="Ver ranking"
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