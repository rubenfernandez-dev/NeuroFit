import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { getProfile } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const [xpTotal, setXpTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getProfile().then((profile) => setXpTotal(profile.xpTotal));
    }, []),
  );

  const level = getLevelByXp(xpTotal);
  const nextLevel = getNextLevel(xpTotal);
  const progress = nextLevel
    ? (xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Text style={[theme.typography.h1, { color: theme.colors.text }]}>NeuroFit</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>Entrena tu mente como entrenas tu cuerpo</Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Button title="Jugar" onPress={() => navigation.navigate('Games')} />
        <Button title="Reto diario" variant="secondary" onPress={() => navigation.navigate('DailyChallenge')} />
        <Button title="Progreso" variant="secondary" onPress={() => navigation.navigate('Progress')} />
      </View>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Nivel actual</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 6 }]}>
          {level.badgeEmoji} {level.name} · {xpTotal} XP
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: 10 }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          {nextLevel ? `Siguiente: ${nextLevel.name} (${nextLevel.minXp} XP)` : 'Nivel máximo alcanzado'}
        </Text>
      </Card>

      <Button title="Ajustes" variant="ghost" onPress={() => navigation.navigate('Settings')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});