import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { CognitiveCategory } from '../theme/categoryColors';
import { getCategoryColors } from '../theme/categoryColors';
import { useAppTheme } from '../theme/theme';

type AnimatedProgressBarProps = {
  value: number;
  label?: string;
  color?: string;
  category?: CognitiveCategory;
  height?: number;
  durationMs?: number;
};

export default function AnimatedProgressBar({
  value,
  label,
  color,
  category,
  height = 10,
  durationMs = 320,
}: AnimatedProgressBarProps) {
  const { theme } = useAppTheme();
  const catColors = getCategoryColors(theme.mode);
  const animated = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const clamped = Math.max(0, Math.min(1, value));
  const barColor = color ?? (category ? catColors[category] : theme.colors.primary);

  useEffect(() => {
    Animated.timing(animated, {
      toValue: clamped,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [animated, clamped, durationMs]);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>{label}</Text> : null}
      <View
        onLayout={onTrackLayout}
        style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.colors.border }]}
      >
        {trackWidth > 0 ? (
          <Animated.View
            style={{
              height: '100%',
              width: animated.interpolate({
                inputRange: [0, 1],
                outputRange: [0, trackWidth],
              }),
              backgroundColor: barColor,
              borderRadius: height / 2,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
