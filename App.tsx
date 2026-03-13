import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

function AppContent() {
  const { theme } = useAppTheme();
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({ status: 'loading' });

  const bootstrap = useCallback(async () => {
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
      setBootstrapState({ status: 'ready' });
    } catch (error) {
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'app.bootstrap', kind });
      setBootstrapState({ status: 'error', kind });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (bootstrapState.status !== 'ready') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg0, justifyContent: 'center', padding: theme.spacing.lg }}>
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>NeuroFit</Text>
        {bootstrapState.status === 'loading' ? (
          <Text style={[theme.typography.body, { color: theme.colors.muted, marginTop: 10 }]}>Preparando tu sesión...</Text>
        ) : (
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
        )}
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
