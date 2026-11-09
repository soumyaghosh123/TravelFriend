import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type {
  DatesSection,
  HotelsSection,
  PlanCostView,
  ItinerarySection,
  TransportSection,
  TripStyle,
  WindowDetail,
} from '@tripsaver/providers';
import type { Response } from 'express';
import type { SearchStore } from '../search/search-store.js';
import { SEARCH_STORE } from '../tokens.js';
import { CostService } from './cost.service.js';
import { DatesService, STYLES } from './dates.service.js';
import { GuideService } from './guide.service.js';
import { HotelsService } from './hotels.service.js';
import { ItineraryService } from './itinerary.service.js';
import { TransportService } from './transport.service.js';

/** Result sections (PLAN §7): `dates` first, then the others as they complete. `guide` needs no dates. */
export const SECTIONS = ['dates', 'transport', 'hotels', 'itinerary', 'guide', 'cost'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('search/:id')
export class ResultsController {
  constructor(
    @Inject(SEARCH_STORE) private readonly store: SearchStore,
    private readonly dates: DatesService,
    private readonly transport: TransportService,
    private readonly hotels: HotelsService,
    private readonly itinerary: ItineraryService,
    private readonly guide: GuideService,
    private readonly cost: CostService,
  ) {}

  private async search(id: string) {
    const stored = await this.store.get(id);
    if (!stored) throw new NotFoundException({ statusCode: 404, message: 'Search not found' });
    return stored;
  }

  /**
   * Server-Sent Events: one event per section as it completes, then `done`.
   * Each section event is `{ status: 'ok', data }` or `{ status: 'error', message }`, so one failing
   * provider leaves the other sections intact ("Temporarily unavailable – retry").
   */
  @Get('stream')
  async stream(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const stored = await this.search(id);
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    let closed = false;
    res.on('close', () => {
      closed = true;
    });
    const send = (event: string, data: unknown) => {
      if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    /** Sends one section: its data, or "unavailable" if it failed (or had nothing to build from). */
    const section = async <T>(
      name: (typeof SECTIONS)[number],
      build: (() => Promise<T>) | null,
    ): Promise<T | null> => {
      if (!build) {
        send(name, { status: 'error', message: 'unavailable' });
        return null;
      }
      try {
        const data = await build();
        send(name, { status: 'ok', data });
        return data;
      } catch (err) {
        console.error(`[${name}] search ${id}:`, err);
        send(name, { status: 'error', message: 'unavailable' });
        return null;
      }
    };

    const dates = await section<DatesSection>('dates', () => this.dates.compute(id, stored.input));

    // The rest are for the default selection, the Budget plan's cheapest dates; they run in parallel.
    const best = dates?.styles.find((s) => s.style === 'budget')?.top[0];
    await Promise.all([
      // Sights, food, shopping, do's & don'ts: same for every plan and date.
      section('guide', () =>
        this.guide.compute(stored.input.to).then((g) => g ?? Promise.reject(new Error('no guide'))),
      ),
      section(
        'transport',
        best
          ? () =>
              this.transport.compute(stored.input, {
                onward: best.onward.departDate,
                return: best.return.departDate,
              })
          : null,
      ),
      // The day-by-day plan needs the stay's hotels (one per base, plus a 5★ option), so it follows them.
      section<HotelsSection>(
        'hotels',
        best
          ? () =>
              this.hotels.compute(stored.input, {
                checkIn: best.onward.arriveDate,
                checkOut: best.return.departDate,
              })
          : null,
      ).then((hotels) =>
        Promise.all([
          section(
            'itinerary',
            best ? () => this.itinerary.compute(stored.input, 'budget', best, hotels) : null,
          ),
          // Every plan's total and booking checklist (reuses the Budget plan's hotels).
          section('cost', dates ? () => this.cost.all(stored.input, dates, hotels) : null),
        ]),
      ),
    ]);
    send('done', { sections: SECTIONS });
    res.end();
  }

  /** Re-prices one start date (user clicked a calendar day). */
  @Get('window')
  async window(
    @Param('id') id: string,
    @Query('start') start?: string,
    @Query('style') style?: string,
  ): Promise<WindowDetail> {
    const stored = await this.search(id);
    if (!start || !ISO_DATE.test(start))
      throw new BadRequestException({ statusCode: 400, message: 'start must be YYYY-MM-DD' });
    const s = (style ?? 'budget') as TripStyle;
    if (!STYLES.includes(s))
      throw new BadRequestException({
        statusCode: 400,
        message: `style must be one of ${STYLES.join(', ')}`,
      });
    const detail = await this.dates.window(id, stored.input, s, start);
    if (!detail) throw new NotFoundException({ statusCode: 404, message: 'No trip can start on that date' });
    return detail;
  }

  /** Day-by-day plan for another plan or start date. */
  @Get('itinerary')
  async itineraryFor(
    @Param('id') id: string,
    @Query('start') start?: string,
    @Query('style') style?: string,
  ): Promise<ItinerarySection> {
    const stored = await this.search(id);
    if (!start || !ISO_DATE.test(start))
      throw new BadRequestException({ statusCode: 400, message: 'start must be YYYY-MM-DD' });
    const s = (style ?? 'budget') as TripStyle;
    if (!STYLES.includes(s))
      throw new BadRequestException({
        statusCode: 400,
        message: `style must be one of ${STYLES.join(', ')}`,
      });
    const detail = await this.dates.window(id, stored.input, s, start);
    if (!detail) throw new NotFoundException({ statusCode: 404, message: 'No trip can start on that date' });
    const w = detail.window;
    const hotels = await this.hotels
      .compute(stored.input, { checkIn: w.onward.arriveDate, checkOut: w.return.departDate })
      .catch(() => null);
    return this.itinerary.compute(stored.input, s, w, hotels);
  }

  /** Total & book for another plan or start date. */
  @Get('cost')
  async costFor(
    @Param('id') id: string,
    @Query('start') start?: string,
    @Query('style') style?: string,
  ): Promise<PlanCostView> {
    const stored = await this.search(id);
    if (!start || !ISO_DATE.test(start))
      throw new BadRequestException({ statusCode: 400, message: 'start must be YYYY-MM-DD' });
    const s = (style ?? 'budget') as TripStyle;
    if (!STYLES.includes(s))
      throw new BadRequestException({
        statusCode: 400,
        message: `style must be one of ${STYLES.join(', ')}`,
      });
    const detail = await this.dates.window(id, stored.input, s, start);
    if (!detail) throw new NotFoundException({ statusCode: 404, message: 'No trip can start on that date' });
    return this.cost.plan(stored.input, s, detail.window);
  }

  /** Getting there and back for other dates (user picked another window or plan). */
  @Get('transport')
  async transportFor(
    @Param('id') id: string,
    @Query('onward') onward?: string,
    @Query('return') ret?: string,
  ): Promise<TransportSection> {
    const stored = await this.search(id);
    if (!onward || !ret || !ISO_DATE.test(onward) || !ISO_DATE.test(ret)) {
      throw new BadRequestException({ statusCode: 400, message: 'onward and return must be YYYY-MM-DD' });
    }
    const d = { onward, return: ret };
    if (!this.transport.validDates(stored.input, d)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Dates must fit the searched month and trip length',
      });
    }
    return this.transport.compute(stored.input, d);
  }

  /** Hotels for another stay (user picked another window or plan). */
  @Get('hotels')
  async hotelsFor(
    @Param('id') id: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
  ): Promise<HotelsSection> {
    const stored = await this.search(id);
    if (!checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
      throw new BadRequestException({ statusCode: 400, message: 'checkIn and checkOut must be YYYY-MM-DD' });
    }
    const d = { checkIn, checkOut };
    if (!this.hotels.validDates(stored.input, d)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Stay must fit the searched month and trip length',
      });
    }
    return this.hotels.compute(stored.input, d);
  }
}
