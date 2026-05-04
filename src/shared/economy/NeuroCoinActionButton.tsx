import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';
import { formatNeuroCoinCostCompact } from './neuroCoins';

type NeuroCoinActionButtonProps = {
  label: string;
  cost: number;
  icon?: string;
  disabled?: boolean;
  onPress: () => void;
  usesLeft?: number;
};

export default function NeuroCoinActionButton({ label, cost, icon, disabled = false, onPress, usesLeft }: NeuroCoinActionButtonProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 14,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.border : theme.colors.primary,
        backgroundColor: disabled
          ? theme.colors.bg1
          : theme.mode === 'dark'
            ? 'rgba(59,130,246,0.20)'
            : 'rgba(59,130,246,0.14)',
        opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        paddingHorizontal: 10,
        paddingVertical: 8,
        minHeight: 42,
        justifyContent: 'center',
        gap: 2,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
          {icon ? `${icon} ${label}` : label}
        </Text>
        <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>
          {formatNeuroCoinCostCompact(cost)}
        </Text>
      </View>
      {typeof usesLeft === 'number' ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
          Usos restantes: {Math.max(0, usesLeft)}
        </Text>
      ) : null}
    </Pressable>
  );
}