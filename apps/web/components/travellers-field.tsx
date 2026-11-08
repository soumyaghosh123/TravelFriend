'use client';

import { MAX_ADULTS, MAX_CHILD_AGE, MAX_CHILDREN } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type Dispatch } from 'react';
import { defaultFareType, suggestedRooms, type TravellersAction, type TravellersState } from '../lib/travellers';
import { FieldError } from './field-error';
import { Stepper } from './stepper';

interface Props {
  value: TravellersState;
  dispatch: Dispatch<TravellersAction>;
  error?: string;
  /** Opens the popover from outside (e.g. when a child's age is missing on submit). */
  forceOpen?: number;
}

const AGES = Array.from({ length: MAX_CHILD_AGE + 1 }, (_, i) => i);

/** Head count with child ages and an auto-suggested, editable room count (brief §2 item 6, §2.4). */
export function TravellersField({ value, dispatch, error, forceOpen }: Props) {
  const t = useTranslations('search');
  const id = useId();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const suggested = value.rooms === suggestedRooms(value.adults, value.childAges);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ring = error
    ? 'border-bad ring-3 ring-bad-l'
    : open
      ? 'border-brand ring-3 ring-brand-l'
      : 'border-line hover:border-brand/50';

  return (
    <div ref={boxRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-pop`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`block w-full rounded-xl border bg-white px-3 py-2 text-left ${ring}`}
      >
        <span className="block text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{t('travellers')}</span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold">
          {t('travellersSummary', { adults: value.adults, children: value.childAges.length })}
        </span>
        <span className="block truncate text-xs text-muted">
          {t('roomsSummary', { rooms: value.rooms })} {suggested && t('roomsSuggestedTag')}
        </span>
      </button>
      <FieldError id={`${id}-err`} message={error} />

      {open && (
        <div
          id={`${id}-pop`}
          role="dialog"
          aria-label={t('travellers')}
          className="z-30 mt-2 rounded-card border border-line bg-white p-3.5 shadow-card md:absolute md:right-0 md:top-full md:w-80"
        >
          <div className="flex items-center justify-between border-b border-dashed border-line py-2">
            <div>
              <b>{t('adults')}</b>
              <small className="block text-muted">{t('adultsHint')}</small>
            </div>
            <Stepper label={t('adults')} value={value.adults} min={1} max={MAX_ADULTS} onChange={(v) => dispatch({ type: 'adults', value: v })} />
          </div>

          <div className="border-b border-dashed border-line py-2">
            <div className="flex items-center justify-between">
              <div>
                <b>{t('children')}</b>
                <small className="block text-muted">{t('childrenHint')}</small>
              </div>
              <Stepper
                label={t('children')}
                value={value.childAges.length}
                min={0}
                max={MAX_CHILDREN}
                onChange={(v) => dispatch({ type: v > value.childAges.length ? 'addChild' : 'removeChild' })}
              />
            </div>
            {value.childAges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {value.childAges.map((age, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${age === null && error ? 'border-bad' : 'border-line'}`}
                  >
                    <span className="sr-only">{t('childAge', { n: i + 1 })}</span>
                    <span aria-hidden>{i + 1}:</span>
                    <select
                      value={age ?? ''}
                      onChange={(e) => dispatch({ type: 'childAge', index: i, age: Number(e.target.value) })}
                      className="cursor-pointer bg-transparent font-bold text-brand outline-none"
                    >
                      <option value="" disabled>
                        {t('pickAge')}
                      </option>
                      {AGES.map((a) => (
                        <option key={a} value={a}>
                          {t('ageYears', { age: a })}
                        </option>
                      ))}
                    </select>
                    {age !== null && <span className="text-muted">· {t(`fare.${defaultFareType(age)}`)}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <b>{t('rooms')}</b>
              <small className="block text-muted">{t('roomsHint')}</small>
            </div>
            <Stepper label={t('rooms')} value={value.rooms} min={1} max={value.adults} onChange={(v) => dispatch({ type: 'rooms', value: v })} />
          </div>

          <p className="mt-2 rounded-[10px] bg-brand-xl px-2.5 py-2 text-xs text-brand-d">{t.rich('rule', { b: (c) => <b>{c}</b> })}</p>
          <button type="button" onClick={() => setOpen(false)} className="mt-2.5 w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-d">
            {t('done')}
          </button>
        </div>
      )}
    </div>
  );
}
