export function nowISO(): string {
  return new Date().toISOString();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getLocalDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getUtcDayKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isIsoTimestampOnLocalDay(iso: string, reference = new Date()): boolean {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return isSameLocalDay(parsed, reference);
}

export function todayISODate(): string {
  return getUtcDayKey();
}

export function msToClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}