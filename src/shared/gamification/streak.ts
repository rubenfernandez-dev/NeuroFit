import type { Profile } from '../storage/profile';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function applyDailyCompletionToStreak(profile: Profile, todayISO: string): Profile {
  let streakCurrent = profile.streakCurrent;

  if (!profile.lastDailyCompletedISO) {
    streakCurrent = 1;
  } else if (profile.lastDailyCompletedISO === todayISO) {
    streakCurrent = profile.streakCurrent;
  } else if (diffDaysISO(profile.lastDailyCompletedISO, todayISO) === 1) {
    streakCurrent = profile.streakCurrent + 1;
  } else {
    streakCurrent = 1;
  }

  return {
    ...profile,
    streakCurrent,
    streakBest: Math.max(profile.streakBest, streakCurrent),
    lastDailyCompletedISO: todayISO,
  };
}
