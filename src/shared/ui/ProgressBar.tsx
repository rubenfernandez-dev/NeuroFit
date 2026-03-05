import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';

type ProgressBarProps = {
  value: number;
  label?: string;
  color?: string;
};

export default function ProgressBar({ value, label, color }: ProgressBarProps) {
  const { theme } = useAppTheme();
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>{label}</Text> : null}
      <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.colors.border }}>
        <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: color ?? theme.colors.primary, borderRadius: 999 }} />
      </View>
    </View>
  );
}
