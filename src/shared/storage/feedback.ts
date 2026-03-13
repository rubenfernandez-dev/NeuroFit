import { STORAGE_KEYS } from './keys';
import { deleteItem, getItem, setItem } from './secureStore';
import type { GameFeedbackPreferences } from '../feedback/gameFeedback';
import { captureException, logWarning } from '../observability';

export type FeedbackPrefs = GameFeedbackPreferences;

const defaultPrefs: FeedbackPrefs = {
  enabled: true,
  soundEnabled: true,
  hapticsEnabled: true,
  celebrationEnabled: true,
};

export async function getFeedbackPrefs(): Promise<FeedbackPrefs> {
  const raw = await getItem(STORAGE_KEYS.feedback);
  if (!raw) return defaultPrefs;

  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultPrefs.enabled,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaultPrefs.soundEnabled,
      hapticsEnabled: typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : defaultPrefs.hapticsEnabled,
      celebrationEnabled:
        typeof parsed.celebrationEnabled === 'boolean' ? parsed.celebrationEnabled : defaultPrefs.celebrationEnabled,
    };
  } catch (error) {
    logWarning('storage.feedback.corrupt_or_invalid', { storageKey: STORAGE_KEYS.feedback });
    captureException(error, { area: 'storage.feedback.getFeedbackPrefs', category: 'corrupt_data' });
    await deleteItem(STORAGE_KEYS.feedback);
    return defaultPrefs;
  }
}

export async function updateFeedbackPrefs(partial: Partial<FeedbackPrefs>): Promise<FeedbackPrefs> {
  const current = await getFeedbackPrefs();
  const next = { ...current, ...partial };
  await setItem(STORAGE_KEYS.feedback, JSON.stringify(next));
  return next;
}

export async function resetFeedbackPrefs() {
  await deleteItem(STORAGE_KEYS.feedback);
}
