'use client';

import { HOTEL_TYPES, type HotelType } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { Chip } from './chip';

interface Props {
  value: HotelType[];
  onChange: (types: HotelType[]) => void;
}

/** Multi-select hotel types. The 3★+ and 5★ lists are always shown in results regardless. */
export function HotelTypeChips({ value, onChange }: Props) {
  const t = useTranslations('search');
  const toggle = (h: HotelType) =>
    onChange(value.includes(h) ? value.filter((v) => v !== h) : HOTEL_TYPES.filter((x) => x === h || value.includes(x)));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('hotelType')}>
      {HOTEL_TYPES.map((h) => (
        <Chip key={h} on={value.includes(h)} onToggle={() => toggle(h)}>
          {t(`hotelTypes.${h}`)}
        </Chip>
      ))}
    </div>
  );
}
