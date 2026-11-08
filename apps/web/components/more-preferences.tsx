'use client';

import { AC_PREFS, BERTH_PREFS, COMPANIONS, FOOD_PREFS, INTERESTS, TRAVEL_MODES } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { Preferences } from '../lib/search-form-state';
import { Chip } from './chip';
import { FieldBox } from './field-box';
import { FieldError } from './field-error';

interface Props {
  id: string;
  value: Preferences;
  onChange: (p: Preferences) => void;
  errors: { stayNear?: string; budget?: string };
}

const control = 'mt-0.5 w-full bg-transparent text-[13px] font-semibold outline-none placeholder:font-normal placeholder:text-muted/70';

function toggleIn<T>(list: T[] | undefined, v: T): T[] {
  const l = list ?? [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

/** The optional inputs hidden under "More preferences" (brief §2 item 7). */
export function MorePreferences({ id, value, onChange, errors }: Props) {
  const t = useTranslations('search');
  const uid = useId();
  const set = (patch: Partial<Preferences>) => onChange({ ...value, ...patch });

  function select<K extends 'travelMode' | 'ac' | 'berth' | 'food'>(
    key: K,
    label: string,
    options: readonly NonNullable<Preferences[K]>[],
    optionKey: string,
  ) {
    const fid = `${uid}-${key}`;
    return (
      <FieldBox label={label} htmlFor={fid}>
        <select id={fid} className={`${control} cursor-pointer`} value={value[key] ?? 'any'} onChange={(e) => set({ [key]: e.target.value } as Partial<Preferences>)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {t(`${optionKey}.${String(o)}`)}
            </option>
          ))}
        </select>
      </FieldBox>
    );
  }

  return (
    <div id={id} className="mt-3 grid grid-cols-1 gap-2.5 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <FieldBox label={t('stayNear')} htmlFor={`${uid}-near`} invalid={!!errors.stayNear}>
          <input
            id={`${uid}-near`}
            className={control}
            maxLength={80}
            placeholder={t('stayNearPlaceholder')}
            value={value.stayNear ?? ''}
            onChange={(e) => set({ stayNear: e.target.value })}
          />
        </FieldBox>
        <FieldError id={`${uid}-near-err`} message={errors.stayNear} />
      </div>
      <div>
        <FieldBox label={t('budget')} htmlFor={`${uid}-budget`} invalid={!!errors.budget}>
          <input
            id={`${uid}-budget`}
            className={control}
            inputMode="numeric"
            placeholder={t('budgetPlaceholder')}
            value={value.budget === undefined ? '' : String(value.budget)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
              set({ budget: digits ? Number(digits) : undefined });
            }}
          />
        </FieldBox>
        <FieldError id={`${uid}-budget-err`} message={errors.budget} />
      </div>
      {select('travelMode', t('travelMode'), TRAVEL_MODES, 'modes')}
      {select('food', t('food'), FOOD_PREFS, 'foodOptions')}
      {select('ac', t('ac'), AC_PREFS, 'acOptions')}
      {select('berth', t('berth'), BERTH_PREFS, 'berthOptions')}
      <FieldBox label={t('with')} className="sm:col-span-2 lg:col-span-2">
        <div className="mt-1 flex flex-wrap gap-1.5">
          {COMPANIONS.map((c) => (
            <Chip key={c} on={!!value.companions?.includes(c)} onToggle={() => set({ companions: toggleIn(value.companions, c) })}>
              {t(`companions.${c}`)}
            </Chip>
          ))}
        </div>
      </FieldBox>
      <FieldBox label={t('interests')} className="sm:col-span-2 lg:col-span-4">
        <div className="mt-1 flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => (
            <Chip key={i} on={!!value.interests?.includes(i)} onToggle={() => set({ interests: toggleIn(value.interests, i) })}>
              {t(`interestOptions.${i}`)}
            </Chip>
          ))}
        </div>
      </FieldBox>
    </div>
  );
}
