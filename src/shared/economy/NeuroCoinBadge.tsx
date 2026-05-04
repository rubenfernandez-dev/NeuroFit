import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';
import {
  formatNeuroCoinCostCompact,
  formatNeuroCoinRewardCompact,
  formatNeuroCoins,
  formatNeuroCoinsCompact,
  toSafeNeuroCoinAmount,
} from './neuroCoins';

type NeuroCoinBadgeProps = {
  amount: number;
  variant?: 'compact' | 'full' | 'reward' | 'cost';
  compact?: boolean;
};

export default function NeuroCoinBadge({ amount, compact = false, variant = 'compact' }: NeuroCoinBadgeProps) {
  const { theme } = useAppTheme();
  const safeAmount = toSafeNeuroCoinAmount(amount);
  const resolvedVariant: NeuroCoinBadgeProps['variant'] = compact ? 'compact' : variant;

  const tone =
    resolvedVariant === 'reward'
      ? { border: '#F59E0B', background: theme.mode === 'dark' ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)', text: '#FDE68A' }
      : resolvedVariant === 'cost'
        ? { border: theme.colors.border, background: theme.colors.bg1, text: theme.colors.text }
        : { border: '#22D3EE', background: theme.mode === 'dark' ? 'rgba(34,211,238,0.16)' : 'rgba(34,211,238,0.12)', text: theme.colors.text };

  const label =
    resolvedVariant === 'reward'
      ? formatNeuroCoinRewardCompact(safeAmount)
      : resolvedVariant === 'cost'
        ? formatNeuroCoinCostCompact(safeAmount)
        : resolvedVariant === 'full'
          ? formatNeuroCoins(safeAmount)
          : formatNeuroCoinsCompact(safeAmount);

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone.border,
        backgroundColor: tone.background,
        paddingHorizontal: resolvedVariant === 'full' ? 12 : 10,
        paddingVertical: resolvedVariant === 'full' ? 6 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tone.text, fontWeight: '800', fontSize: resolvedVariant === 'full' ? 13 : 12 }}>{label}</Text>
    </View>
  );
}
