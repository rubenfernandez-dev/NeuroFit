import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const DAILY_CHANNEL_ID = 'neurofit-daily-reminder';
const DAILY_TITLE = 'NeuroFit';
const DAILY_BODY = 'Tu reto diario está listo. ¡Mantén tu racha!';

let lastScheduledHour = 20;
let lastScheduledMinute = 0;
let androidChannelReady = false;
let androidChannelPromise: Promise<void> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotifPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = requested.status;
  }

  return status === 'granted';
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (androidChannelReady) return;
  if (androidChannelPromise) return androidChannelPromise;

  androidChannelPromise = Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
    name: 'Recordatorio diario NeuroFit',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  }).then(() => {
    androidChannelReady = true;
  }).finally(() => {
    androidChannelPromise = null;
  });

  await androidChannelPromise;
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string> {
  lastScheduledHour = hour;
  lastScheduledMinute = minute;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: DAILY_TITLE,
      body: DAILY_BODY,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

export async function cancelDailyReminder(notificationId: string): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// TODO: Remove if settings/reset flows never need a global reminder cleanup action.
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// TODO: Remove if the UI continues to rely on the persisted reminder time instead.
export function getNextTriggerInfo(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(lastScheduledHour, lastScheduledMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const hh = String(next.getHours()).padStart(2, '0');
  const mm = String(next.getMinutes()).padStart(2, '0');
  return `Siguiente recordatorio: ${hh}:${mm}`;
}
