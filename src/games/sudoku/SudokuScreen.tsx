import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { Difficulty } from '../types';
import { getPuzzle } from './logic/generator';
import { findConflicts, isSolved } from './logic/validate';
import { clearSudokuState, getSudokuState, saveSudokuState } from './storage/sudokuState';
import SudokuGrid from './components/SudokuGrid';
import Keypad from './components/Keypad';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { msToClock } from '../../shared/utils/time';
import { recordSession } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { markDailyCompleted } from '../../shared/storage/daily';

type Props = NativeStackScreenProps<RootStackParamList, 'Sudoku'>;

export default function SudokuScreen({ route }: Props) {
  const { theme } = useAppTheme();
  const difficulty = (route.params?.difficulty ?? 'medium') as Difficulty;
  const isDaily = !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;

  const [puzzle, setPuzzle] = useState<number[]>([]);
  const [solution, setSolution] = useState<number[]>([]);
  const [grid, setGrid] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
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
        setElapsedMs(saved.elapsedMs);
        return;
      }

      const generated = getPuzzle(difficulty, isDaily ? dailySeed : undefined);
      if (!mounted) return;
      setPuzzle(generated.puzzle);
      setSolution(generated.solution);
      setGrid(generated.puzzle);
      setElapsedMs(0);
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed]);

  useEffect(() => {
    if (grid.length !== 81) return;
    const timer = setInterval(() => setElapsedMs((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, [grid.length]);

  useEffect(() => {
    if (grid.length !== 81 || puzzle.length !== 81 || solution.length !== 81) return;
    saveSudokuState({
      grid,
      puzzle,
      solution,
      difficulty,
      elapsedMs,
      isDaily,
      dailyDateISO,
    });
  }, [grid, puzzle, solution, difficulty, elapsedMs, isDaily, dailyDateISO]);

  const conflicts = useMemo(() => (showErrors ? findConflicts(grid) : new Set<number>()), [grid, showErrors]);

  const completeIfSolved = async (nextGrid: number[]) => {
    if (finishing) return;
    if (!isSolved(nextGrid, solution)) return;
    if (findConflicts(nextGrid).size > 0) return;

    setFinishing(true);
    await recordSession({ gameId: 'sudoku', difficulty, durationMs: elapsedMs, won: true });
    const { earnedXp } = await grantXp({ gameId: 'sudoku', difficulty, won: true, durationMs: elapsedMs, score: 100 });
    if (isDaily) await markDailyCompleted();
    await clearSudokuState();

    Alert.alert('¡Sudoku completado!', `Ganaste ${earnedXp} XP.`);
    setFinishing(false);
  };

  const setCellValue = async (value: number) => {
    if (puzzle[selectedIndex] !== 0) return;
    const next = [...grid];
    next[selectedIndex] = value;
    setGrid(next);
    await completeIfSolved(next);
  };

  const clearCell = () => {
    if (puzzle[selectedIndex] !== 0) return;
    const next = [...grid];
    next[selectedIndex] = 0;
    setGrid(next);
  };

  const handleNew = () => {
    const generated = getPuzzle(difficulty);
    setPuzzle(generated.puzzle);
    setSolution(generated.solution);
    setGrid(generated.puzzle);
    setElapsedMs(0);
    setShowErrors(false);
  };

  const checkBoard = async () => {
    setShowErrors(true);
    await completeIfSolved(grid);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Sudoku · {difficulty}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Tiempo: {msToClock(elapsedMs)} {isDaily ? '· Daily' : ''}
        </Text>
      </Card>

      {grid.length === 81 ? (
        <SudokuGrid
          grid={grid}
          puzzle={puzzle}
          selectedIndex={selectedIndex}
          conflicts={conflicts}
          onSelect={setSelectedIndex}
        />
      ) : (
        <Text style={{ color: theme.colors.textMuted }}>Cargando puzzle...</Text>
      )}

      <Keypad onInput={setCellValue} onClear={clearCell} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Nuevo" onPress={handleNew} disabled={isDaily} style={{ flex: 1 }} />
        <Button title="Comprobar" variant="secondary" onPress={checkBoard} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}