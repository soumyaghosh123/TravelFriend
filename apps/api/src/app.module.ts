import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { accountProviders } from './account/account.providers.js';
import { AuthController } from './account/auth.controller.js';
import { AuthService } from './account/auth.service.js';
import { SessionGuard } from './account/session.guard.js';
import { TripsController } from './account/trips.controller.js';
import { DestinationsController } from './destinations/destinations.controller.js';
import { PlacesController } from './places/places.controller.js';
import { ProvidersModule } from './providers.module.js';
import { DatesService } from './results/dates.service.js';
import { CostService } from './results/cost.service.js';
import { GuideService } from './results/guide.service.js';
import { HotelsService } from './results/hotels.service.js';
import { ItineraryService } from './results/itinerary.service.js';
import { ResultsController } from './results/results.controller.js';
import { TransportService } from './results/transport.service.js';
import { SearchController } from './search/search.controller.js';
import { searchStoreProvider } from './search/search-store.provider.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]), ProvidersModule],
  controllers: [
    PlacesController,
    SearchController,
    ResultsController,
    DestinationsController,
    AuthController,
    TripsController,
  ],
  providers: [
    DatesService,
    TransportService,
    HotelsService,
    ItineraryService,
    GuideService,
    CostService,
    searchStoreProvider(),
    ...accountProviders(),
    AuthService,
    SessionGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
