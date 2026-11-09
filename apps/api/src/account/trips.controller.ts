import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  GoneException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { makeSearchInputSchema } from '@tripsaver/domain';
import type { Clock } from '@tripsaver/providers';
import { z } from 'zod';
import { todayInIndia } from '../search/search.controller.js';
import type { SearchStore } from '../search/search-store.js';
import { ACCOUNT_STORE, CLOCK, SEARCH_STORE } from '../tokens.js';
import type { AccountStore, AccountUser, SavedTrip } from './account-store.js';
import { CurrentUser, SessionGuard } from './session.guard.js';

const SaveBody = z.object({
  searchId: z.string().min(1).max(100),
  style: z.enum(['offbeat', 'budget', 'comfort']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().max(120).optional(),
});
const BookedBody = z.object({ booked: z.boolean() });

export type TripView = Omit<SavedTrip, 'userId'>;
const view = (t: SavedTrip): TripView => {
  const { userId, ...rest } = t;
  void userId; // never sent to the browser
  return rest;
};

/** Saved trips and their "booked" ticks, for the signed-in user (PLAN §6.7, §12 step 11). */
@Controller('me/trips')
@UseGuards(SessionGuard)
export class TripsController {
  constructor(
    @Inject(ACCOUNT_STORE) private readonly store: AccountStore,
    @Inject(SEARCH_STORE) private readonly searches: SearchStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async own(user: AccountUser, id: string): Promise<SavedTrip> {
    const t = await this.store.getTrip(user.id, id);
    if (!t) throw new NotFoundException({ statusCode: 404, message: 'Trip not found' });
    return t;
  }

  @Get()
  async list(@CurrentUser() user: AccountUser): Promise<TripView[]> {
    return (await this.store.listTrips(user.id)).map(view);
  }

  /** Saves the plan on screen (search, plan, start date). Saving it again just updates it. */
  @Post()
  async save(@CurrentUser() user: AccountUser, @Body() body: unknown): Promise<TripView> {
    const parsed = SaveBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ statusCode: 400, message: 'Invalid trip' });
    const search = await this.searches.get(parsed.data.searchId);
    if (!search) throw new NotFoundException({ statusCode: 404, message: 'Search not found' });
    const { searchId, style, start, title } = parsed.data;
    return view(
      await this.store.saveTrip(
        user.id,
        { searchId, style, start, title: title ?? null, inputs: search.input },
        this.clock(),
      ),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AccountUser, @Param('id') id: string): Promise<void> {
    if (!(await this.store.deleteTrip(user.id, id)))
      throw new NotFoundException({ statusCode: 404, message: 'Trip not found' });
  }

  /**
   * The search to open the trip with. Searches expire (30 days), so an expired one is run again from the
   * saved inputs; a trip whose month has passed can't be, and says so.
   */
  @Post(':id/open')
  async open(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
  ): Promise<{ searchId: string; style: string; start: string }> {
    const t = await this.own(user, id);
    if (t.searchId && (await this.searches.get(t.searchId)))
      return { searchId: t.searchId, style: t.style, start: t.start };
    const now = this.clock();
    const parsed = makeSearchInputSchema(todayInIndia(now)).safeParse(t.inputs);
    if (!parsed.success) throw new GoneException({ statusCode: 410, message: 'trip.past' });
    const stored = await this.searches.save(parsed.data, now);
    await this.store.updateTripSearch(user.id, id, stored.id, now);
    return { searchId: stored.id, style: t.style, start: t.start };
  }

  @Get(':id/booked')
  async booked(@CurrentUser() user: AccountUser, @Param('id') id: string): Promise<string[]> {
    return this.store.bookedItems((await this.own(user, id)).id);
  }

  @Put(':id/booked/:itemKey')
  @HttpCode(204)
  async setBooked(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
    @Param('itemKey') itemKey: string,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = BookedBody.safeParse(body);
    if (!parsed.success || itemKey.length > 120)
      throw new BadRequestException({ statusCode: 400, message: 'Invalid item' });
    await this.store.setBooked((await this.own(user, id)).id, itemKey, parsed.data.booked);
  }
}
