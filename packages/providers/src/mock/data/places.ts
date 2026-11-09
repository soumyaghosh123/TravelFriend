import type { Landmark, Place, PlaceDirectory } from '../../interfaces.js';

/** Origin cities. Station and airport codes are real Indian Railways / IATA codes. */
export const MOCK_ORIGINS: Place[] = [
  {
    code: 'KOL',
    name: 'Kolkata',
    kind: 'city',
    stations: ['HWH', 'SDAH'],
    airports: ['CCU'],
    busPoints: ['Esplanade'],
    lat: 22.57,
    lng: 88.36,
  },
  {
    code: 'DEL',
    name: 'Delhi',
    kind: 'city',
    stations: ['NDLS', 'NZM'],
    airports: ['DEL'],
    busPoints: ['Kashmere Gate ISBT'],
    lat: 28.61,
    lng: 77.21,
  },
  {
    code: 'BOM',
    name: 'Mumbai',
    kind: 'city',
    stations: ['CSMT', 'LTT'],
    airports: ['BOM'],
    busPoints: ['Borivali'],
    lat: 19.08,
    lng: 72.88,
  },
  {
    code: 'BLR',
    name: 'Bengaluru',
    kind: 'city',
    stations: ['SBC', 'YPR'],
    airports: ['BLR'],
    busPoints: ['Majestic'],
    lat: 12.97,
    lng: 77.59,
  },
  {
    code: 'MAA',
    name: 'Chennai',
    kind: 'city',
    stations: ['MAS'],
    airports: ['MAA'],
    busPoints: ['Koyambedu'],
    lat: 13.08,
    lng: 80.27,
  },
  {
    code: 'HYD',
    name: 'Hyderabad',
    kind: 'city',
    stations: ['SC', 'HYB'],
    airports: ['HYD'],
    busPoints: ['MGBS'],
    lat: 17.39,
    lng: 78.49,
  },
];

export const MOCK_DESTINATIONS: Place[] = [
  {
    code: 'GOA',
    name: 'Goa',
    kind: 'region',
    stations: ['MAO', 'VSG', 'THVM'],
    airports: ['GOI', 'GOX'],
    busPoints: ['Panjim Kadamba', 'Mapusa', 'Margao'],
    lat: 15.49,
    lng: 73.83,
    localSpeedKmh: 40,
    gateways: {
      train: { name: 'Madgaon station', lat: 15.271, lng: 73.97 },
      flight: { name: 'Goa airport', lat: 15.38, lng: 73.831 },
      bus: { name: 'Panjim Kadamba stand', lat: 15.495, lng: 73.832 },
    },
  },
  {
    code: 'MANALI',
    name: 'Manali',
    kind: 'city',
    stations: ['CDG', 'KLK'],
    airports: ['KUU'],
    busPoints: ['Manali Bus Stand'],
    lat: 32.24,
    lng: 77.19,
    localSpeedKmh: 25,
    gateways: {
      train: { name: 'Manali bus stand', lat: 32.243, lng: 77.189 },
      flight: { name: 'Kullu (Bhuntar) airport', lat: 31.876, lng: 77.154 },
      bus: { name: 'Manali bus stand', lat: 32.243, lng: 77.189 },
    },
  },
  {
    code: 'JAIPUR',
    name: 'Jaipur',
    kind: 'city',
    stations: ['JP'],
    airports: ['JAI'],
    busPoints: ['Sindhi Camp'],
    lat: 26.91,
    lng: 75.79,
    localSpeedKmh: 30,
    gateways: {
      train: { name: 'Jaipur Junction', lat: 26.919, lng: 75.788 },
      flight: { name: 'Jaipur airport', lat: 26.824, lng: 75.812 },
      bus: { name: 'Sindhi Camp', lat: 26.923, lng: 75.8 },
    },
  },
  {
    code: 'KERALA',
    name: 'Kerala',
    kind: 'region',
    stations: ['ERS', 'TVC'],
    airports: ['COK', 'TRV'],
    busPoints: ['Vyttila Hub', 'Thampanoor'],
    lat: 9.93,
    lng: 76.27,
    localSpeedKmh: 35,
    gateways: {
      train: { name: 'Ernakulam Junction', lat: 9.969, lng: 76.291 },
      flight: { name: 'Kochi airport', lat: 10.152, lng: 76.401 },
      bus: { name: 'Vyttila Hub', lat: 9.967, lng: 76.32 },
    },
  },
  {
    code: 'DARJEELING',
    name: 'Darjeeling',
    kind: 'city',
    stations: ['NJP'],
    airports: ['IXB'],
    busPoints: ['Siliguri Tenzing Norgay Terminus'],
    lat: 27.04,
    lng: 88.26,
    localSpeedKmh: 20,
    gateways: {
      train: { name: 'New Jalpaiguri (NJP)', lat: 26.683, lng: 88.443 },
      flight: { name: 'Bagdogra airport', lat: 26.681, lng: 88.328 },
      bus: { name: 'Siliguri bus terminus', lat: 26.711, lng: 88.428 },
    },
  },
];

const ALL = [...MOCK_ORIGINS, ...MOCK_DESTINATIONS];

/** Real landmarks with approximate coordinates. The first per destination is its main area. */
export const MOCK_LANDMARKS: Record<string, Landmark[]> = {
  GOA: [
    { name: 'Calangute Beach', lat: 15.5439, lng: 73.7553, isBase: true },
    { name: 'Baga Beach', lat: 15.5553, lng: 73.7517 },
    { name: 'Panjim (Panaji)', lat: 15.4909, lng: 73.8278, isBase: true },
    { name: 'Old Goa', lat: 15.5009, lng: 73.9116 },
    { name: 'Colva Beach', lat: 15.2793, lng: 73.9222, isBase: true },
  ],
  MANALI: [
    { name: 'Mall Road', lat: 32.2432, lng: 77.1892, isBase: true },
    { name: 'Old Manali', lat: 32.256, lng: 77.182 },
    { name: 'Solang Valley', lat: 32.3166, lng: 77.1582 },
  ],
  JAIPUR: [
    { name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267, isBase: true },
    { name: 'MI Road', lat: 26.9157, lng: 75.8069 },
    { name: 'Amer Fort', lat: 26.9855, lng: 75.8513 },
  ],
  KERALA: [
    { name: 'Fort Kochi', lat: 9.9658, lng: 76.2421, isBase: true },
    { name: 'Alleppey (Alappuzha)', lat: 9.4981, lng: 76.3388, isBase: true },
    { name: 'Munnar', lat: 10.0889, lng: 77.0595, isBase: true },
  ],
  DARJEELING: [
    { name: 'Chowrasta (The Mall)', lat: 27.0418, lng: 88.2663, isBase: true },
    { name: 'Darjeeling Railway Station', lat: 27.0389, lng: 88.2627 },
    { name: 'Tiger Hill', lat: 26.9946, lng: 88.2869 },
  ],
};

export const mockPlaceDirectory: PlaceDirectory = {
  places: () => ALL,
  isDestination: (code) => MOCK_DESTINATIONS.some((p) => p.code === code),
  get: (code) => ALL.find((p) => p.code === code),
  landmarks: (code) => MOCK_LANDMARKS[code] ?? [],
};
