import React from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../../../shared/theme/theme';

type SudokuCellProps = {
  value: number;
  fixed: boolean;
  selected: boolean;
  conflict: boolean;
  onPress: () => void;
};

export default function SudokuCell({ value, fixed, selected, conflict, onPress }: SudokuCellProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
      }}
    >
      <Text
        style={{
          color: conflict ? theme.colors.danger : fixed ? theme.colors.text : theme.colors.primary,
          fontWeight: fixed ? '700' : '500',
          fontSize: 16,
        }}
      >
        {value || ''}
      </Text>
    </Pressable>
  );
}