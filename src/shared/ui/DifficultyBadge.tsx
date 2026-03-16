import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Difficulty, difficultyLabel } from '../../games/types';
import { getDifficultyColor } from '../theme/categoryColors';
import { useAppTheme } from '../theme/theme';

type DifficultyBadgeProps = {
  difficulty: Difficulty;
  compact?: boolean;
};

export default function DifficultyBadge({ difficulty, compact }: DifficultyBadgeProps) {
  const { theme } = useAppTheme();
  const color = getDifficultyColor(difficulty, theme.mode);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }, compact ? styles.compact : null]}>
      <Text style={[styles.text, { color }]}>{difficultyLabel(difficulty)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});
