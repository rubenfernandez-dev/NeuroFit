import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/theme';

type SudokuCellProps = {
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
  const backgroundColor = error
    ? theme.colors.danger
    : selected
      ? theme.colors.primarySoft
      : valueMatchHighlight
        ? theme.colors.primarySoft
        : inBoxHighlight
          ? theme.colors.card
          : inLineHighlight
            ? theme.colors.primarySoft
            : theme.colors.surface;

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
        backgroundColor,
      }}
    >
      {value !== 0 ? (
        <Text
          style={{
            color: error || conflict ? theme.colors.surface : fixed ? theme.colors.text : theme.colors.primary,
            fontWeight: fixed ? '700' : '500',
            fontSize: 16,
          }}
        >
          {value}
        </Text>
      ) : notes.length > 0 ? (
        <View style={{ width: 28, height: 28, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 9 }).map((_, index) => {
            const num = index + 1;
            return (
              <Text
                key={num}
                style={{
                  width: '33.33%',
                  textAlign: 'center',
                  fontSize: 8,
                  lineHeight: 10,
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