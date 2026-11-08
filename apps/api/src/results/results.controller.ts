import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { DatesSection, TransportSection, TripStyle, WindowDetail } from '@tripsaver/providers';
import type { Response } from 'express';
import type { SearchStore } from '../search/search-store.js';
import { SEARCH_STORE } from '../tokens.js';
import { DatesService, STYLES } from './dates.service.js';
import { TransportService } from './transport.service.js';

/** Result sections in stream order (PLAN §7). Later steps add hotels, itinerary, … */
export const SECTIONS = ['dates', 'transport'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('search/:id')
export class ResultsController {
  constructor(
    @Inject(SEARCH_STORE) private readonly store: SearchStore,
    private readonly dates: DatesService,
    private readonly transport: TransportService,
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

    let dates: DatesSection | null = null;
    try {
      dates = await this.dates.compute(id, stored.input);
      send('dates', { status: 'ok', data: dates });
    } catch (err) {
      console.error(`[dates] search ${id}:`, err);
      send('dates', { status: 'error', message: 'unavailable' });
    }

    // Transport for the default selection: the Budget plan's cheapest dates.
    const best = dates?.styles.find((s) => s.style === 'budget')?.top[0];
    if (!best) send('transport', { status: 'error', message: 'unavailable' });
    else {
      try {
        const data = await this.transport.compute(stored.input, { onward: best.onward.departDate, return: best.return.departDate });
        send('transport', { status: 'ok', data });
      } catch (err) {
        console.error(`[transport] search ${id}:`, err);
        send('transport', { status: 'error', message: 'unavailable' });
      }
    }
    send('done', { sections: SECTIONS });
    res.end();
  }

  /** Re-prices one start date (user clicked a calendar day). */
  @Get('window')
  async window(@Param('id') id: string, @Query('start') start?: string, @Query('style') style?: string): Promise<WindowDetail> {
    const stored = await this.search(id);
    if (!start || !ISO_DATE.test(start)) throw new BadRequestException({ statusCode: 400, message: 'start must be YYYY-MM-DD' });
    const s = (style ?? 'budget') as TripStyle;
    if (!STYLES.includes(s)) throw new BadRequestException({ statusCode: 400, message: `style must be one of ${STYLES.join(', ')}` });
    const detail = await this.dates.window(id, stored.input, s, start);
    if (!detail) throw new NotFoundException({ statusCode: 404, message: 'No trip can start on that date' });
    return detail;
  }

  /** Getting there and back for other dates (user picked another window or plan). */
  @Get('transport')
  async transportFor(@Param('id') id: string, @Query('onward') onward?: string, @Query('return') ret?: string): Promise<TransportSection> {
    const stored = await this.search(id);
    if (!onward || !ret || !ISO_DATE.test(onward) || !ISO_DATE.test(ret)) {
      throw new BadRequestException({ statusCode: 400, message: 'onward and return must be YYYY-MM-DD' });
    }
    const d = { onward, return: ret };
    if (!this.transport.validDates(stored.input, d)) {
      throw new BadRequestException({ statusCode: 400, message: 'Dates must fit the searched month and trip length' });
    }
    return this.transport.compute(stored.input, d);
  }
}
