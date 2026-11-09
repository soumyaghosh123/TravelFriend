import type { ContentProvider, DestinationGuide } from '../interfaces.js';
import { MOCK_GUIDES } from './data/content.js';

export class MockContentProvider implements ContentProvider {
  id = 'mock-content';

  async guide(destination: string): Promise<DestinationGuide | null> {
    return MOCK_GUIDES[destination] ?? null;
  }
}
