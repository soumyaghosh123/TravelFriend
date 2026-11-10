import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Clock } from '@tripsaver/providers';
import { z } from 'zod';
import { ACCOUNT_STORE, CLOCK, TRIP_PRICER } from '../tokens.js';
import type { TripPricer } from '../worker/trip-pricer.js';
import type { AccountStore, AccountUser, PriceAlertRow } from './account-store.js';
import { CurrentUser, SessionGuard } from './session.guard.js';

const SetBody = z.object({
  tripId: z.string().min(1).max(100),
  threshold: z.unknown(),
  locale: z.enum(['en', 'hi', 'bn']).optional(),
});
const Threshold = z.number().int().positive();
const ActiveBody = z.object({ active: z.boolean() });

export interface AlertView {
  id: string;
  tripId: string;
  tripTitle: string | null;
  threshold: number;
  active: boolean;
  lastCheckedAt: string | null;
  lastNotifiedAmount: number | null;
  /** Only when setting an alert: today's group total for the trip. */
  currentTotal?: number;
}

/** "Tell me when this trip drops below ₹X" on a saved trip (spec 2026-11-10-price-alerts). */
@Controller('me/alerts')
@UseGuards(SessionGuard)
export class AlertsController {
  constructor(
    @Inject(ACCOUNT_STORE) private readonly store: AccountStore,
    @Inject(TRIP_PRICER) private readonly pricer: TripPricer,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async view(userId: string, a: PriceAlertRow): Promise<AlertView> {
    const trip = await this.store.getTrip(userId, a.tripId);
    return {
      id: a.id,
      tripId: a.tripId,
      tripTitle: trip?.title ?? null,
      threshold: a.threshold,
      active: a.active,
      lastCheckedAt: a.lastCheckedAt,
      lastNotifiedAmount: a.lastNotifiedAmount,
    };
  }

  @Get()
  async list(@CurrentUser() user: AccountUser): Promise<AlertView[]> {
    const alerts = await this.store.listAlerts(user.id);
    return Promise.all(alerts.map((a) => this.view(user.id, a)));
  }

  /** Sets (or changes) the trip's alert. ₹X must be a whole number of rupees below today's total. */
  @Post()
  async set(@CurrentUser() user: AccountUser, @Body() body: unknown): Promise<AlertView> {
    const parsed = SetBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ statusCode: 400, message: 'Invalid alert' });
    const threshold = Threshold.safeParse(parsed.data.threshold);
    if (!threshold.success) throw new BadRequestException({ statusCode: 400, message: 'alert.threshold' });
    const trip = await this.store.getTrip(user.id, parsed.data.tripId);
    if (!trip) throw new NotFoundException({ statusCode: 404, message: 'Trip not found' });
    const now = this.clock();
    const priced = await this.pricer.price(trip, now);
    if (priced.kind !== 'ok')
      throw new BadRequestException({ statusCode: 400, message: 'alert.unavailable' });
    if (threshold.data >= priced.total)
      throw new BadRequestException({ statusCode: 400, message: 'alert.threshold' });
    const alert = await this.store.upsertAlert(user.id, trip.id, threshold.data, now);
    if (parsed.data.locale) await this.store.setUserLocale(user.id, parsed.data.locale);
    return { ...(await this.view(user.id, alert)), currentTotal: priced.total };
  }

  @Patch(':id')
  @HttpCode(204)
  async setActive(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = ActiveBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ statusCode: 400, message: 'Invalid alert' });
    if (!(await this.store.setAlertActive(user.id, id, parsed.data.active)))
      throw new NotFoundException({ statusCode: 404, message: 'Alert not found' });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AccountUser, @Param('id') id: string): Promise<void> {
    if (!(await this.store.deleteAlert(user.id, id)))
      throw new NotFoundException({ statusCode: 404, message: 'Alert not found' });
  }
}
