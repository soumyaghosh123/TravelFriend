import type { LocalMode } from '../../interfaces.js';

/**
 * Sample local transport per destination. Operators and booking places are real; fares and speeds are
 * approximate and must be checked against current official tariffs before launch.
 */
type Spec = Omit<LocalMode, 'id'> & { id: string };

const cab = (id: string, name: string, base: number, perKm: number, url: string, where: string): Spec => ({
  id, name, kind: 'app-cab', capacity: 4, pricing: { type: 'vehicle-km', base, perKm, minFare: 150 }, speedKmh: 32, waitMin: 10,
  public: false, doorToDoor: true, spread: 0.15, booking: { type: 'app', where, url },
});
const prepaid = (where: string, perKm: number, minFare: number): Spec => ({
  id: 'prepaid-taxi', name: 'Prepaid taxi', kind: 'prepaid-taxi', capacity: 4, pricing: { type: 'vehicle-km', base: 0, perKm, minFare },
  speedKmh: 35, waitMin: 10, public: false, doorToDoor: true, spread: 0.08, legKinds: ['arrival', 'departure'], booking: { type: 'counter', where },
});
const taxiDay = (perDay: number, where: string, note: string): Spec => ({
  id: 'taxi-day', name: 'Taxi for the day (8 h / 80 km)', kind: 'taxi-day', capacity: 4, pricing: { type: 'day', perVehicleDay: perDay },
  speedKmh: 32, waitMin: 0, public: false, doorToDoor: true, spread: 0.1, booking: { type: 'hotel-desk', where }, note,
});

