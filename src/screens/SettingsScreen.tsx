import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { ThemePreference, resetProfile } from '../shared/storage/profile';
import { resetStats } from '../shared/storage/stats';
import { resetDaily } from '../shared/storage/daily';

const options: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { theme, preference, setPreference } = useAppTheme();

  const confirmReset = () => {
    Alert.alert('Reset progreso', 'Esto borrará stats, perfil y reto diario.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([resetStats(), resetProfile(), resetDaily()]);
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Tema</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {options.map((option) => (
            <Button
              key={option}
              title={option === preference ? `✓ ${option}` : option}
              variant={option === preference ? 'primary' : 'secondary'}
              onPress={() => setPreference(option)}
            />
          ))}
        </View>
      </Card>

      <Button title="Reset progreso" onPress={confirmReset} variant="ghost" />
    </ScrollView>
  );
}