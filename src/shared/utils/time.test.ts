import { describe, expect, it } from 'vitest';
import { getLocalDayKey, getUtcDayKey, isIsoTimestampOnLocalDay, isSameLocalDay } from './time';

describe('time helpers', () => {
  it('builds a stable local day key', () => {
    const date = new Date(2026, 2, 12, 23, 45, 0, 0);
    expect(getLocalDayKey(date)).toBe('2026-03-12');
  });

  it('builds a stable UTC day key', () => {
    const date = new Date('2026-03-12T23:45:00.000Z');
    expect(getUtcDayKey(date)).toBe('2026-03-12');
  });

  it('compares dates by local calendar day', () => {
    const morning = new Date(2026, 2, 12, 8, 0, 0, 0);
    const evening = new Date(2026, 2, 12, 21, 30, 0, 0);
    const nextDay = new Date(2026, 2, 13, 0, 5, 0, 0);

    expect(isSameLocalDay(morning, evening)).toBe(true);
    expect(isSameLocalDay(morning, nextDay)).toBe(false);
  });

  it('detects if an ISO timestamp falls on the same local day as a reference', () => {
    const reference = new Date(2026, 2, 12, 19, 0, 0, 0);
    const sameDayIso = new Date(2026, 2, 12, 8, 30, 0, 0).toISOString();
    const nextDayIso = new Date(2026, 2, 13, 0, 10, 0, 0).toISOString();

    expect(isIsoTimestampOnLocalDay(sameDayIso, reference)).toBe(true);
    expect(isIsoTimestampOnLocalDay(nextDayIso, reference)).toBe(false);
  });
});