import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '../theme/theme';

export default function Divider() {
  const { theme } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}