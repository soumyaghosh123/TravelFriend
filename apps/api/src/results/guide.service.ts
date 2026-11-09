import { Inject, Injectable } from '@nestjs/common';
import { buildGuideSection, type Clock, type GuideSection, type ProviderSet } from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

/** Sights, food, shopping and do's & don'ts for a destination (PLAN §12 step 8). */
@Injectable()
export class GuideService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Null for a code that isn't a destination we have content or sights for (e.g. an origin city). */
  async compute(code: string): Promise<GuideSection | null> {
    if (!this.providers.places.get(code)) return null;
    const section = await buildGuideSection(this.providers, code, {
      clock: this.clock,
      timeoutMs: this.timeoutMs,
    });
    return section.guide || section.sights.length > 0 ? section : null;
  }
}
