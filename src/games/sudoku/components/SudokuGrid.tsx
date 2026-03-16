import React from 'react';
import { View } from 'react-native';
import SudokuCell from './SudokuCell';
import { useAppTheme } from '../../../shared/theme/theme';
import { SudokuCellPosition } from '../model/types';
import { getCellHighlightState } from './highlight';

type SudokuGridProps = {
  size: number;
  grid: number[][];
  notes: number[][][];
  givens: boolean[][];
  selectedIndex: number;
  conflicts: Set<number>;
  errorCell: SudokuCellPosition | null;
  completionPulseRows?: number[];
  completionPulseCols?: number[];
  completionPulseBoxes?: number[];
  completionPulseVisible?: boolean;
  locked: boolean;
  onSelect: (index: number) => void;
};

export default function SudokuGrid({
  size,
  grid,
  notes,
  givens,
  selectedIndex,
  conflicts,
  errorCell,
  completionPulseRows = [],
  completionPulseCols = [],
  completionPulseBoxes = [],
  completionPulseVisible = false,
  locked,
  onSelect,
}: SudokuGridProps) {
  const { theme } = useAppTheme();
  const cellSize = size / 9;
  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedCol = selectedIndex % 9;
  const selectedValue = grid[selectedRow]?.[selectedCol] ?? 0;
  const pulseRows = new Set(completionPulseRows);
  const pulseCols = new Set(completionPulseCols);
  const pulseBoxes = new Set(completionPulseBoxes);

  return (
    <View style={{ width: size, height: size, borderWidth: 2, borderColor: theme.colors.border, alignSelf: 'center' }}>
      {Array.from({ length: 9 }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 9 }).map((__, col) => {
            const index = row * 9 + col;
            const highlight = getCellHighlightState({
              row,
              col,
              selectedIndex,
              selectedValue,
              cellValue: grid[row][col],
            });
            const isError = !!errorCell && errorCell.row === row && errorCell.col === col;
            const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);
            const completionPulse = completionPulseVisible && (pulseRows.has(row) || pulseCols.has(col) || pulseBoxes.has(boxIndex));

            return (
              <View
                key={index}
                style={{
                  borderTopWidth: row % 3 === 0 ? 1 : 0,
                  borderLeftWidth: col % 3 === 0 ? 1 : 0,
                  borderColor: theme.colors.border,
                }}
              >
                <SudokuCell
                  value={grid[row][col]}
                  notes={notes[row][col]}
                  size={cellSize}
                  fixed={givens[row][col]}
                  selected={highlight.selected}
                  conflict={conflicts.has(index)}
                  error={isError}
                  inLineHighlight={highlight.rowOrCol}
                  inBoxHighlight={highlight.box}
                  valueMatchHighlight={highlight.valueMatch}
                  completionPulse={completionPulse}
                  onPress={() => {
                    if (!locked) {
                      onSelect(index);
                    }
                  }}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}