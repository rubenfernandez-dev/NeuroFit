import React from 'react';
import { Text, View } from 'react-native';
import Card from '../../../shared/ui/Card';
import TimerDisplay from '../../../shared/ui/TimerDisplay';
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.success, fontSize: 18, fontWeight: '600' }}>✅</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{correct}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.danger, fontSize: 18, fontWeight: '600' }}>❌</Text>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{wrong}</Text>
          </View>
        </View>
        <TimerDisplay timeLeft={timeLeft} showAlarmIn={5} compact align="right" />
      </View>
    </Card>
  );
}