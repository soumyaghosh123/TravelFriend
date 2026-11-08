import type { Travellers } from '../types.js';

/**
 * Brief §2.4: about 2 adults + up to 2 children aged 7 or under per room.
 * Children aged 8+ pay full price and count as adults here.
 */
export function suggestRooms(t: Travellers): number {
  const young = t.childAges.filter((a) => a <= 7).length;
  const adultLike = t.adults + (t.childAges.length - young);
  return Math.max(1, Math.ceil(adultLike / 2), Math.ceil((adultLike + young) / 4));
}
