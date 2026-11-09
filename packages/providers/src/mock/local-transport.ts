import type { LocalMode, LocalTransportProvider } from '../interfaces.js';
import { MOCK_LOCAL_MODES, MOCK_LOCAL_TIPS } from './data/local-transport.js';

export class MockLocalTransportProvider implements LocalTransportProvider {
  id = 'mock-local';

  async modes(destination: string): Promise<LocalMode[]> {
    return MOCK_LOCAL_MODES[destination] ?? [];
  }

  async tips(destination: string): Promise<string[]> {
    return MOCK_LOCAL_TIPS[destination] ?? [];
  }
}
