import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../theme/theme';

type CelebrationEvent = {
  key: number;
  durationMs: number;
  particleCount: number;
};

type Listener = (event: CelebrationEvent) => void;

type ConfettiParticle = {
  x: number;
  size: number;
  color: string;
  drift: number;
  rotateDeg: number;
};

let nextEventKey = 1;
const listeners = new Set<Listener>();

export function triggerCelebration(options?: { durationMs?: number; particleCount?: number }) {
  const event: CelebrationEvent = {
    key: nextEventKey++,
    durationMs: Math.max(400, options?.durationMs ?? 1400),
    particleCount: Math.max(8, options?.particleCount ?? 18),
  };
  listeners.forEach((listener) => listener(event));
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function CelebrationOverlay() {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const [event, setEvent] = useState<CelebrationEvent | null>(null);

  const particlesRef = useRef<ConfettiParticle[]>([]);
  const translateValuesRef = useRef<Animated.Value[]>([]);
  const rotateValuesRef = useRef<Animated.Value[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => subscribe(setEvent), []);

  const palette = useMemo(
    () => [theme.colors.primary, theme.colors.cyan, theme.colors.pink, theme.colors.orange, theme.colors.success],
    [theme.colors.cyan, theme.colors.orange, theme.colors.pink, theme.colors.primary, theme.colors.success],
  );

  useEffect(() => {
    if (!event) return;

    animationsRef.current.forEach((anim) => anim.stop());
    animationsRef.current = [];

    particlesRef.current = Array.from({ length: event.particleCount }, (_, index) => ({
      x: ((index + 0.5) * width) / event.particleCount,
      size: 5 + (index % 4),
      color: palette[index % palette.length],
      drift: (index % 2 === 0 ? -1 : 1) * (10 + (index % 5) * 4),
      rotateDeg: (index % 2 === 0 ? -1 : 1) * (90 + (index % 6) * 20),
    }));

    translateValuesRef.current = particlesRef.current.map(() => new Animated.Value(-18));
    rotateValuesRef.current = particlesRef.current.map(() => new Animated.Value(0));

    opacity.setValue(1);

    const anims = particlesRef.current.map((particle, index) => {
      const translate = translateValuesRef.current[index];
      const rotate = rotateValuesRef.current[index];
      return Animated.parallel([
        Animated.timing(translate, {
          toValue: 260 + index * 3,
          duration: event.durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: particle.rotateDeg,
          duration: event.durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);
    });

    const fadeOut = Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      delay: Math.max(0, event.durationMs - 220),
      useNativeDriver: true,
    });

    const all = Animated.parallel([...anims, fadeOut]);
    animationsRef.current = [all];
    all.start(({ finished }) => {
      if (finished) setEvent(null);
    });

    return () => {
      animationsRef.current.forEach((anim) => anim.stop());
      animationsRef.current = [];
    };
  }, [event, opacity, palette, width]);

  if (!event) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}> 
        {particlesRef.current.map((particle, index) => {
          const translateY = translateValuesRef.current[index];
          const rotate = rotateValuesRef.current[index]?.interpolate({
            inputRange: [0, particle.rotateDeg],
            outputRange: ['0deg', `${particle.rotateDeg}deg`],
          });

          return (
            <Animated.View
              key={`${event.key}-${index}`}
              style={{
                position: 'absolute',
                left: particle.x,
                top: -8,
                width: particle.size,
                height: particle.size * 1.4,
                borderRadius: 2,
                backgroundColor: particle.color,
                transform: [
                  { translateY: translateY ?? 0 },
                  { translateX: particle.drift * (index % 3) },
                  { rotate: rotate ?? '0deg' },
                ],
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}
