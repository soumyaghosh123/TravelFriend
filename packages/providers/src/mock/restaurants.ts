import { systemClock, type Clock } from '../clock.js';
import type { RestaurantsProvider, RestaurantsResult } from '../interfaces.js';
import { MOCK_GUIDES } from './data/content.js';

/** The curated guide's "(sample)" places; none for destinations without a guide. */
export class MockRestaurantsProvider implements RestaurantsProvider {
  id = 'mock-restaurants';

  constructor(private readonly clock: Clock = systemClock) {}

  async near(destination: string): Promise<RestaurantsResult> {
    return {
      restaurants: MOCK_GUIDES[destination]?.restaurants ?? [],
      source: { id: this.id, name: 'TripSaver sample data', url: '' },
      fetchedAt: this.clock().toISOString(),
    };
  }
}
