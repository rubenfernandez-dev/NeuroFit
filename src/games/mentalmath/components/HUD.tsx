import React from 'react';
import { Text, View } from 'react-native';
import Card from '../../../shared/ui/Card';
import { useAppTheme } from '../../../shared/theme/theme';

type HUDProps = {
  timeLeft: number;
  correct: number;
  wrong: number;
};

export default function HUD({ timeLeft, correct, wrong }: HUDProps) {
  const { theme } = useAppTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.text }}>⏱️ {timeLeft}s</Text>
        <Text style={{ color: theme.colors.success }}>✅ {correct}</Text>
        <Text style={{ color: theme.colors.danger }}>❌ {wrong}</Text>
      </View>
    </Card>
  );
}