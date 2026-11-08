import type { Place, PlaceDirectory } from '../../interfaces.js';

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

export const mockPlaceDirectory: PlaceDirectory = {
  places: () => ALL,
  get: (code) => ALL.find((p) => p.code === code),
};
