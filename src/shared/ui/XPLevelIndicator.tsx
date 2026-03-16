import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { getLevelByXp, getNextLevel } from '../gamification/levels';
import { useAppTheme } from '../theme/theme';
import AnimatedProgressBar from './AnimatedProgressBar';

type XPLevelIndicatorProps = {
  xpTotal: number;
};

export default function XPLevelIndicator({ xpTotal }: XPLevelIndicatorProps) {
  const { theme } = useAppTheme();
  const level = getLevelByXp(xpTotal);
  const nextLevel = getNextLevel(xpTotal);
  const progress = nextLevel
    ? (xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shine]);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.bg1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.medalWrap}>
          <Text style={styles.medal}>{level.badgeEmoji}</Text>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shine,
              {
                backgroundColor: '#FFFFFF',
                opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
              },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{level.name}</Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>{xpTotal} XP acumulado</Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <AnimatedProgressBar
          value={progress}
          label={nextLevel ? `Faltan ${Math.max(0, nextLevel.minXp - xpTotal)} XP para ${nextLevel.name}` : 'Nivel máximo alcanzado'}
          color={theme.colors.primary}
          height={12}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  medalWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  medal: {
    fontSize: 30,
  },
  shine: {
    position: 'absolute',
    top: -12,
    left: -20,
    width: 36,
    height: 80,
    transform: [{ rotate: '20deg' }],
  },
});
