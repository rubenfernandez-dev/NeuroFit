import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
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
    durationMs: Math.max(700, options?.durationMs ?? 1650),
    particleCount: Math.max(12, options?.particleCount ?? 28),
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
  const { width, height } = useWindowDimensions();
  const { theme } = useAppTheme();
  const [event, setEvent] = useState<CelebrationEvent | null>(null);

  const particlesRef = useRef<ConfettiParticle[]>([]);
  const translateValuesRef = useRef<Animated.Value[]>([]);
  const rotateValuesRef = useRef<Animated.Value[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
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
      x: ((index + 0.5) * width) / event.particleCount + (((index * 19) % 15) - 7) * 6,
      size: 10 + (index % 7),
      color: palette[index % palette.length],
      drift: (index % 2 === 0 ? -1 : 1) * (42 + (index % 5) * 12),
      rotateDeg: (index % 2 === 0 ? -1 : 1) * (220 + (index % 6) * 45),
    }));

    translateValuesRef.current = particlesRef.current.map((_, index) => new Animated.Value(-32 - (index % 4) * 10));
    // Keep rotation progress normalized to avoid invalid interpolate input ranges.
    rotateValuesRef.current = particlesRef.current.map(() => new Animated.Value(0));

    opacity.setValue(1);
    flashOpacity.setValue(0);

    const anims = particlesRef.current.map((particle, index) => {
      const translate = translateValuesRef.current[index];
      const rotate = rotateValuesRef.current[index];
      return Animated.parallel([
        Animated.timing(translate, {
          toValue: height * 0.92 + index * 10,
          duration: event.durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: event.durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);
    });

    const fadeOut = Animated.timing(opacity, {
      toValue: 0,
      duration: 320,
      delay: Math.max(0, event.durationMs - 320),
      useNativeDriver: true,
    });

    const flash = Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 0.2,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const all = Animated.parallel([...anims, fadeOut, flash]);
    animationsRef.current = [all];
    all.start(({ finished }) => {
      if (finished) setEvent(null);
    });

    return () => {
      animationsRef.current.forEach((anim) => anim.stop());
      animationsRef.current = [];
    };
  }, [event, flashOpacity, height, opacity, palette, width]);

  if (!event) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => undefined} statusBarTranslucent>
      <View
        pointerEvents="none"
        style={{
          flex: 1,
          backgroundColor: 'transparent',
        }}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: flashOpacity,
              backgroundColor: theme.mode === 'dark' ? '#FFFFFF' : theme.colors.primarySoft,
            },
          ]}
        />
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity }]}> 
          {particlesRef.current.map((particle, index) => {
            const translateY = translateValuesRef.current[index];
            const driftX = rotateValuesRef.current[index]?.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, particle.drift * 0.55, particle.drift],
            });
            const endRotateDeg = Number.isFinite(particle.rotateDeg) ? particle.rotateDeg : 0;
            const rotate = rotateValuesRef.current[index]?.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${endRotateDeg}deg`],
            });
            const scale = rotateValuesRef.current[index]?.interpolate({
              inputRange: [0, 0.12, 0.7, 1],
              outputRange: [0.75, 1.22, 1.04, 0.92],
            });
            const particleOpacity = rotateValuesRef.current[index]?.interpolate({
              inputRange: [0, 0.08, 0.86, 1],
              outputRange: [0, 1, 1, 0],
            });

            return (
              <Animated.View
                key={`${event.key}-${index}`}
                style={{
                  position: 'absolute',
                  left: particle.x,
                  top: -36,
                  width: particle.size,
                  height: particle.size * 1.5,
                  borderRadius: 3,
                  backgroundColor: particle.color,
                  opacity: particleOpacity ?? 1,
                  shadowColor: particle.color,
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  transform: [
                    { translateY: translateY ?? 0 },
                    { translateX: driftX ?? 0 },
                    { scale: scale ?? 1 },
                    { rotate: rotate ?? '0deg' },
                  ],
                }}
              />
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}
