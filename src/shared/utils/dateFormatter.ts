import { getLocalDayKey } from './time';

const esDayMonth = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
});

function parseIsoLike(value: string): Date | null {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatHumanDate(value?: string | null, options?: { todayLabel?: string; fallback?: string }): string {
  if (!value) return options?.fallback ?? '-';
  const date = parseIsoLike(value);
  if (!date) return options?.fallback ?? '-';

  const dayKey = getLocalDayKey(date);
  if (dayKey === getLocalDayKey()) {
    return options?.todayLabel ?? 'Hoy';
  }

  return esDayMonth.format(date);
}

export function formatDurationMsToSeconds(value?: number | null, precision = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const sec = value / 1000;
  return `${sec.toFixed(precision)} s`;
}
