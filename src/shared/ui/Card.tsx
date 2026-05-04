import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/theme';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'pink' | 'cyan';
}>;

export default function Card({ children, style, variant = 'default' }: CardProps) {
  const { theme } = useAppTheme();

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
});