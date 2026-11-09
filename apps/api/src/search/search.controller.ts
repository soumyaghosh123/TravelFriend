import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { makeSearchInputSchema, toIssues, type SearchInputIssue } from '@tripsaver/domain';
import type { Clock, ProviderSet } from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET, SEARCH_STORE } from '../tokens.js';
import type { SearchStore, StoredSearch } from './search-store.js';

/** Today's calendar date in India. The domain works in local dates; this is the one place we pick the zone. */
export function todayInIndia(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

function invalid(issues: SearchInputIssue[]): BadRequestException {
  return new BadRequestException({ statusCode: 400, message: 'Invalid search', issues });
}

@Controller('search')
export class SearchController {
  constructor(
    @Inject(PROVIDER_SET) private readonly providers: ProviderSet,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SEARCH_STORE) private readonly store: SearchStore,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@Body() body: unknown): Promise<{ searchId: string }> {
    const now = this.clock();
    const parsed = makeSearchInputSchema(todayInIndia(now)).safeParse(body);
    if (!parsed.success) throw invalid(toIssues(parsed.error));

    const input = parsed.data;
    const issues: SearchInputIssue[] = [];
    if (!this.providers.places.get(input.from)) issues.push({ path: 'from', message: 'from.unknown' });
    // Starting cities (e.g. Delhi) are places too, but only destinations have hotels, sights and prices.
    if (!this.providers.places.get(input.to) || !this.providers.places.isDestination(input.to))
      issues.push({ path: 'to', message: 'to.unknown' });
    if (issues.length) throw invalid(issues);

    const stored = await this.store.save(input, now);
    return { searchId: stored.id };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<StoredSearch> {
    const stored = await this.store.get(id);
    if (!stored) throw new NotFoundException({ statusCode: 404, message: 'Search not found' });
    return stored;
  }
}
