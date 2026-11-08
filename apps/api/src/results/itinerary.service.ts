import { Inject, Injectable } from '@nestjs/common';
import type { ValidSearchInput } from '@tripsaver/domain';
import {
  buildItinerarySection,
  type Clock,
  type HotelsSection,
  type ItinerarySection,
  type PricedWindow,
  type ProviderSet,
  type TripStyle,
} from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

/** Day-by-day plan for one plan style and one priced window (PLAN §6.3–6.5). */
@Injectable()
export class ItineraryService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  compute(input: ValidSearchInput, style: TripStyle, w: PricedWindow, hotels: HotelsSection | null): Promise<ItinerarySection> {
    return buildItinerarySection(this.providers, input, style, w, hotels, { clock: this.clock, timeoutMs: this.timeoutMs });
  }
}
