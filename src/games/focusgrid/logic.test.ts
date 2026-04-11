import { describe, expect, it } from 'vitest';
import { applyFocusGridCorrectTimeBonus } from './logic';

describe('focusgrid time bonus', () => {
  it('suma +3s por acierto', () => {
    expect(applyFocusGridCorrectTimeBonus(20, 40, 3, 90)).toBe(23);
  });

  it('respeta cap de tiempo maximo', () => {
    expect(applyFocusGridCorrectTimeBonus(129, 40, 3, 90)).toBe(130);
  });
});
