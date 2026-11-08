import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

type Tree = { [k: string]: string | Tree };

function load(locale: string): Tree {
  return JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')) as Tree;
}

function leaves(t: Tree, prefix = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)));
}

/** Every message key the shared schema, the API and the form can produce. */
const VALIDATION_KEYS = [
  'from.required', 'from.unknown', 'to.required', 'to.unknown', 'to.sameAsFrom',
  'days.range', 'days.longerThanMonth', 'month.format', 'month.past', 'month.tooFar', 'month.noWindowLeft',
  'hotelTypes.min', 'adults.range', 'travellers.max', 'children.max', 'childAge.required', 'childAge.range',
  'rooms.range', 'budget.range', 'stayNear.max', 'unknown',
];

describe('messages', () => {
  const en = leaves(load('en')).sort();

  test.each(['hi', 'bn'])('%s has exactly the same keys as en', (locale) => {
    expect(leaves(load(locale)).sort()).toEqual(en);
  });

  test('every validation key has a message', () => {
    for (const k of VALIDATION_KEYS) expect(en).toContain(`search.errors.${k}`);
  });

  test('the schema produces no message keys the UI lacks', () => {
    const src = readFileSync(new URL('../../../packages/domain/src/search/search-input.ts', import.meta.url), 'utf8');
    const used = [...src.matchAll(/'([a-zA-Z]+\.[a-zA-Z]+)'/g)].map((m) => m[1]!).filter((k) => !k.includes('/'));
    for (const k of new Set(used)) expect(VALIDATION_KEYS, k).toContain(k);
  });
});
