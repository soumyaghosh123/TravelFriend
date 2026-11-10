import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ProviderSet } from '@tripsaver/providers';
import type { AccountStore } from './account/account-store.js';
import { accountProviders } from './account/account.providers.js';
import { AlertsController } from './account/alerts.controller.js';
import { AuthController } from './account/auth.controller.js';
import { AuthService } from './account/auth.service.js';
import type { Mailer } from './account/mailer.js';
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
import { ACCOUNT_STORE, MAILER, PROVIDER_SET, TRIP_PRICER } from './tokens.js';
import { DevAlertsController } from './worker/dev-alerts.controller.js';
import { PriceAlertChecker } from './worker/price-alert-checker.js';
import { PriceAlertScheduler } from './worker/price-alert-scheduler.js';
import { LiveTripPricer, type TripPricer } from './worker/trip-pricer.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]), ProvidersModule],
  controllers: [
    PlacesController,
    SearchController,
    ResultsController,
    DestinationsController,
    AuthController,
    TripsController,
    AlertsController,
    // Answers 404 in production (checked per request).
    DevAlertsController,
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
    // Price alerts (spec 2026-11-10-price-alerts)
    {
      provide: TRIP_PRICER,
      inject: [DatesService, CostService, PROVIDER_SET],
      useFactory: (dates: DatesService, cost: CostService, providers: ProviderSet): TripPricer =>
        new LiveTripPricer(dates, cost, providers),
    },
    {
      provide: PriceAlertChecker,
      inject: [ACCOUNT_STORE, TRIP_PRICER, MAILER],
      useFactory: (store: AccountStore, pricer: TripPricer, mailer: Mailer) =>
        new PriceAlertChecker(store, pricer, mailer, process.env.WEB_ORIGIN ?? 'http://localhost:3000'),
    },
    PriceAlertScheduler,
  ],
})
export class AppModule {}
