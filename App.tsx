import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/app/AppNavigator';
import { ThemeProvider, useAppTheme } from './src/shared/theme/theme';
import { getNotificationPrefs, updateNotificationPrefs } from './src/shared/storage/notifications';
import { ensureAndroidChannel, requestNotifPermissions, scheduleDailyReminder } from './src/shared/notifications/notifications';
import { ensureSeasonCurrent } from './src/shared/storage/profile';

function AppContent() {
  const { theme } = useAppTheme();

  useEffect(() => {
    ensureSeasonCurrent();

    const hydrateNotifications = async () => {
      const prefs = await getNotificationPrefs();
      if (!prefs.enabled || prefs.notificationId) return;

      const granted = await requestNotifPermissions();
      if (!granted) return;

      await ensureAndroidChannel();
      const notificationId = await scheduleDailyReminder(prefs.hour, prefs.minute);
      await updateNotificationPrefs({ notificationId });
    };

    hydrateNotifications();
  }, []);

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
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
