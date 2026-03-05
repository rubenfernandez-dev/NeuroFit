import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/theme';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'pink' | 'cyan';
}>;

export default function Card({ children, style, variant = 'default' }: CardProps) {
  const { theme } = useAppTheme();
  const accentColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'success'
        ? theme.colors.green
        : variant === 'warning'
          ? theme.colors.orange
          : variant === 'pink'
            ? theme.colors.pink
            : variant === 'cyan'
              ? theme.colors.cyan
              : 'transparent';

  return (
    <View
      style={[
        styles.card,
        theme.shadow(1),
        {
          backgroundColor: theme.colors.bg1,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {variant !== 'default' ? (
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  accent: {
    height: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
});