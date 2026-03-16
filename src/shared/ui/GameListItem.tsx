import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Difficulty } from '../../games/types';
import { triggerSuccessHaptic } from '../feedback/haptics';
import { CATEGORY_LABELS, CognitiveCategory, getCategoryColors } from '../theme/categoryColors';
import { useAppTheme } from '../theme/theme';
import DifficultyBadge from './DifficultyBadge';

type GameListItemProps = {
  title: string;
  subtitle: string;
  icon: string;
  category: CognitiveCategory;
  difficulty: Difficulty;
  tags?: string[];
  onPress: () => void;
};

export default function GameListItem({ title, subtitle, icon, category, difficulty, tags, onPress }: GameListItemProps) {
  const { theme } = useAppTheme();
  const colors = getCategoryColors(theme.mode);
  const accent = colors[category];

  const handlePress = useCallback(() => {
    void triggerSuccessHaptic();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: `${accent}33` }}
      style={({ pressed }) => [
        styles.pressable,
        {
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          theme.shadow(1),
          {
            backgroundColor: theme.colors.bg1,
            borderColor: theme.colors.border,
            borderLeftColor: accent,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{title}</Text>
            {tags?.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: theme.colors.primarySoft }]}>
                <Text style={[styles.tagText, { color: theme.colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={[styles.categoryPill, { backgroundColor: `${accent}22` }]}>
              <Text style={[styles.categoryPillText, { color: accent }]}>{CATEGORY_LABELS[category]}</Text>
            </View>
            <DifficultyBadge difficulty={difficulty} compact />
          </View>
        </View>

        <Text style={[theme.typography.h3, { color: theme.colors.textMuted }]}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 26,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
