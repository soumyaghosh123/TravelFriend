import { Inject, Injectable } from '@nestjs/common';
import { addDays, type ValidSearchInput } from '@tripsaver/domain';
import { buildTransportSection, type Clock, type ProviderSet, type TransportSection } from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from '../tokens.js';

export interface TransportDates {
  onward: string;
  return: string;
}

/** "Getting there and back" for a chosen pair of travel dates. */
@Injectable()
export class TransportService {
  private readonly timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 4000);

  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Onward and the trip end must fall in the searched month; return sits between them (PLAN A2). */
  validDates(input: ValidSearchInput, d: TransportDates): boolean {
    const end = addDays(d.onward, input.days - 1);
    return d.onward.startsWith(input.month) && end.startsWith(input.month) && d.return >= d.onward && d.return <= end;
  }

  compute(input: ValidSearchInput, d: TransportDates): Promise<TransportSection> {
    return buildTransportSection(
      this.providers,
      {
        from: input.from,
        to: input.to,
        onwardDate: d.onward,
        returnDate: d.return,
        tripEnd: addDays(d.onward, input.days - 1),
        travellers: input.travellers,
      },
      { clock: this.clock, timeoutMs: this.timeoutMs },
    );
  }
}
