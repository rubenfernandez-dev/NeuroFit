import { STORAGE_KEYS } from './keys';
import { deleteItem, getItem, setItem } from './secureStore';
import { captureException, logWarning } from '../observability';

export type NotificationPrefs = {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationId?: string;
};

const defaultPrefs: NotificationPrefs = {
  enabled: false,
  hour: 20,
  minute: 0,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await getItem(STORAGE_KEYS.notifications);
  if (!raw) return defaultPrefs;

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      ...defaultPrefs,
      ...parsed,
      hour: typeof parsed.hour === 'number' ? Math.min(23, Math.max(0, Math.floor(parsed.hour))) : defaultPrefs.hour,
      minute:
        typeof parsed.minute === 'number' ? Math.min(59, Math.max(0, Math.floor(parsed.minute))) : defaultPrefs.minute,
    };
  } catch (error) {
    logWarning('storage.notifications.corrupt_or_invalid', { storageKey: STORAGE_KEYS.notifications });
    captureException(error, { area: 'storage.notifications.getNotificationPrefs', category: 'corrupt_data' });
    await deleteItem(STORAGE_KEYS.notifications);
    return defaultPrefs;
  }
}

export async function updateNotificationPrefs(partial: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const current = await getNotificationPrefs();
  const next = { ...current, ...partial };
  await setItem(STORAGE_KEYS.notifications, JSON.stringify(next));
  return next;
}

export async function resetNotificationPrefs() {
  await deleteItem(STORAGE_KEYS.notifications);
}
