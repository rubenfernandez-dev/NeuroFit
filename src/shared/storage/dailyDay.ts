type DailyDayBoundState = {
  dateISO: string;
  lastDailyDateISO: string;
};

export function migrateLegacyUtcDailyToLocalDay<T extends DailyDayBoundState>(
  current: T,
  localDayKey: string,
  utcDayKey: string,
): T | null {
  if (localDayKey === utcDayKey) return null;
  if (current.lastDailyDateISO !== utcDayKey) return null;

  return {
    ...current,
    dateISO: localDayKey,
    lastDailyDateISO: localDayKey,
  };
}