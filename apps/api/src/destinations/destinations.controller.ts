import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { GuideSection } from '@tripsaver/providers';
import { GuideService } from '../results/guide.service.js';

/** Destination guide pages (PLAN §9 `/destination/[slug]`): the same content as the results tabs. */
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly guide: GuideService) {}

  @Get(':code/guide')
  async guideFor(@Param('code') code: string): Promise<GuideSection> {
    const section = await this.guide.compute(code.toUpperCase());
    if (!section) throw new NotFoundException({ statusCode: 404, message: 'Destination not found' });
    return section;
  }
}
