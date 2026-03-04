import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './routes';
import { DailyChallengeScreen, GamesScreen, HomeScreen, LeaderboardScreen, ProgressScreen, SettingsScreen } from '../screens';
import { SudokuScreen } from '../games/sudoku';
import { MemoryScreen } from '../games/memory';
import { MentalMathScreen } from '../games/mentalmath';
import { useAppTheme } from '../shared/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { theme } = useAppTheme();

  return (
    <NavigationContainer
      theme={
        theme.mode === 'dark'
          ? {
              ...DarkTheme,
              colors: {
                ...DarkTheme.colors,
                background: theme.colors.background,
                card: theme.colors.surface,
                text: theme.colors.text,
                border: theme.colors.border,
                primary: theme.colors.primary,
              },
            }
          : {
              ...DefaultTheme,
              colors: {
                ...DefaultTheme.colors,
                background: theme.colors.background,
                card: theme.colors.surface,
                text: theme.colors.text,
                border: theme.colors.border,
                primary: theme.colors.primary,
              },
            }
      }
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NeuroFit' }} />
        <Stack.Screen name="Games" component={GamesScreen} options={{ title: 'Juegos' }} />
        <Stack.Screen name="DailyChallenge" component={DailyChallengeScreen} options={{ title: 'Reto diario' }} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Ranking semanal' }} />
        <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progreso' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
        <Stack.Screen name="Sudoku" component={SudokuScreen} options={{ title: 'Sudoku' }} />
        <Stack.Screen name="Memory" component={MemoryScreen} options={{ title: 'Memory' }} />
        <Stack.Screen name="MentalMath" component={MentalMathScreen} options={{ title: 'Mental Math' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}