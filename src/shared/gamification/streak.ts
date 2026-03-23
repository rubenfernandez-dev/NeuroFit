import type { Profile } from '../storage/profile';
import { getLocalDayKey } from '../utils/time';
import { logEvent, logWarn } from '../../core/telemetry';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  return getLocalDayKey(d);
}

function parseISODateLocal(iso: string): Date {
  if (!isISODate(iso)) return new Date(Number.NaN);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function isISODate(iso: string): boolean {
  return ISO_DATE_REGEX.test(iso);
}

export function diffDaysISO(aISO: string, bISO: string): number {
  if (!isISODate(aISO) || !isISODate(bISO)) {
    return 9999;
  }

  const a = parseISODateLocal(aISO);
  const b = parseISODateLocal(bISO);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return 9999;
  }

  return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS);
}

export type StreakCompletion = {
  profile: Profile;
  incremented: boolean;
  reason: 'first_streak' | 'consecutive_day' | 'streak_reset' | 'already_counted_today';
};

export function applyDailyCompletionToStreak(profile: Profile, todayISO: string): StreakCompletion {
  let streakCurrent = profile.streakCurrent;
  let reason: StreakCompletion['reason'] = 'streak_reset';
  let incremented = false;

  if (!profile.lastDailyCompletedISO) {
    streakCurrent = 1;
    reason = 'first_streak';
    incremented = true;
  } else if (profile.lastDailyCompletedISO === todayISO) {
    // Same day — no increment
    reason = 'already_counted_today';
    incremented = false;
  } else if (diffDaysISO(profile.lastDailyCompletedISO, todayISO) === 1) {
    // Yesterday — increment
    streakCurrent = profile.streakCurrent + 1;
    reason = 'consecutive_day';
    incremented = true;
  } else {
    // 2+ days gap — reset to 1
    streakCurrent = 1;
    reason = 'streak_reset';
    incremented = true;
  }

  const nextBestStreak = Math.max(profile.streakBest, streakCurrent);
  const bestStreakUpdated = nextBestStreak > profile.streakBest;

  logEvent('streak_updated', {
    dateISO: todayISO,
    reason,
    incremented,
    prevStreak: profile.streakCurrent,
    currStreak: streakCurrent,
    bestStreak: nextBestStreak,
    bestStreakUpdated,
  });

  return {
    profile: {
      ...profile,
      streakCurrent,
      streakBest: nextBestStreak,
      lastDailyCompletedISO: todayISO,
    },
    incremented,
    reason,
  };
}
