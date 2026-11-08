import type { Mode, PricingRule, Travellers } from '../types.js';

const MODES: Mode[] = ['train', 'bus', 'flight', 'hotel'];

/** Brief §2.4 defaults: under 4 free, 4–7 half, 8+ full. Labelled as estimates when used. */
export const DEFAULT_PRICING_RULES: PricingRule[] = MODES.flatMap((mode) => [
  { mode, providerId: null, minAge: 0, maxAge: 3, multiplier: 0, fareType: 'free' as const },
  { mode, providerId: null, minAge: 4, maxAge: 7, multiplier: 0.5, fareType: 'half' as const },
  { mode, providerId: null, minAge: 8, maxAge: null, multiplier: 1, fareType: 'full' as const },
]);

function matches(rule: PricingRule, age: number, mode: Mode): boolean {
  return rule.mode === mode && age >= rule.minAge && (rule.maxAge === null || age <= rule.maxAge);
}

/** The rule for this age: a provider-specific rule wins over the mode's default. */
export function fareTypeForAge(age: number, mode: Mode, providerId: string, rules: PricingRule[]): PricingRule {
  const specific = rules.find((r) => r.providerId === providerId && matches(r, age, mode));
  if (specific) return specific;
  const fallback = rules.find((r) => r.providerId === null && matches(r, age, mode));
  if (!fallback) throw new RangeError(`No pricing rule for age ${age} (${mode}, ${providerId})`);
  return fallback;
}

export function validateTravellers(t: Travellers): void {
  if (!Number.isInteger(t.adults) || t.adults < 1) {
    throw new RangeError('At least one adult is required');
  }
  for (const age of t.childAges) {
    if (!Number.isInteger(age) || age < 0 || age > 17) {
      throw new RangeError(`Child age must be a whole number from 0 to 17, got ${age}`);
    }
  }
}
