import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/theme';
import { getCellBackgroundColor } from './highlight';

type SudokuCellProps = {
  size: number;
  value: number;
  notes: number[];
  fixed: boolean;
  selected: boolean;
  conflict: boolean;
  error: boolean;
  inLineHighlight: boolean;
  inBoxHighlight: boolean;
  valueMatchHighlight: boolean;
  onPress: () => void;
};

export default function SudokuCell({
  size,
  value,
  notes,
  fixed,
  selected,
  conflict,
  error,
  inLineHighlight,
  inBoxHighlight,
  valueMatchHighlight,
  onPress,
}: SudokuCellProps) {
  const { theme } = useAppTheme();
  const notesSet = new Set(notes);
  const valueFontSize = Math.max(12, Math.floor(size * 0.5));
  const noteFontSize = Math.max(6, Math.floor(size * 0.18));
  const noteLineHeight = Math.max(8, Math.floor(size * 0.24));
  const notesBoxSize = Math.max(18, Math.floor(size * 0.82));
  const backgroundColor = getCellBackgroundColor(
    theme,
    {
      selected,
      rowOrCol: inLineHighlight,
      box: inBoxHighlight,
      valueMatch: valueMatchHighlight,
    },
    error,
  );

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
      }}
    >
      {value !== 0 ? (
        <Text
          style={{
            color: error || conflict ? theme.colors.surface : fixed ? theme.colors.text : theme.colors.primary,
            fontWeight: fixed ? '700' : '500',
            fontSize: valueFontSize,
          }}
        >
          {value}
        </Text>
      ) : notes.length > 0 ? (
        <View style={{ width: notesBoxSize, height: notesBoxSize, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 9 }).map((_, index) => {
            const num = index + 1;
            return (
              <Text
                key={num}
                style={{
                  width: '33.33%',
                  textAlign: 'center',
                  fontSize: noteFontSize,
                  lineHeight: noteLineHeight,
                  color: theme.colors.textMuted,
                }}
              >
                {notesSet.has(num) ? num : ' '}
              </Text>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}