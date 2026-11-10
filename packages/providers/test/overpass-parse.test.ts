import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { overpassQuery, parseOverpass } from '../src/real/overpass-parse.js';

// Hand-made, shaped like a real Overpass response (tests never call the network).
const body = JSON.parse(readFileSync(new URL('./fixtures/overpass-goa.json', import.meta.url), 'utf8')) as unknown;
const point = { lat: 15.553, lng: 73.752 };
const byId = (id: string) => parseOverpass(body, [point], 60).find((r) => r.id === id);

describe('overpassQuery', () => {
  test('nodes and ways with a name and an eatery amenity, around each point, with way centres', () => {
    const q = overpassQuery([point, { lat: 15.6, lng: 73.8 }], 3000);
    expect(q).toContain('[out:json]');
    expect(q).toContain('out center tags');
    for (const p of ['15.553,73.752', '15.6,73.8']) {
      expect(q).toContain(`node["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["name"](around:3000,${p});`);
      expect(q).toContain(`way["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["name"](around:3000,${p});`);
    }
  });
});

describe('parseOverpass', () => {
  test('amenity → kind', () => {
    expect(byId('osm-node-102')!.kind).toBe('street');
    expect(byId('osm-way-201')!.kind).toBe('street');
    expect(byId('osm-node-103')!.kind).toBe('budget');
    expect(byId('osm-node-107')!.kind).toBe('restaurant');
  });
  test('veg status from diet:vegetarian and cuisine', () => {
    expect(byId('osm-node-101')!.vegType).toBe('veg');
    expect(byId('osm-node-105')!.vegType).toBe('veg');
    expect(byId('osm-node-102')!.vegType).toBe('both');
    expect(byId('osm-node-106')!.vegType).toBe('non-veg');
    expect(byId('osm-node-107')!.vegType).toBe('unknown');
  });
  test('ways use their centre; no centre or no name → dropped; repeated ids once; names kept as written', () => {
    const all = parseOverpass(body, [point], 60);
    expect(byId('osm-way-201')).toMatchObject({ lat: 15.556, lng: 73.755 });
    expect(all.map((r) => r.id)).not.toContain('osm-way-202');
    expect(all.map((r) => r.id)).not.toContain('osm-node-104');
    expect(all.filter((r) => r.id === 'osm-node-101')).toHaveLength(1);
    expect(byId('osm-node-105')!.name).toBe('शुद्ध भोजनालय');
    expect(all).toHaveLength(7);
  });
  test('cuisine, address, hours and phone; live; no invented rating or price', () => {
    expect(byId('osm-node-103')!.cuisine).toEqual(['coffee shop', 'indian']);
    const souza = byId('osm-node-107')!;
    expect(souza).toMatchObject({
      name: 'Souza Lobo',
      area: 'Calangute Beach Road, Calangute',
      hours: 'Mo-Su 11:00-23:00',
      phone: '+91 832 227 6463',
      live: true,
    });
    expect(souza.rating).toBeUndefined();
    expect(souza.costForTwo).toBeUndefined();
    expect(byId('osm-node-102')!.area).toBeUndefined();
    expect(byId('osm-node-102')!.hours).toBeUndefined();
  });
  test('keeps only the nearest places to each point', () => {
    const ids = parseOverpass(body, [point], 2).map((r) => r.id);
    expect(ids).toEqual(['osm-node-101', 'osm-node-102']);
  });
  test('an unexpected body throws', () => {
    expect(() => parseOverpass({ remark: 'runtime error' }, [point], 60)).toThrow('Overpass: unexpected response');
  });
});
