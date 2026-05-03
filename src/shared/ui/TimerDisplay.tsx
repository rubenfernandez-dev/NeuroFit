import React, { useMemo } from 'react';
import { Animated, Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';

type TimerDisplayProps = {
  timeLeft: number;
  showAlarmIn?: number; // Show alarm visual when timeLeft <= this value (e.g., 5)
  maxTime?: number; // Used for visual indicators
  compact?: boolean;
  align?: 'center' | 'right';
};

/**
 * Premium timer display component for NeuroFit games.
 * Shows large, centered timer with optional visual alarm in last N seconds.
 */
export default function TimerDisplay({
  timeLeft,
  showAlarmIn = 5,
  maxTime = 60,
  compact = false,
  align = 'center',
}: TimerDisplayProps) {
  const { theme } = useAppTheme();

  const isInAlarmZone = showAlarmIn > 0 && timeLeft <= showAlarmIn && timeLeft > 0;
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  // Trigger pulse animation when entering alarm zone
  React.useEffect(() => {
    if (!isInAlarmZone) {
      pulseAnim.setValue(1);
      return;
    }

    // Pulse every 500ms in alarm zone
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isInAlarmZone, pulseAnim]);

  const backgroundColor = isInAlarmZone
    ? pulseAnim.interpolate({
        inputRange: [0.7, 1],
        outputRange: ['rgba(220, 38, 38, 0.8)', 'rgba(220, 38, 38, 0.3)'],
      })
    : theme.colors.bg1;

  const borderColor = isInAlarmZone ? theme.colors.danger : theme.colors.primary;
  const textColor = isInAlarmZone ? theme.colors.danger : theme.colors.primary;

  return (
    <Animated.View
      style={{
        backgroundColor,
        borderRadius: compact ? 14 : 16,
        paddingHorizontal: compact ? 14 : 24,
        paddingVertical: compact ? 8 : 12,
        alignSelf: align === 'right' ? 'flex-end' : 'center',
        borderWidth: isInAlarmZone ? 2 : 1,
        borderColor,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <Text style={{ fontSize: compact ? 18 : 24, fontWeight: '600', color: textColor }}>⏱️</Text>
        <Text
          style={{
            fontSize: compact ? 24 : 32,
            fontWeight: '700',
            color: textColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {timeLeft}s
        </Text>
      </View>
    </Animated.View>
  );
}
