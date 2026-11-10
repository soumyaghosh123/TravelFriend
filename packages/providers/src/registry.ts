import { systemClock, type Clock } from './clock.js';
import type {
  AttractionsProvider,
  ContentProvider,
  LocalTransportProvider,
  BusProvider,
  CalendarEventsProvider,
  FlightProvider,
  HotelProvider,
  PlaceDirectory,
  ProviderSet,
  RestaurantsProvider,
  TrainProvider,
  WeatherProvider,
} from './interfaces.js';
import { MockAttractionsProvider } from './mock/attractions.js';
import { MockContentProvider } from './mock/content.js';
import { MockRestaurantsProvider } from './mock/restaurants.js';
import { OsmRestaurantsProvider } from './real/osm-restaurants.js';
import { OpenMeteoWeatherProvider } from './real/open-meteo-weather.js';
import { MockCalendarEventsProvider, MockWeatherProvider } from './mock/calendar.js';
import { MockLocalTransportProvider } from './mock/local-transport.js';
import { mockPlaceDirectory } from './mock/data/places.js';
import { MockHotelProvider } from './mock/hotels.js';
import { MockBusProvider, MockFlightProvider, MockTrainProvider } from './mock/transport.js';

type Env = Record<string, string | undefined>;
type Factory<T> = (clock: Clock, env: Env) => T;

export interface Factories {
  attractions: Record<string, Factory<AttractionsProvider>>;
  local: Record<string, Factory<LocalTransportProvider>>;
  content: Record<string, Factory<ContentProvider>>;
  restaurants: Record<string, Factory<RestaurantsProvider>>;
  train: Record<string, Factory<TrainProvider>>;
  bus: Record<string, Factory<BusProvider>>;
  flight: Record<string, Factory<FlightProvider>>;
  hotel: Record<string, Factory<HotelProvider>>;
  calendar: Record<string, Factory<CalendarEventsProvider>>;
  weather: Record<string, Factory<WeatherProvider>>;
  places: PlaceDirectory;
}

/** Built-in providers. Real adapters are added here as their access is approved. */
export const DEFAULT_FACTORIES: Factories = {
  attractions: { mock: () => new MockAttractionsProvider() },
  local: { mock: () => new MockLocalTransportProvider() },
  content: { mock: () => new MockContentProvider() },
  restaurants: {
    mock: (c) => new MockRestaurantsProvider(c),
    // Real eateries from OpenStreetMap (Overpass, free, no key; attribution required). Decision 2026-11-10.
    osm: (c, env) =>
      new OsmRestaurantsProvider({ clock: c, ...(env.OVERPASS_URL ? { baseUrl: env.OVERPASS_URL } : {}) }),
  },
  train: { mock: (c) => new MockTrainProvider(c) },
  bus: { mock: (c) => new MockBusProvider(c) },
  flight: { mock: (c) => new MockFlightProvider(c) },
  hotel: { mock: (c) => new MockHotelProvider(c) },
  calendar: { mock: () => new MockCalendarEventsProvider() },
  weather: {
    mock: () => new MockWeatherProvider(),
    // Real weather; the seasonal price index stays on sample data until a real price history exists.
    openmeteo: (c) =>
      new OpenMeteoWeatherProvider({
        clock: c,
        places: mockPlaceDirectory,
        seasonal: new MockWeatherProvider(),
      }),
  },
  places: mockPlaceDirectory,
};

const ENV_KEYS = {
  attractions: 'ATTRACTION_PROVIDERS',
  local: 'LOCAL_TRANSPORT_PROVIDERS',
  content: 'CONTENT_PROVIDERS',
  restaurants: 'RESTAURANT_PROVIDERS',
  train: 'TRAIN_PROVIDERS',
  bus: 'BUS_PROVIDERS',
  flight: 'FLIGHT_PROVIDERS',
  hotel: 'HOTEL_PROVIDERS',
  calendar: 'CALENDAR_PROVIDERS',
  weather: 'WEATHER_PROVIDERS',
} as const;

function pick<T>(
  env: Record<string, string | undefined>,
  key: string,
  factories: Record<string, Factory<T>>,
  clock: Clock,
): T[] {
  const ids = (env[key] ?? 'mock')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.map((id) => {
    const factory = factories[id];
    if (!factory) throw new Error(`Unknown provider "${id}" in ${key}`);
    return factory(clock, env);
  });
}

/** Builds the active providers for each mode from environment variables. */
export function createRegistry(
  env: Record<string, string | undefined>,
  clock: Clock = systemClock,
  factories: Partial<Factories> = {},
): ProviderSet {
  const f: Factories = {
    attractions: { ...DEFAULT_FACTORIES.attractions, ...factories.attractions },
    local: { ...DEFAULT_FACTORIES.local, ...factories.local },
    content: { ...DEFAULT_FACTORIES.content, ...factories.content },
    restaurants: { ...DEFAULT_FACTORIES.restaurants, ...factories.restaurants },
    train: { ...DEFAULT_FACTORIES.train, ...factories.train },
    bus: { ...DEFAULT_FACTORIES.bus, ...factories.bus },
    flight: { ...DEFAULT_FACTORIES.flight, ...factories.flight },
    hotel: { ...DEFAULT_FACTORIES.hotel, ...factories.hotel },
    calendar: { ...DEFAULT_FACTORIES.calendar, ...factories.calendar },
    weather: { ...DEFAULT_FACTORIES.weather, ...factories.weather },
    places: factories.places ?? DEFAULT_FACTORIES.places,
  };
  return {
    attractions: pick(env, ENV_KEYS.attractions, f.attractions, clock),
    local: pick(env, ENV_KEYS.local, f.local, clock),
    content: pick(env, ENV_KEYS.content, f.content, clock),
    restaurants: pick(env, ENV_KEYS.restaurants, f.restaurants, clock),
    train: pick(env, ENV_KEYS.train, f.train, clock),
    bus: pick(env, ENV_KEYS.bus, f.bus, clock),
    flight: pick(env, ENV_KEYS.flight, f.flight, clock),
    hotel: pick(env, ENV_KEYS.hotel, f.hotel, clock),
    calendar: pick(env, ENV_KEYS.calendar, f.calendar, clock),
    weather: pick(env, ENV_KEYS.weather, f.weather, clock),
    places: f.places,
  };
}
