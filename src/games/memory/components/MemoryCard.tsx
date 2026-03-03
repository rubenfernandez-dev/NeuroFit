import React from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../../../shared/theme/theme';

type MemoryCardProps = {
  emoji: string;
  isFaceUp: boolean;
  isMatched: boolean;
  onPress: () => void;
};

export default function MemoryCard({ emoji, isFaceUp, isMatched, onPress }: MemoryCardProps) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={isMatched || isFaceUp}
      style={{
        width: 46,
        height: 58,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: isFaceUp || isMatched ? theme.colors.surface : theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 24 }}>{isFaceUp || isMatched ? emoji : '•'}</Text>
    </Pressable>
  );
}