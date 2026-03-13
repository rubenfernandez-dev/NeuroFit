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
  locked: boolean;
  onSelect: (index: number) => void;
};

export default function SudokuGrid({ size, grid, notes, givens, selectedIndex, conflicts, errorCell, locked, onSelect }: SudokuGridProps) {
  const { theme } = useAppTheme();
  const cellSize = size / 9;
  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedCol = selectedIndex % 9;
  const selectedValue = grid[selectedRow]?.[selectedCol] ?? 0;

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