import { STORAGE_KEYS } from './keys';
import { getLevelByXp } from '../gamification/levels';
import { nowISO } from '../utils/time';
import { deleteItem, getItem, setItem } from './secureStore';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Profile = {
  themePreference: ThemePreference;
  xpTotal: number;
  levelId: string;
  lastActiveISO: string;
};

const defaultProfile: Profile = {
  themePreference: 'system',
  xpTotal: 0,
  levelId: getLevelByXp(0).id,
  lastActiveISO: nowISO(),
};

export async function getProfile(): Promise<Profile> {
  const raw = await getItem(STORAGE_KEYS.profile);
  if (!raw) return defaultProfile;
  try {
    return { ...defaultProfile, ...JSON.parse(raw) } as Profile;
  } catch {
    return defaultProfile;
  }
}

export async function updateProfile(partial: Partial<Profile>): Promise<Profile> {
  const current = await getProfile();
  const next = { ...current, ...partial, lastActiveISO: nowISO() };
  await setItem(STORAGE_KEYS.profile, JSON.stringify(next));
  return next;
}

export async function resetProfile() {
  await deleteItem(STORAGE_KEYS.profile);
}