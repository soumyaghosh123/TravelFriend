import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PlacesController } from './places/places.controller.js';
import { ProvidersModule } from './providers.module.js';
import { DatesService } from './results/dates.service.js';
import { ResultsController } from './results/results.controller.js';
import { TransportService } from './results/transport.service.js';
import { SearchController } from './search/search.controller.js';
import { InMemorySearchStore } from './search/search-store.js';
import { SEARCH_STORE } from './tokens.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]), ProvidersModule],
  controllers: [PlacesController, SearchController, ResultsController],
  providers: [
    DatesService,
    TransportService,
    { provide: SEARCH_STORE, useValue: new InMemorySearchStore() },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
