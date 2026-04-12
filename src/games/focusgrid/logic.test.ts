import { describe, expect, it } from 'vitest';
import { applyFocusGridCorrectTimeBonus } from './logic';

describe('focusgrid time bonus', () => {
  it('suma +1s por acierto', () => {
    expect(applyFocusGridCorrectTimeBonus(20, 40)).toBe(21);
  });

  it('respeta cap de tiempo maximo', () => {
    expect(applyFocusGridCorrectTimeBonus(130, 40)).toBe(130);
  });
});
