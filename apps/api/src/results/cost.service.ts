import { Inject, Injectable } from '@nestjs/common';
import type { ValidSearchInput } from '@tripsaver/domain';
import {
  buildPlanCost,
  type Clock,
  type CostSection,
  type DatesSection,
  type HotelsSection,
  type PlanCostView,
  type PricedWindow,
  type ProviderSet,
  type TripStyle,
} from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

/** "Total & book" (PLAN §6.7): each plan's cost by part and its booking checklist. */
@Injectable()
export class CostService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  plan(
    input: ValidSearchInput,
    style: TripStyle,
    w: PricedWindow,
    hotels?: HotelsSection | null,
  ): Promise<PlanCostView> {
    return buildPlanCost(
      this.providers,
      input,
      style,
      w,
      { clock: this.clock, timeoutMs: this.timeoutMs },
      hotels,
    );
  }

  /** Every plan at its cheapest dates; `budgetHotels` reuses the hotels already streamed for the Budget plan. */
  async all(
    input: ValidSearchInput,
    dates: DatesSection,
    budgetHotels: HotelsSection | null,
  ): Promise<CostSection> {
    const plans = await Promise.all(
      dates.styles.map(async (s): Promise<PlanCostView> => {
        const w = s.top[0];
        if (!w) return { style: s.style, available: false };
        return this.plan(input, s.style, w, s.style === 'budget' ? budgetHotels : undefined).catch(
          (): PlanCostView => ({ style: s.style, available: false }),
        );
      }),
    );
    return { plans };
  }
}
