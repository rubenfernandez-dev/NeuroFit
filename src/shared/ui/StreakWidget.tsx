import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';

type StreakWidgetProps = {
  current: number;
  best?: number;
};

export default function StreakWidget({ current, best }: StreakWidgetProps) {
  const { theme } = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={[
        styles.container,
        theme.shadow(1),
        {
          backgroundColor: `${theme.colors.orange}20`,
          borderColor: `${theme.colors.orange}50`,
        },
      ]}
    >
      <Animated.Text style={[styles.flame, { transform: [{ scale: pulse }] }]}>🔥</Animated.Text>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.h3, { color: theme.colors.orange }]}>{current} días</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Racha actual{typeof best === 'number' ? ` · Mejor ${best}` : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flame: {
    fontSize: 24,
  },
});