const MODES: Record<string, Spec[]> = {
  GOA: [
    cab('goamiles', 'GoaMiles app cab', 100, 18, 'https://www.goamiles.com/', 'GoaMiles app (Goa government app-based taxis)'),
    prepaid('Prepaid taxi counter at the station or airport exit', 24, 400),
    { id: 'tourist-taxi', name: 'Local tourist taxi', kind: 'taxi', capacity: 4, pricing: { type: 'vehicle-km', base: 0, perKm: 22, minFare: 250 }, speedKmh: 32, waitMin: 5, public: false, doorToDoor: true, spread: 0.2, booking: { type: 'counter', where: 'Taxi stands near beaches and markets · agree the fare first' } },
    taxiDay(2800, 'Hotel desk or Goa Tourism taxi counter', 'Extra km about ₹20'),
    { id: 'scooter', name: 'Scooter rental', kind: 'scooter', capacity: 2, pricing: { type: 'day', perVehicleDay: 400 }, speedKmh: 30, waitMin: 0, public: false, doorToDoor: true, spread: 0.15, booking: { type: 'rental-shop', where: 'Licensed rental shops (yellow number plates)' }, note: 'Driving licence and helmets needed; not ideal with small children' },
    { id: 'kadamba', name: 'Kadamba bus', kind: 'bus', capacity: 1, pricing: { type: 'seat-km', base: 10, perKm: 1.2 }, speedKmh: 22, waitMin: 20, public: true, doorToDoor: false, spread: 0, booking: { type: 'pay-on-board', where: 'Kadamba (KTC) stands · pay the conductor' } },
    { id: 'divar-ferry', name: 'Government ferry Ribandar ↔ Divar', kind: 'ferry', capacity: 1, pricing: { type: 'flat', perPerson: 0 }, speedKmh: 10, waitMin: 20, public: true, doorToDoor: false, spread: 0, booking: { type: 'pay-on-board', where: 'Ribandar jetty · every 15–30 min · free for foot passengers' }, forAttraction: 'goa-divar' },
    { id: 'dudhsagar-jeep', name: 'Dudhsagar forest jeep (per seat)', kind: 'jeep-safari', capacity: 1, pricing: { type: 'flat', perPerson: 600 }, speedKmh: 15, waitMin: 30, public: true, doorToDoor: false, spread: 0, booking: { type: 'counter', where: 'Collem jeep counter (Forest Department)' }, forAttraction: 'goa-dudhsagar' },
  ],
  MANALI: [
    prepaid('Taxi Union counter at the bus stand or Bhuntar airport', 28, 500),
    { id: 'union-taxi', name: 'Manali Taxi Union cab', kind: 'taxi', capacity: 4, pricing: { type: 'vehicle-km', base: 0, perKm: 30, minFare: 400 }, speedKmh: 25, waitMin: 10, public: false, doorToDoor: true, spread: 0.1, booking: { type: 'counter', where: 'Taxi Union stand, Mall Road · fixed rate card' } },
    taxiDay(3500, 'Taxi Union stand or hotel desk', 'Rohtang/Solang trips have separate fixed rates'),
    { id: 'bike', name: 'Motorbike rental', kind: 'scooter', capacity: 2, pricing: { type: 'day', perVehicleDay: 1200 }, speedKmh: 25, waitMin: 0, public: false, doorToDoor: true, spread: 0.15, booking: { type: 'rental-shop', where: 'Rental shops near Mall Road' }, note: 'Licence needed; mountain roads, ride carefully' },
    { id: 'hrtc', name: 'HRTC local bus', kind: 'bus', capacity: 1, pricing: { type: 'seat-km', base: 10, perKm: 1.8 }, speedKmh: 18, waitMin: 25, public: true, doorToDoor: false, spread: 0, booking: { type: 'pay-on-board', where: 'Manali bus stand · pay the conductor' } },
  ],
  JAIPUR: [
    cab('uber', 'Uber / Ola', 50, 15, 'https://m.uber.com/', 'Uber or Ola app'),
    prepaid('Prepaid booth at Jaipur Junction and the airport', 18, 250),
    { id: 'auto', name: 'Auto-rickshaw', kind: 'auto', capacity: 3, pricing: { type: 'vehicle-km', base: 30, perKm: 14, minFare: 40 }, speedKmh: 20, waitMin: 5, public: false, doorToDoor: true, spread: 0.2, maxLegKm: 15, booking: { type: 'pay-on-board', where: 'Any auto stand · agree the fare or use the Ola/Uber auto option' } },
    { id: 'metro', name: 'Jaipur Metro', kind: 'metro', capacity: 1, pricing: { type: 'seat-km', base: 6, perKm: 2 }, speedKmh: 30, waitMin: 15, public: true, doorToDoor: false, spread: 0, maxLegKm: 12, booking: { type: 'counter', where: 'Metro stations (Mansarovar – Badi Chaupar line)' } },
    { id: 'jctsl', name: 'JCTSL city bus', kind: 'bus', capacity: 1, pricing: { type: 'seat-km', base: 10, perKm: 1 }, speedKmh: 18, waitMin: 15, public: true, doorToDoor: false, spread: 0, booking: { type: 'pay-on-board', where: 'City bus stops · pay the conductor' } },
    taxiDay(2200, 'Hotel desk or RTDC counter', 'Covers Amer, Nahargarh and the old city in a day'),
  ],
  KERALA: [
    cab('uber', 'Uber / Ola (Kochi)', 60, 16, 'https://m.uber.com/', 'Uber or Ola app'),
    prepaid('Prepaid taxi at Ernakulam station and Kochi airport', 22, 350),
    { id: 'auto', name: 'Auto-rickshaw', kind: 'auto', capacity: 3, pricing: { type: 'vehicle-km', base: 30, perKm: 15, minFare: 30 }, speedKmh: 20, waitMin: 5, public: false, doorToDoor: true, spread: 0.15, maxLegKm: 15, booking: { type: 'pay-on-board', where: 'Auto stands · meters are common in Kochi' } },
    { id: 'ksrtc', name: 'KSRTC bus', kind: 'bus', capacity: 1, pricing: { type: 'seat-km', base: 10, perKm: 1.1 }, speedKmh: 24, waitMin: 20, public: true, doorToDoor: false, spread: 0, booking: { type: 'pay-on-board', where: 'KSRTC stands · pay the conductor' } },
    { id: 'water-metro', name: 'Kochi Water Metro / ferry', kind: 'ferry', capacity: 1, pricing: { type: 'seat-km', base: 20, perKm: 2 }, speedKmh: 15, waitMin: 15, public: true, doorToDoor: false, spread: 0, maxLegKm: 10, booking: { type: 'counter', where: 'High Court and Fort Kochi terminals' } },
    taxiDay(3000, 'Hotel desk', 'Munnar hill roads take longer; plan 6–7 h of driving at most'),
  ],
  DARJEELING: [
    { id: 'shared-jeep', name: 'Shared jeep (per seat)', kind: 'shared-jeep', capacity: 1, pricing: { type: 'seat-km', base: 20, perKm: 3.5 }, speedKmh: 20, waitMin: 30, public: true, doorToDoor: false, spread: 0.1, booking: { type: 'pay-on-board', where: 'Jeep stands at NJP, Siliguri and Chowk Bazaar · leaves when full' } },
    { id: 'reserved-jeep', name: 'Reserved jeep / taxi', kind: 'taxi', capacity: 6, pricing: { type: 'vehicle-km', base: 0, perKm: 35, minFare: 300 }, speedKmh: 20, waitMin: 10, public: false, doorToDoor: true, spread: 0.15, booking: { type: 'counter', where: 'Taxi stands at NJP, Bagdogra and Chowk Bazaar' } },
    prepaid('Prepaid counter at Bagdogra airport and NJP', 30, 600),
    taxiDay(3200, 'Hotel desk or Chowk Bazaar stand', 'Tiger Hill sunrise trips are booked separately the evening before'),
  ],
};

export const MOCK_LOCAL_MODES: Record<string, LocalMode[]> = Object.fromEntries(Object.entries(MODES).map(([d, list]) => [d, list as LocalMode[]]));

export const MOCK_LOCAL_TIPS: Record<string, string[]> = {
  GOA: [
    "Uber and Ola don't operate in Goa: use GoaMiles, a prepaid taxi or a local taxi, and agree the fare before you get in.",
    'Kadamba buses connect Panjim, Mapusa and Margao every few minutes; smaller routes are less frequent after 7 pm.',
  ],
  MANALI: ['App cabs do not operate; Taxi Union rate cards are fixed and displayed at the stand.', 'Rohtang Pass needs an online permit for private vehicles.'],
  JAIPUR: ['Agree auto fares before the ride or book an auto in the Uber/Ola app.', 'The metro covers the old city (Badi Chaupar) but not Amer.'],
  KERALA: ['Ferries are the quickest way between Ernakulam and Fort Kochi.', 'Hill roads to Munnar take 4–5 hours from Kochi.'],
  DARJEELING: ['Shared jeeps are the usual way up from NJP/Siliguri (about 3 h).', 'Book Tiger Hill sunrise jeeps the evening before; they leave around 4 am.'],
};
