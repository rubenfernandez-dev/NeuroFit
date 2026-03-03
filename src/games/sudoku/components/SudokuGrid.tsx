import React from 'react';
import { View } from 'react-native';
import SudokuCell from './SudokuCell';

type SudokuGridProps = {
  grid: number[];
  puzzle: number[];
  selectedIndex: number;
  conflicts: Set<number>;
  onSelect: (index: number) => void;
};

export default function SudokuGrid({ grid, puzzle, selectedIndex, conflicts, onSelect }: SudokuGridProps) {
  return (
    <View style={{ borderWidth: 2, borderColor: '#334155', alignSelf: 'center' }}>
      {Array.from({ length: 9 }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 9 }).map((__, col) => {
            const index = row * 9 + col;
            return (
              <View
                key={index}
                style={{
                  borderTopWidth: row % 3 === 0 ? 1 : 0,
                  borderLeftWidth: col % 3 === 0 ? 1 : 0,
                  borderColor: '#334155',
                }}
              >
                <SudokuCell
                  value={grid[index]}
                  fixed={puzzle[index] !== 0}
                  selected={selectedIndex === index}
                  conflict={conflicts.has(index)}
                  onPress={() => onSelect(index)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}