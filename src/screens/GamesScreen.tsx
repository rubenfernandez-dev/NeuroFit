import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/routes';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

export default function GamesScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const games = enabledGames();

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {games.map((game) => (
        <Pressable key={game.id} onPress={() => navigation.navigate(game.routeName, { gameId: game.id })}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 28 }}>{game.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{game.title}</Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>{game.subtitle}</Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 22 }}>›</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}