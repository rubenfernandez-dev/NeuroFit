import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppTheme } from '../../../shared/theme/theme';
import { TapFeedback } from '../hooks/useTapFeedback';

type Props = {
  numbers: number[];
  nextExpected: number;
  tileSize: number;
  gridGap: number;
  gridMaxWidth: number;
  gridSize: number;
  phase: 'idle' | 'playing' | 'finished';
  didFinish: boolean;
  tapFeedback: TapFeedback | null;
  theme: AppTheme;
  onPressNumber: (value: number) => void;
};

export default function FocusGridBoard({
  numbers,
  nextExpected,
  tileSize,
  gridGap,
  gridMaxWidth,
  gridSize,
  phase,
  didFinish,
  tapFeedback,
  theme,
  onPressNumber,
}: Props) {
  return (
    <View
      style={{
        marginTop: 12,
        width: gridMaxWidth,
        alignSelf: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: gridGap,
        justifyContent: 'center',
      }}
    >
      {numbers.map((value) => {
        const alreadySolved = value < nextExpected;
        const isCurrentTarget = value === nextExpected;
        const isFeedbackCell = tapFeedback?.value === value;
        const isIncorrectFlash = isFeedbackCell && tapFeedback?.type === 'incorrect';
        const isCorrectFlash = isFeedbackCell && tapFeedback?.type === 'correct';

        let bg = theme.colors.surface;
        let border = theme.colors.border;
        let textColor = theme.colors.text;

        if (alreadySolved) {
          bg = theme.colors.success;
          border = theme.colors.success;
          textColor = '#FFFFFF';
        } else if (isCurrentTarget) {
          bg = theme.colors.primarySoft;
          border = theme.colors.primary;
        }

        if (isIncorrectFlash) {
          bg = theme.colors.warning;
          textColor = '#FFFFFF';
        }

        if (isCorrectFlash) {
          border = theme.colors.success;
        } else if (isIncorrectFlash) {
          border = theme.colors.warning;
        }

        return (
          <Pressable
            key={value}
            onPress={() => onPressNumber(value)}
            disabled={phase !== 'playing' || didFinish || alreadySolved}
            style={{
              width: tileSize,
              height: tileSize,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: border,
              backgroundColor: bg,
              opacity: phase !== 'playing' && !alreadySolved ? 0.86 : 1,
            }}
          >
            <Text style={{ color: textColor, fontWeight: '700', fontSize: gridSize >= 6 ? 14 : 16 }}>{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}