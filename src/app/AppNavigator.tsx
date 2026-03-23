import React, { useCallback, useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isGameRouteName, RootStackParamList } from './routes';
import { DailyChallengeScreen, GamesScreen, HomeScreen, LeaderboardScreen, ProgressScreen, SettingsScreen } from '../screens';
import { SudokuScreen } from '../games/sudoku';
import { MemoryScreen } from '../games/memory';
import { MentalMathScreen } from '../games/mentalmath';
import { SpeedMatchScreen } from '../games/speedmatch';
import { PatternMemoryScreen } from '../games/patternmemory';
import { FocusGridScreen } from '../games/focusgrid';
import { NumberMatchScreen } from '../games/numbermatch';
import { useAppTheme } from '../shared/theme/theme';
import { startFocusAmbient, stopFocusAmbient } from '../shared/feedback/focusAudio';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { theme } = useAppTheme();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const wasOnGameRouteRef = useRef(false);

  const syncAmbientByRoute = useCallback((routeName?: string) => {
    const isGameRoute = isGameRouteName(routeName);

    if (isGameRoute && !wasOnGameRouteRef.current) {
      void startFocusAmbient({ fadeInMs: 620 });
    } else if (!isGameRoute && wasOnGameRouteRef.current) {
      void stopFocusAmbient({ fadeOutMs: 420 });
    }

    wasOnGameRouteRef.current = isGameRoute;
  }, []);

  useEffect(() => {
    return () => {
      void stopFocusAmbient({ fadeOutMs: 120 });
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        syncAmbientByRoute(navigationRef.current?.getCurrentRoute()?.name);
      }}
      onStateChange={() => {
        syncAmbientByRoute(navigationRef.current?.getCurrentRoute()?.name);
      }}
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
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NeuroFit' }} />
        <Stack.Screen name="Games" component={GamesScreen} options={{ title: 'Juegos' }} />
        <Stack.Screen name="DailyChallenge" component={DailyChallengeScreen} options={{ title: 'Reto diario' }} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Ranking local semanal' }} />
        <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progreso' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
        <Stack.Screen name="Sudoku" component={SudokuScreen} options={{ title: 'Sudoku' }} />
        <Stack.Screen name="Memory" component={MemoryScreen} options={{ title: 'Memoria' }} />
        <Stack.Screen name="MentalMath" component={MentalMathScreen} options={{ title: 'Cálculo mental' }} />
        <Stack.Screen name="SpeedMatch" component={SpeedMatchScreen} options={{ title: 'Coincidencia rápida' }} />
        <Stack.Screen name="PatternMemory" component={PatternMemoryScreen} options={{ title: 'Memoria de patrones' }} />
        <Stack.Screen name="FocusGrid" component={FocusGridScreen} options={{ title: 'Cuadrícula de enfoque' }} />
        <Stack.Screen name="NumberMatch" component={NumberMatchScreen} options={{ title: 'Number Match' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}