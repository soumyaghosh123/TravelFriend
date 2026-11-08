import { Inject, Injectable } from '@nestjs/common';
import { diffDays, type ValidSearchInput } from '@tripsaver/domain';
import { buildHotelsSection, type Clock, type HotelsSection, type ProviderSet } from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

export interface StayDates {
  checkIn: string;
  checkOut: string;
}

/** Hotels for a stay: every property with per-site prices (brief §3.1). */
@Injectable()
export class HotelsService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Both dates in the searched month, check-out not before check-in, at most N−1 nights (PLAN A1). */
  validDates(input: ValidSearchInput, d: StayDates): boolean {
    return (
      d.checkIn.startsWith(input.month) &&
      d.checkOut.startsWith(input.month) &&
      d.checkOut >= d.checkIn &&
      diffDays(d.checkIn, d.checkOut) <= input.days - 1
    );
  }

  compute(input: ValidSearchInput, d: StayDates): Promise<HotelsSection> {
    return buildHotelsSection(
      this.providers,
      { to: input.to, checkIn: d.checkIn, checkOut: d.checkOut, travellers: input.travellers, ...(input.preferences?.stayNear ? { stayNear: input.preferences.stayNear } : {}) },
      { clock: this.clock, timeoutMs: this.timeoutMs },
    );
  }
}
