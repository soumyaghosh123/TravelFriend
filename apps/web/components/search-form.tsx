'use client';

import { HOTEL_TYPES, MAX_DAYS, MIN_DAYS, type SearchInputIssue } from '@tripsaver/domain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useReducer, useState, type FormEvent } from 'react';
import { createSearch } from '../lib/api';
import { buildSearchInput, issueFor, type SearchFormState } from '../lib/search-form-state';
import { todayInIndia } from '../lib/today';
import { travellersReducer } from '../lib/travellers';
import { FieldBox } from './field-box';
import { FieldError } from './field-error';
import { HotelTypeChips } from './hotel-type-chips';
import { MonthField } from './month-field';
import { MorePreferences } from './more-preferences';
import { PlaceField } from './place-field';
import { Stepper } from './stepper';
import { TravellersField } from './travellers-field';

interface Props {
  initial: SearchFormState;
  today: string;
  /** Open "More preferences" from the start (e.g. when prefilled preferences exist). */
  initialMoreOpen?: boolean;
}

/** The six-input search card (brief §2, mockup "Home & search"). */
export function SearchForm({ initial, today, initialMoreOpen = false }: Props) {
  const t = useTranslations('search');
  const router = useRouter();
  const [form, setForm] = useState<Omit<SearchFormState, 'travellers'>>(initial);
  const [travellers, dispatch] = useReducer(travellersReducer, initial.travellers);
  const [issues, setIssues] = useState<SearchInputIssue[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'network'>('idle');
  const [moreOpen, setMoreOpen] = useState(initialMoreOpen);
  const [openTravellers, setOpenTravellers] = useState(0);
  const set = (patch: Partial<SearchFormState>) => setForm((f) => ({ ...f, ...patch }));

  // A destination card links to /?to=CODE: take the new destination without wiping the rest of the form.
  const prefillTo = initial.to;
  useEffect(() => {
    if (prefillTo) setForm((f) => (f.to?.code === prefillTo.code ? f : { ...f, to: prefillTo }));
  }, [prefillTo]);

  const err = (path: string) => issueFor(issues, path);

  const hotelSummary =
    form.hotelTypes.length === HOTEL_TYPES.length || form.hotelTypes.length === 0
      ? t('anyType')
      : form.hotelTypes.map((h) => t(`hotelTypes.${h}`)).join(', ');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const built = buildSearchInput({ ...form, travellers }, todayInIndia());
    if (!built.ok) {
      setIssues(built.issues);
      if (issueFor(built.issues, 'travellers')) setOpenTravellers((n) => n + 1);
      if (issueFor(built.issues, 'preferences')) setMoreOpen(true);
      return;
    }
    setIssues([]);
    setStatus('submitting');
    const res = await createSearch(built.input);
    if (res.ok) {
      router.push(`/trip/${res.searchId}`);
      return;
    }
    if ('issues' in res) {
      setIssues(res.issues);
      setStatus('idle');
    } else setStatus('network');
  }

  return (
    <form
      id="search"
      onSubmit={onSubmit}
      noValidate
      aria-label={t('formLabel')}
      className="relative z-10 mx-3 -mt-16 scroll-mt-4 rounded-[18px] bg-white p-3 shadow-card sm:p-[18px] xl:mx-auto xl:max-w-[1180px]"
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[1.2fr_1.2fr_.7fr_.9fr_1.2fr_1.1fr]">
        <PlaceField
          label={t('from')}
          placeholder={t('fromPlaceholder')}
          value={form.from}
          onChange={(from) => set({ from })}
          error={err('from')}
        />
        <PlaceField
          label={t('to')}
          placeholder={t('toPlaceholder')}
          value={form.to}
          onChange={(to) => set({ to })}
          error={err('to')}
        />
        <div className="min-w-0">
          <FieldBox label={t('days')} invalid={!!err('days')}>
            <Stepper
              label={t('days')}
              value={form.days}
              min={MIN_DAYS}
              max={MAX_DAYS}
              onChange={(days) => set({ days })}
            />
          </FieldBox>
          <FieldError id="days-err" message={err('days')} />
        </div>
        <MonthField
          today={today}
          value={form.month}
          onChange={(month) => set({ month })}
          error={err('month')}
        />
        <div className="min-w-0">
          <FieldBox label={t('hotelType')} invalid={!!err('hotelTypes')}>
            <div className="mt-0.5 truncate text-[15px] font-semibold">{hotelSummary}</div>
            <div className="truncate text-xs text-muted">{t('hotelTypeHint')}</div>
          </FieldBox>
          <FieldError id="hotel-err" message={err('hotelTypes')} />
        </div>
        <TravellersField
          value={travellers}
          dispatch={dispatch}
          error={err('travellers')}
          forceOpen={openTravellers}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="text-xs text-muted">{t('hotelTypesLabel')}</span>
        <HotelTypeChips value={form.hotelTypes} onChange={(hotelTypes) => set({ hotelTypes })} />
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="more-preferences"
          onClick={() => setMoreOpen((o) => !o)}
          className="font-semibold text-brand hover:text-brand-d md:ml-auto"
        >
          <span aria-hidden>{moreOpen ? '▴ ' : '▾ '}</span>
          {t('moreOpen')}
        </button>
      </div>

      {moreOpen && (
        <MorePreferences
          id="more-preferences"
          value={form.preferences}
          onChange={(preferences) => set({ preferences })}
          errors={{ stayNear: err('preferences.stayNear'), budget: err('preferences.budget') }}
        />
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-3.5 w-full rounded-xl bg-accent p-3.5 text-base font-semibold text-[#1f1300] hover:brightness-95 disabled:opacity-70"
      >
        {status === 'submitting' ? t('submitting') : t('submit')}
      </button>
      <div aria-live="polite" className="text-center text-sm">
        {issues.length > 0 && <p className="mt-2 font-medium text-bad">{t('fixErrors')}</p>}
        {status === 'network' && <p className="mt-2 font-medium text-bad">{t('networkError')}</p>}
      </div>
    </form>
  );
}
