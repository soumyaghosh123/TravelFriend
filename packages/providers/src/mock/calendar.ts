import { daysInMonth, isoDate, type CalendarEvent, type MonthClimate } from '@tripsaver/domain';
import type { CalendarEventsProvider, WeatherProvider } from '../interfaces.js';
import { MOCK_CLIMATE, MOCK_EVENTS } from './data/calendar.js';

export class MockCalendarEventsProvider implements CalendarEventsProvider {
  id = 'mock-calendar';

  async events(destination: string, year: number, month: number): Promise<CalendarEvent[]> {
    const first = isoDate(year, month, 1);
    const last = isoDate(year, month, daysInMonth(year, month));
    return (MOCK_EVENTS[destination] ?? []).filter((e) => e.end >= first && e.start <= last);
  }
}

export class MockWeatherProvider implements WeatherProvider {
  id = 'mock-weather';

  async climate(destination: string): Promise<MonthClimate[]> {
    return MOCK_CLIMATE[destination] ?? [];
  }
}
