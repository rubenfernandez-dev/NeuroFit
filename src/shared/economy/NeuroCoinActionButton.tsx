import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
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
  containerStyle?: ViewStyle;
};

export default function NeuroCoinActionButton({
  label,
  cost,
  icon,
  disabled = false,
  onPress,
  usesLeft,
  containerStyle,
}: NeuroCoinActionButtonProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 12,
        borderWidth: 1,
        borderColor: disabled ? '#B68A1D' : '#A16207',
        backgroundColor: disabled ? '#E7CF8E' : '#F7C948',
        opacity: disabled ? 0.7 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        paddingHorizontal: 8,
        paddingVertical: 6,
        minHeight: 52,
        justifyContent: 'center',
        gap: 2,
        ...containerStyle,
      })}
    >
      <Text style={{ color: '#3F2A00', fontWeight: '900', fontSize: 11, flexShrink: 1 }} numberOfLines={1}>
        {icon ? `${icon} ${label}` : label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
        <Text style={{ color: '#7C2D12', fontSize: 9, fontWeight: '800' }} numberOfLines={1}>
          {typeof usesLeft === 'number' ? `⚡ ${Math.max(0, usesLeft)} Rest` : '⚡'}
        </Text>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#92400E',
            backgroundColor: '#FDE68A',
            paddingHorizontal: 5,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: '#78350F', fontWeight: '900', fontSize: 9 }} numberOfLines={1}>
            {formatNeuroCoinCostCompact(cost)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}