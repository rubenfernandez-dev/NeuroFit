import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { RewardChestGrant } from '../gamification/rewardChest';
import { useAppTheme } from '../theme/theme';
import RewardLottie from './RewardLottie';

type RewardModalProps = {
  visible: boolean;
  rewardChest?: RewardChestGrant;
};

export default function RewardModal({ visible, rewardChest }: RewardModalProps) {
  const { theme } = useAppTheme();
  const reveal = useRef(new Animated.Value(0)).current;
  const chestPop = useRef(new Animated.Value(0.6)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !rewardChest) {
      reveal.setValue(0);
      chestPop.setValue(0.6);
      glow.setValue(0);
      return;
    }

    reveal.setValue(0);
    chestPop.setValue(0.6);
    glow.setValue(0);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 620,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 620,
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.parallel([
      Animated.timing(reveal, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(chestPop, {
          toValue: 1.1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(chestPop, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      pulse.start();
    });

    return () => pulse.stop();
  }, [chestPop, glow, reveal, rewardChest, visible]);

  if (!rewardChest) return null;

  const isXp = rewardChest.rewardType === 'xp';
  const isNeuroCoins = rewardChest.rewardType === 'neurocoins';

  const translateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <Animated.View
      style={{
        marginTop: 14,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: theme.colors.cyan,
        backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.88)' : 'rgba(224,242,254,0.80)',
        paddingHorizontal: 16,
        paddingVertical: 16,
        opacity: reveal,
        transform: [{ translateY }],
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: -26,
          right: -26,
          width: 170,
          height: 170,
          borderRadius: 999,
          backgroundColor: theme.mode === 'dark' ? 'rgba(14,165,233,0.22)' : 'rgba(56,189,248,0.20)',
          opacity: glow,
        }}
      />

      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: chestPop }] }}>
          <RewardLottie type="chest" size={116} loop autoPlay mountDelayMs={80} />
        </Animated.View>
        <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 20, marginTop: 4 }}>Cofre desbloqueado</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 13, textAlign: 'center' }}>
          Recompensa por {rewardChest.cycleGames} partidas completadas
        </Text>

        <View
          style={{
            marginTop: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: isXp ? '#A78BFA' : '#FACC15',
            backgroundColor: isXp ? 'rgba(167,139,250,0.22)' : 'rgba(250,204,21,0.18)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {isXp ? (
            <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 16 }}>+{rewardChest.amount} XP</Text>
          ) : (
            <>
              <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 16 }}>+{rewardChest.amount}</Text>
              <RewardLottie type="coin" size={22} loop autoPlay mountDelayMs={80} />
              <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 16 }}>NeuroCoins</Text>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}