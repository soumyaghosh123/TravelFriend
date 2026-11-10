import { Controller, Inject, NotFoundException, Post } from '@nestjs/common';
import type { Clock } from '@tripsaver/providers';
import { CLOCK } from '../tokens.js';
import { PriceAlertChecker, type AlertRunResult } from './price-alert-checker.js';

/**
 * Development only: run the daily price-alert check now instead of waiting for 07:00. Off unless
 * `ENABLE_DEV_ROUTES=1`, and never when `NODE_ENV=production` (it has no sign-in).
 */
@Controller('dev/alerts')
export class DevAlertsController {
  constructor(
    private readonly checker: PriceAlertChecker,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post('run')
  async run(): Promise<AlertRunResult> {
    if (process.env.ENABLE_DEV_ROUTES !== '1' || process.env.NODE_ENV === 'production')
      throw new NotFoundException();
    return this.checker.runOnce(this.clock());
  }
}
