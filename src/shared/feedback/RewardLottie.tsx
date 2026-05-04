import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export type LottieAnimationType = 'confetti' | 'chest' | 'trophy' | 'coin';

const FALLBACK_EMOJI: Record<LottieAnimationType, string> = {
  confetti: '🎉',
  chest: '🎁',
  trophy: '🏆',
  coin: '🪙',
};

type RewardLottieProps = {
  type: LottieAnimationType;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  mountDelayMs?: number;
  safeMode?: boolean;
  fallbackEmoji?: string;
};

export default function RewardLottie({
  type,
  size = 80,
  loop = false,
  autoPlay = true,
  mountDelayMs = 140,
  safeMode = false,
  fallbackEmoji,
}: RewardLottieProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const resolvedSize = useMemo(() => {
    if (!Number.isFinite(size) || size <= 0) return 80;
    return Math.round(size);
  }, [size]);

  const emoji = fallbackEmoji ?? FALLBACK_EMOJI[type];

  useEffect(() => {
    const mountDelay = Math.max(0, Math.floor(mountDelayMs));

    entrance.setValue(0);
    pulse.setValue(0);

    let pulseLoop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      Animated.timing(entrance, {
        toValue: 1,
        duration: autoPlay ? 360 : 1,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      const shouldLoop = loop || type === 'coin';
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 640,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 640,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

      if (shouldLoop) {
        pulseLoop.start();
      }
    }, mountDelay);

    return () => {
      clearTimeout(timer);
      pulseLoop?.stop();
    };
  }, [autoPlay, entrance, loop, mountDelayMs, pulse, type]);

  const baseScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });

  const popScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, type === 'coin' ? 1.15 : 1.08],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.55],
  });

  if (safeMode) {
    return (
      <View style={{ width: resolvedSize, height: resolvedSize, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: resolvedSize * 0.55 }}>{emoji}</Text>
      </View>
    );
  }

  return (
    <View style={{ width: resolvedSize, height: resolvedSize, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: resolvedSize * 0.86,
          height: resolvedSize * 0.86,
          borderRadius: resolvedSize,
          backgroundColor: type === 'coin' ? 'rgba(250,204,21,0.28)' : 'rgba(129,140,248,0.24)',
          opacity: glowOpacity,
          transform: [{ scale: popScale }],
        }}
      />
      <Animated.View style={{ opacity: entrance, transform: [{ scale: baseScale }, { scale: popScale }] }}>
        <Text style={{ fontSize: resolvedSize * 0.56 }}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}
