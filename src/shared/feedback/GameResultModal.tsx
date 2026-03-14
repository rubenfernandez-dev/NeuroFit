import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Text, View } from 'react-native';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { useAppTheme } from '../theme/theme';

type ResultVariant = 'victory' | 'defeat' | 'neutral';

type MetricRow = {
  label: string;
  value: string | number;
};

type Action = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type GameResultModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  variant?: ResultVariant;
  title: string;
  subtitle?: string;
  metrics: MetricRow[];
  primaryAction: Action;
  secondaryAction?: Action;
};

export default function GameResultModal({
  visible,
  onRequestClose,
  variant = 'neutral',
  title,
  subtitle,
  metrics,
  primaryAction,
  secondaryAction,
}: GameResultModalProps) {
  const { theme } = useAppTheme();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      entrance.setValue(0);
      return;
    }

    entrance.setValue(0);
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(entrance, {
        toValue: 1,
        speed: 13,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entrance, visible]);

  const scale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const translateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const variantMeta = useMemo(() => {
    if (variant === 'victory') {
      return {
        icon: '🏆',
        accent: theme.colors.success,
        badgeText: 'Victoria',
      };
    }
    if (variant === 'defeat') {
      return {
        icon: '⚠️',
        accent: theme.colors.danger,
        badgeText: 'Resultado',
      };
    }
    return {
      icon: '✨',
      accent: theme.colors.primary,
      badgeText: 'Resultado',
    };
  }, [theme.colors.danger, theme.colors.primary, theme.colors.success, variant]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: theme.mode === 'dark' ? '#020617' : '#0F172A',
            opacity: 0.5,
          }}
        />

        <Animated.View
          style={{
            opacity: entrance,
            transform: [{ translateY }, { scale }],
          }}
        >
          <Card
            style={{
              borderColor: variantMeta.accent,
              borderWidth: 1.5,
              shadowColor: variantMeta.accent,
              shadowOpacity: theme.mode === 'dark' ? 0.28 : 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>{variantMeta.icon}</Text>
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: variantMeta.accent,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>{variantMeta.badgeText}</Text>
              </View>
            </View>

            <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 10 }]}>{title}</Text>
            {subtitle ? <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>{subtitle}</Text> : null}

            <View style={{ marginTop: 12 }}>
              {metrics.map((metric) => (
                <View key={metric.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: theme.colors.textMuted }}>{metric.label}</Text>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{metric.value}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button title={primaryAction.label} onPress={primaryAction.onPress} variant={primaryAction.variant ?? 'primary'} style={{ flex: 1 }} />
              {secondaryAction ? (
                <Button
                  title={secondaryAction.label}
                  onPress={secondaryAction.onPress}
                  variant={secondaryAction.variant ?? 'secondary'}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </Card>
        </Animated.View>
      </View>
    </Modal>
  );
}
