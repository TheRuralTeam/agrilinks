import { describe, expect, it } from 'vitest';
import { isAvailableForImmediatePurchase } from './purchaseTiming';

describe('isAvailableForImmediatePurchase', () => {
  const today = new Date(2026, 10, 22, 12);

  it('includes products ready today or already ready', () => {
    expect(isAvailableForImmediatePurchase('2026-11-22', today)).toBe(true);
    expect(isAvailableForImmediatePurchase('2026-11-21', today)).toBe(true);
  });

  it('includes products ready in fewer than five days', () => {
    expect(isAvailableForImmediatePurchase('2026-11-26', today)).toBe(true);
  });

  it('keeps products ready in five or more days in future purchases', () => {
    expect(isAvailableForImmediatePurchase('2026-11-27', today)).toBe(false);
  });

  it('does not classify a missing or invalid harvest date as ready now', () => {
    expect(isAvailableForImmediatePurchase(null, today)).toBe(false);
    expect(isAvailableForImmediatePurchase('2026-02-30', today)).toBe(false);
  });
});
