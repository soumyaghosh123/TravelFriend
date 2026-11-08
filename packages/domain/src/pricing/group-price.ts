import type { GroupPrice, Mode, PricingRule, TravellerPriceLine, Travellers } from '../types.js';
import { DEFAULT_PRICING_RULES, fareTypeForAge, validateTravellers } from './rules.js';

export interface PriceForGroupArgs {
  mode: Mode;
  providerId: string;
  adultUnitPrice: number;
  travellers: Travellers;
  rules?: PricingRule[];
  /** The provider's own price per child, keyed by age. Overrides the rules. */
  providerChildPrices?: Record<number, number>;
}

export function priceForGroup(args: PriceForGroupArgs): GroupPrice {
  const { mode, providerId, adultUnitPrice, travellers } = args;
  const rules = args.rules ?? DEFAULT_PRICING_RULES;
  validateTravellers(travellers);

  const lines: TravellerPriceLine[] = [
    {
      label: 'Adult',
      count: travellers.adults,
      fareType: 'full',
      unitAmount: adultUnitPrice,
      amount: adultUnitPrice * travellers.adults,
      isEstimate: false,
    },
  ];

  for (const age of travellers.childAges) {
    const rule = fareTypeForAge(age, mode, providerId, rules);
    const providerPrice = args.providerChildPrices?.[age];
    const unitAmount = providerPrice ?? Math.round(adultUnitPrice * rule.multiplier);
    lines.push({
      label: rule.fareType === 'free' ? `Infant (${age} y)` : `Child (${age} y)`,
      count: 1,
      fareType: rule.fareType,
      unitAmount,
      amount: unitAmount,
      isEstimate: providerPrice === undefined,
    });
  }

  return {
    total: lines.reduce((s, l) => s + l.amount, 0),
    lines,
    isEstimate: lines.some((l) => l.isEstimate),
  };
}
