import type { Landmark, Place, PlaceDirectory } from '../../interfaces.js';

/** Origin cities. Station and airport codes are real Indian Railways / IATA codes. */
export const MOCK_ORIGINS: Place[] = [
  { code: 'KOL', name: 'Kolkata', kind: 'city', stations: ['HWH', 'SDAH'], airports: ['CCU'], busPoints: ['Esplanade'], lat: 22.57, lng: 88.36 },
  { code: 'DEL', name: 'Delhi', kind: 'city', stations: ['NDLS', 'NZM'], airports: ['DEL'], busPoints: ['Kashmere Gate ISBT'], lat: 28.61, lng: 77.21 },
  { code: 'BOM', name: 'Mumbai', kind: 'city', stations: ['CSMT', 'LTT'], airports: ['BOM'], busPoints: ['Borivali'], lat: 19.08, lng: 72.88 },
  { code: 'BLR', name: 'Bengaluru', kind: 'city', stations: ['SBC', 'YPR'], airports: ['BLR'], busPoints: ['Majestic'], lat: 12.97, lng: 77.59 },
  { code: 'MAA', name: 'Chennai', kind: 'city', stations: ['MAS'], airports: ['MAA'], busPoints: ['Koyambedu'], lat: 13.08, lng: 80.27 },
  { code: 'HYD', name: 'Hyderabad', kind: 'city', stations: ['SC', 'HYB'], airports: ['HYD'], busPoints: ['MGBS'], lat: 17.39, lng: 78.49 },
];

export const MOCK_DESTINATIONS: Place[] = [
  { code: 'GOA', name: 'Goa', kind: 'region', stations: ['MAO', 'VSG', 'THVM'], airports: ['GOI', 'GOX'], busPoints: ['Panjim Kadamba', 'Mapusa', 'Margao'], lat: 15.49, lng: 73.83 },
  { code: 'MANALI', name: 'Manali', kind: 'city', stations: ['CDG', 'KLK'], airports: ['KUU'], busPoints: ['Manali Bus Stand'], lat: 32.24, lng: 77.19 },
  { code: 'JAIPUR', name: 'Jaipur', kind: 'city', stations: ['JP'], airports: ['JAI'], busPoints: ['Sindhi Camp'], lat: 26.91, lng: 75.79 },
  { code: 'KERALA', name: 'Kerala', kind: 'region', stations: ['ERS', 'TVC'], airports: ['COK', 'TRV'], busPoints: ['Vyttila Hub', 'Thampanoor'], lat: 9.93, lng: 76.27 },
  { code: 'DARJEELING', name: 'Darjeeling', kind: 'city', stations: ['NJP'], airports: ['IXB'], busPoints: ['Siliguri Tenzing Norgay Terminus'], lat: 27.04, lng: 88.26 },
];

const ALL = [...MOCK_ORIGINS, ...MOCK_DESTINATIONS];

/** Real landmarks with approximate coordinates. The first per destination is its main area. */
export const MOCK_LANDMARKS: Record<string, Landmark[]> = {
  GOA: [
    { name: 'Calangute Beach', lat: 15.5439, lng: 73.7553 },
    { name: 'Baga Beach', lat: 15.5553, lng: 73.7517 },
    { name: 'Panjim (Panaji)', lat: 15.4909, lng: 73.8278 },
    { name: 'Old Goa', lat: 15.5009, lng: 73.9116 },
    { name: 'Colva Beach', lat: 15.2793, lng: 73.9222 },
  ],
  MANALI: [
    { name: 'Mall Road', lat: 32.2432, lng: 77.1892 },
    { name: 'Old Manali', lat: 32.256, lng: 77.182 },
    { name: 'Solang Valley', lat: 32.3166, lng: 77.1582 },
  ],
  JAIPUR: [
    { name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267 },
    { name: 'MI Road', lat: 26.9157, lng: 75.8069 },
    { name: 'Amer Fort', lat: 26.9855, lng: 75.8513 },
  ],
  KERALA: [
    { name: 'Fort Kochi', lat: 9.9658, lng: 76.2421 },
    { name: 'Alleppey (Alappuzha)', lat: 9.4981, lng: 76.3388 },
    { name: 'Munnar', lat: 10.0889, lng: 77.0595 },
  ],
  DARJEELING: [
    { name: 'Chowrasta (The Mall)', lat: 27.0418, lng: 88.2663 },
    { name: 'Darjeeling Railway Station', lat: 27.0389, lng: 88.2627 },
    { name: 'Tiger Hill', lat: 26.9946, lng: 88.2869 },
  ],
};

export const mockPlaceDirectory: PlaceDirectory = {
  places: () => ALL,
  get: (code) => ALL.find((p) => p.code === code),
  landmarks: (code) => MOCK_LANDMARKS[code] ?? [],
};
