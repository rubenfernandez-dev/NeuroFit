import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
};

export default function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const { theme } = useAppTheme();
  const elevated = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        elevated ? theme.shadow(2) : null,
        {
          borderColor: theme.colors.border,
          backgroundColor:
            variant === 'primary'
              ? theme.colors.primary
              : variant === 'secondary'
                ? theme.colors.bg1
                : 'transparent',
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: variant === 'primary' ? '#FFFFFF' : theme.colors.text,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});