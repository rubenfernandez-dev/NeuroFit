import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { RewardChestGrant } from '../gamification/rewardChest';
import { useAppTheme } from '../theme/theme';

type RewardModalProps = {
  visible: boolean;
  rewardChest?: RewardChestGrant;
};

export default function RewardModal({ visible, rewardChest }: RewardModalProps) {
  const { theme } = useAppTheme();
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !rewardChest) {
      reveal.setValue(0);
      return;
    }

    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [reveal, rewardChest, visible]);

  if (!rewardChest) return null;

  const isXp = rewardChest.rewardType === 'xp';
  const rewardLabel = isXp ? `+${rewardChest.amount} XP` : `+${rewardChest.amount} NeuroCoins`;

  const translateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <Animated.View
      style={{
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        backgroundColor: theme.mode === 'dark' ? 'rgba(59,130,246,0.20)' : 'rgba(59,130,246,0.12)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        opacity: reveal,
        transform: [{ translateY }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '900' }}>🎁 Cofre desbloqueado</Text>
        <Text style={{ color: theme.colors.text, fontWeight: '800' }}>{rewardLabel}</Text>
      </View>
      <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>
        Recompensa por {rewardChest.cycleGames} partidas completadas.
      </Text>
    </Animated.View>
  );
}