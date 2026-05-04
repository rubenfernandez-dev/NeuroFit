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
  highlighted?: boolean;
  tone?: 'blue' | 'green';
};

export default function NeuroCoinActionButton({
  label,
  cost,
  icon,
  disabled = false,
  onPress,
  usesLeft,
  highlighted = false,
  tone,
}: NeuroCoinActionButtonProps) {
  const { theme } = useAppTheme();
  const emphasized = highlighted || cost >= 20;
  const resolvedTone = tone ?? (emphasized ? 'green' : 'blue');

  const activeBackground = resolvedTone === 'green'
    ? theme.mode === 'dark' ? 'rgba(34,197,94,0.20)' : 'rgba(34,197,94,0.14)'
    : theme.mode === 'dark' ? 'rgba(59,130,246,0.22)' : 'rgba(37,99,235,0.14)';
  const activeBorder = resolvedTone === 'green'
    ? theme.mode === 'dark' ? 'rgba(34,197,94,0.58)' : 'rgba(22,163,74,0.50)'
    : theme.mode === 'dark' ? 'rgba(59,130,246,0.62)' : 'rgba(37,99,235,0.54)';

  const emphasizedBackground = resolvedTone === 'green'
    ? theme.mode === 'dark' ? 'rgba(22,163,74,0.28)' : 'rgba(22,163,74,0.18)'
    : theme.mode === 'dark' ? 'rgba(37,99,235,0.30)' : 'rgba(37,99,235,0.20)';
  const emphasizedBorder = resolvedTone === 'green'
    ? theme.mode === 'dark' ? 'rgba(22,163,74,0.72)' : 'rgba(22,163,74,0.64)'
    : theme.mode === 'dark' ? 'rgba(37,99,235,0.74)' : 'rgba(37,99,235,0.68)';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 17,
        borderWidth: 1,
        borderColor: disabled ? 'rgba(71,85,105,0.45)' : emphasized ? emphasizedBorder : activeBorder,
        backgroundColor: disabled
          ? theme.mode === 'dark'
            ? 'rgba(15,23,42,0.56)'
            : 'rgba(226,232,240,0.86)'
          : emphasized
            ? emphasizedBackground
            : activeBackground,
        opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        paddingHorizontal: 11,
        paddingVertical: 7,
        minHeight: 42,
        justifyContent: 'center',
        gap: 3,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>
          {icon ? `${icon} ${label}` : label}
        </Text>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,193,7,0.35)',
            backgroundColor: 'rgba(255,193,7,0.12)',
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: '#FDE68A', fontWeight: '800', fontSize: 10 }} numberOfLines={1}>
            {formatNeuroCoinCostCompact(cost)}
          </Text>
        </View>
      </View>
      {typeof usesLeft === 'number' ? (
        <Text style={{ color: theme.mode === 'dark' ? '#CBD5E1' : '#64748B', fontSize: 10 }} numberOfLines={1}>
          Usos restantes: {Math.max(0, usesLeft)}
        </Text>
      ) : null}
    </Pressable>
  );
}