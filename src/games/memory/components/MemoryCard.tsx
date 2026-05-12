import React from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../../../shared/theme/theme';

type MemoryCardProps = {
  emoji: string;
  isFaceUp: boolean;
  isMatched: boolean;
  onPress: () => void;
  size?: number;
};

export default function MemoryCard({ emoji, isFaceUp, isMatched, onPress, size = 46 }: MemoryCardProps) {
  const { theme } = useAppTheme();
  const width = Math.max(28, Math.floor(size));
  const height = Math.max(34, Math.floor(width * 1.22));
  return (
    <Pressable
      onPress={onPress}
      disabled={isMatched || isFaceUp}
      style={{
        width,
        height,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: isFaceUp || isMatched ? theme.colors.bg1 : theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadow(isFaceUp || isMatched ? 1 : 2),
      }}
    >
      <Text style={{ fontSize: Math.max(16, Math.floor(width * 0.52)) }}>{isFaceUp || isMatched ? emoji : '•'}</Text>
    </Pressable>
  );
}