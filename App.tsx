import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/app/AppNavigator';
import { ThemeProvider, useAppTheme } from './src/shared/theme/theme';
import { getNotificationPrefs, updateNotificationPrefs } from './src/shared/storage/notifications';
import { ensureAndroidChannel, requestNotifPermissions, scheduleDailyReminder } from './src/shared/notifications/notifications';
import { ensureSeasonCurrent } from './src/shared/storage/profile';
import { CelebrationOverlay } from './src/shared/feedback/celebration';
import { getFeedbackPrefs } from './src/shared/storage/feedback';
import { updateGameFeedbackPreferences } from './src/shared/feedback/gameFeedback';
import { captureException, classifyDataFailure, formatLoadFailureMessage, initCrashReporting } from './src/shared/observability';

type BootstrapState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; kind: 'corrupt_data' | 'unexpected_error' };

initCrashReporting();

async function safePreventAutoHideAsync() {
  try {
    await SplashScreen.preventAutoHideAsync?.();
  } catch {
    // If splash API is unavailable in this build, app should still start.
  }
}

async function safeHideSplashAsync() {
  try {
    await SplashScreen.hideAsync?.();
  } catch {
    // If splash API is unavailable in this build, app should still start.
  }
}

// Prevent splash from hiding immediately; keep visible for ~1 second minimum.
void safePreventAutoHideAsync();

function AppContent() {
  const { theme } = useAppTheme();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({ status: 'loading' });

  const bootstrap = useCallback(async () => {
    const splashHideTime = Date.now() + 1000; // Minimum 1 second splash visibility
    setBootstrapState({ status: 'loading' });

    try {
      await ensureSeasonCurrent();

      const hydrateFeedback = async () => {
        const prefs = await getFeedbackPrefs();
        updateGameFeedbackPreferences(prefs);
      };

      const hydrateNotifications = async () => {
        const prefs = await getNotificationPrefs();
        if (!prefs.enabled || prefs.notificationId) return;

        const granted = await requestNotifPermissions();
        if (!granted) return;

        await ensureAndroidChannel();
        const notificationId = await scheduleDailyReminder(prefs.hour, prefs.minute);
        await updateNotificationPrefs({ notificationId });
      };

      await Promise.all([hydrateFeedback(), hydrateNotifications()]);

      // Ensure splash is visible for at least 1 second
      const remainingTime = Math.max(0, splashHideTime - Date.now());
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setBootstrapState({ status: 'ready' });
      await safeHideSplashAsync();
    } catch (error) {
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'app.bootstrap', kind });
      setBootstrapState({ status: 'error', kind });
      await safeHideSplashAsync();
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (bootstrapState.status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B1020', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('./assets/splash.png')}
          style={{ width: '72%', height: '72%' }}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (bootstrapState.status !== 'ready') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg0, justifyContent: 'center', padding: theme.spacing.lg }}>
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>NeuroFit</Text>
        <>
          <Text style={[theme.typography.body, { color: theme.colors.muted, marginTop: 10 }]}>
            {formatLoadFailureMessage(bootstrapState.kind)}
          </Text>
          <Pressable
            onPress={bootstrap}
            style={{
              marginTop: 16,
              backgroundColor: theme.colors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={[theme.typography.label, { color: '#FFFFFF' }]}>Reintentar</Text>
          </Pressable>
        </>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      <CelebrationOverlay />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
