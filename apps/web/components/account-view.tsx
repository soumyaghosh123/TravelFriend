'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  deleteAlert,
  deleteTrip,
  fetchMe,
  listAlerts,
  listTrips,
  openTrip,
  setAlertActive,
  signOut,
  type AlertView,
  type Me,
  type SavedTrip,
} from '../lib/account';
import { dateRange, monthLabel } from '../lib/format';
import { addDays } from '@tripsaver/domain';
import { AlertRow } from './alert-row';
import { SignInForm } from './sign-in-form';

/**
 * `/account`: sign in, or your saved trips (open, delete), their price alerts (pause, delete) and sign
 * out. `open` (from a price-alert email) opens that saved trip straight away.
 */
export function AccountView({ next, failed, open }: { next: string; failed: boolean; open?: string }) {
  const t = useTranslations('account');
  const tp = useTranslations('results.plans');
  const locale = useLocale();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertView[]>([]);

  useEffect(() => {
    fetchMe()
      .then(async (u) => {
        setMe(u);
        if (!u) return;
        // Came here to sign in on the way to somewhere else: go back there.
        if (next !== '/account') return router.replace(next);
        const [ts, as] = await Promise.all([listTrips(), listAlerts().catch(() => [])]);
        setTrips(ts ?? []);
        setAlerts(as ?? []);
        if (open && (ts ?? []).some((x) => x.id === open)) void openSaved(open);
      })
      .catch(() => setMe(null));
  }, [next, router, open]);

  async function openSaved(id: string) {
    setNotice(null);
    const r = await openTrip(id).catch(() => null);
    if (r === 'past') return setNotice(t('past'));
    if (!r) return setNotice(t('openFailed'));
    router.push(
      `/trip/${encodeURIComponent(r.searchId)}?${new URLSearchParams({ plan: r.style, start: r.start })}`,
    );
  }

  if (me === undefined) return <p className="text-muted">{t('loading')}</p>;
  if (!me) return <SignInForm next={next} failed={failed} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card">
        <div>
          <p className="text-sm text-muted">{t('signedInAs')}</p>
          <b>{me.name ?? me.email}</b>
          {me.name && me.email && <span className="text-sm text-muted"> · {me.email}</span>}
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            setMe(null);
            setTrips(null);
          }}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:border-brand"
        >
          {t('signOut')}
        </button>
      </div>

      <section className="rounded-card bg-white p-4 shadow-card">
        <h2 className="text-lg font-bold">{t('myTrips')}</h2>
        {notice && <p className="mt-2 rounded-lg bg-warn-l px-3 py-2 text-sm text-warn">{notice}</p>}
        {trips === null ? (
          <p className="mt-2 text-muted">{t('loading')}</p>
        ) : trips.length === 0 ? (
          <p className="mt-2 text-muted">
            {t('noTrips')}{' '}
            <Link href="/#search" className="font-semibold text-brand hover:underline">
              {t('planOne')}
            </Link>
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {trips.map((trip) => (
              <li key={trip.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <b>{trip.title ?? `${trip.inputs.from} → ${trip.inputs.to}`}</b>
                  <div className="text-sm text-ink2">
                    {tp(`${trip.style}.name`)} ·{' '}
                    {dateRange(trip.start, addDays(trip.start, trip.inputs.days - 1), locale)} ·{' '}
                    {t('days', { n: trip.inputs.days })} · {monthLabel(trip.inputs.month, locale)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void openSaved(trip.id)}
                    className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-d"
                  >
                    {t('open')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteTrip(trip.id).catch(() => {});
                      setTrips((ts) => (ts ?? []).filter((x) => x.id !== trip.id));
                      setAlerts((as) => as.filter((a) => a.tripId !== trip.id));
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:border-bad hover:text-bad"
                  >
                    {t('delete')}
                  </button>
                </div>
                {alerts
                  .filter((a) => a.tripId === trip.id)
                  .map((a) => (
                    <div key={a.id} className="w-full">
                      <AlertRow
                        alert={a}
                        onToggle={async (active) => {
                          await setAlertActive(a.id, active).catch(() => {});
                          setAlerts((as) => as.map((x) => (x.id === a.id ? { ...x, active } : x)));
                        }}
                        onDelete={async () => {
                          await deleteAlert(a.id).catch(() => {});
                          setAlerts((as) => as.filter((x) => x.id !== a.id));
                        }}
                      />
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
