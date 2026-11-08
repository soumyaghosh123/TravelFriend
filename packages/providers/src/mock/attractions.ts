import type { Attraction, AttractionsProvider } from '../interfaces.js';
import { MOCK_ATTRACTIONS } from './data/attractions.js';

export class MockAttractionsProvider implements AttractionsProvider {
  id = 'mock-attractions';

  constructor(private readonly catalogue: Record<string, Attraction[]> = MOCK_ATTRACTIONS) {}

  async attractions(destination: string): Promise<Attraction[]> {
    return this.catalogue[destination] ?? [];
  }
}
