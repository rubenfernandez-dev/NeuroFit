import React, { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { useAppTheme } from '../theme/theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: object;
}>;

export default function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const { theme } = useAppTheme();
  const body = (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg0,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          backgroundColor: theme.colors.primarySoft,
          opacity: theme.mode === 'dark' ? 0.24 : 0.5,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      />
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: theme.spacing.lg, gap: theme.spacing.md }, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ padding: theme.spacing.lg, gap: theme.spacing.md }, contentStyle]}>{children}</View>
      )}
    </View>
  );

  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg0 }}>{body}</SafeAreaView>;
}
