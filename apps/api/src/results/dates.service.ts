import { Inject, Injectable } from '@nestjs/common';
import type { ValidSearchInput } from '@tripsaver/domain';
import {
  buildDatesSection,
  DATE_STYLES,
  loadWindows,
  monthEvents,
  windowDetail,
  type Clock,
  type ComputedWindows,
  type DatesSection,
  type ProviderSet,
  type TripStyle,
  type WindowDetail,
} from '@tripsaver/providers';
import { todayInIndia } from '../search/search.controller.js';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

export const STYLES: TripStyle[] = DATE_STYLES;

const CACHE_MAX = 200;

/** Serves the dates section and re-prices clicked dates, caching each search's windows (Redis later). */
@Injectable()
export class DatesService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);
  private readonly cache = new Map<string, ComputedWindows>();

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private remember(key: string, value: ComputedWindows): void {
    this.cache.set(key, value);
    if (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  compute(searchId: string, input: ValidSearchInput): Promise<DatesSection> {
    return buildDatesSection(
      this.providers,
      input,
      { today: todayInIndia(this.clock()), clock: this.clock, timeoutMs: this.timeoutMs },
      (style, c) => this.remember(`${searchId}|${style}`, c),
    );
  }

  async window(
    searchId: string,
    input: ValidSearchInput,
    style: TripStyle,
    start: string,
  ): Promise<WindowDetail | null> {
    const key = `${searchId}|${style}`;
    let c = this.cache.get(key);
    if (!c) {
      const events = await monthEvents(this.providers, input, this.timeoutMs);
      c = await loadWindows(this.providers, input, style, events, this.timeoutMs);
      this.remember(key, c);
    }
    return windowDetail(this.providers, c, start, this.timeoutMs);
  }

  /** Today's prices for one start date, without using or filling the cache (price alerts). */
  async windowFresh(input: ValidSearchInput, style: TripStyle, start: string): Promise<WindowDetail | null> {
    const events = await monthEvents(this.providers, input, this.timeoutMs);
    const c = await loadWindows(this.providers, input, style, events, this.timeoutMs);
    return windowDetail(this.providers, c, start, this.timeoutMs);
  }
}
