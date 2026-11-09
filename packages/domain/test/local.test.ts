import { describe, expect, test } from 'vitest';
import { localFare, localMinutes, tagLocalOptions, type LocalModeLike } from '../src/local/local.js';

const family = { adults: 2, childAges: [3, 6] };
const cab: LocalModeLike = { id: 'cab', kind: 'app-cab', capacity: 4, pricing: { type: 'vehicle-km', base: 100, perKm: 18 }, speedKmh: 35, waitMin: 10, public: false, doorToDoor: true, spread: 0.1 };
const bus: LocalModeLike = { id: 'bus', kind: 'bus', capacity: 1, pricing: { type: 'seat-km', base: 10, perKm: 1.2 }, speedKmh: 22, waitMin: 20, public: true, doorToDoor: false, spread: 0 };
const scooter: LocalModeLike = { id: 'scooter', kind: 'scooter', capacity: 2, pricing: { type: 'day', perVehicleDay: 400 }, speedKmh: 30, waitMin: 0, public: false, doorToDoor: true, spread: 0.1, legKinds: ['day'] };
const auto: LocalModeLike = { id: 'auto', kind: 'auto', capacity: 3, pricing: { type: 'vehicle-km', base: 30, perKm: 14, minFare: 40 }, speedKmh: 20, waitMin: 5, public: false, doorToDoor: true, spread: 0.15, maxLegKm: 15 };

describe('localFare (group fare range for a set of legs)', () => {
  test('vehicle by km: base + per km for each leg, enough vehicles for everyone', () => {
    expect(localFare(cab, [10], family, 'arrival')).toEqual({ min: 252, max: 308 }); // (100 + 180) ± 10%, 1 cab for 4
    expect(localFare(cab, [10], { adults: 6, childAges: [] }, 'arrival')).toEqual({ min: 504, max: 616 }); // 2 cabs
  });
  test('seats: per adult, children by the default bands (3 free, 6 half)', () => {
    expect(localFare(bus, [10, 5], family, 'day')).toEqual({ min: 95, max: 95 }); // leg fares 22 and 16 per adult: 2×22 + 11 + 0, 2×16 + 8 + 0
  });
  test('per day: one fee for the day, vehicles by capacity; only for sightseeing days', () => {
    expect(localFare(scooter, [10, 20, 5], family, 'day')).toEqual({ min: 720, max: 880 }); // 3 seats (kids under 8 count half) → 2 scooters × 400 ± 10%
    expect(localFare(scooter, [30], family, 'arrival')).toBeNull();
  });
  test('day hire with a km allowance: extra km charged per vehicle beyond it', () => {
    const taxiDay: LocalModeLike = { id: 'taxi-day', kind: 'taxi-day', capacity: 4, pricing: { type: 'day', perVehicleDay: 2800, includedKm: 80, extraPerKm: 20 }, speedKmh: 32, waitMin: 0, public: false, doorToDoor: true, spread: 0 };
    expect(localFare(taxiDay, [30, 40, 10], family, 'day')).toEqual({ min: 2800, max: 2800 }); // exactly 80 km
    expect(localFare(taxiDay, [60, 60, 32], family, 'day')).toEqual({ min: 2800 + 72 * 20, max: 2800 + 72 * 20 }); // 152 km
    expect(localFare(taxiDay, [100], { adults: 6, childAges: [] }, 'day')).toEqual({ min: 2 * (2800 + 400), max: 2 * (2800 + 400) }); // 2 taxis
  });
  test('legs longer than the mode allows → not offered; minimum fare applies', () => {
    expect(localFare(auto, [20], family, 'day')).toBeNull();
    expect(localFare(auto, [0.5], family, 'day')).toEqual({ min: 34, max: 46 }); // one auto: 2 adults + 2 small children = 3 seats; max(30 + 7, 40) = 40 ± 15%
  });
});

describe('localMinutes', () => {
  test('moving time at the mode speed plus waiting per leg', () => {
    expect(localMinutes(cab, [35])).toBe(70);
    expect(localMinutes(bus, [11, 11])).toBe(60 + 40);
  });
});

describe('tagLocalOptions: cheapest, most convenient, and the plan choice', () => {
  const priced = [
    { id: 'cab', public: false, doorToDoor: true, min: 250, max: 300, minutes: 30 },
    { id: 'bus', public: true, doorToDoor: false, min: 40, max: 40, minutes: 70 },
    { id: 'taxi', public: false, doorToDoor: true, min: 300, max: 350, minutes: 25 },
  ];
  test('budget and offbeat take public transport first; comfort takes the most convenient', () => {
    expect(tagLocalOptions(priced, 'budget')).toEqual({ cheapest: 'bus', convenient: 'taxi', plan: 'bus' });
    expect(tagLocalOptions(priced, 'offbeat').plan).toBe('bus');
    expect(tagLocalOptions(priced, 'comfort').plan).toBe('taxi');
  });
  test('no public option: budget takes the cheapest', () => {
    expect(tagLocalOptions(priced.filter((p) => !p.public), 'budget').plan).toBe('cab');
  });
  test('no options → nothing tagged', () => {
    expect(tagLocalOptions([], 'budget')).toEqual({});
  });
});
