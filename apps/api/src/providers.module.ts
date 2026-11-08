import { Global, Module } from '@nestjs/common';
import { createRegistry, systemClock, type Clock } from '@tripsaver/providers';
import { CLOCK, PROVIDER_SET } from './tokens.js';

/** Builds the provider registry from `*_PROVIDERS` env vars (see .env.example). */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: systemClock },
    { provide: PROVIDER_SET, inject: [CLOCK], useFactory: (clock: Clock) => createRegistry(process.env, clock) },
  ],
  exports: [CLOCK, PROVIDER_SET],
})
export class ProvidersModule {}
