import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/theme';

type PillProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'pink' | 'cyan';
};

export default function Pill({ label, tone = 'default' }: PillProps) {
  const { theme } = useAppTheme();
  const backgroundColor =
    tone === 'success'
      ? theme.colors.green
      : tone === 'warning'
        ? theme.colors.orange
        : tone === 'danger'
          ? theme.colors.red
          : tone === 'pink'
            ? theme.colors.pink
            : tone === 'cyan'
              ? theme.colors.cyan
              : theme.colors.primarySoft;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.text, { color: tone === 'default' ? theme.colors.text : '#FFFFFF' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});