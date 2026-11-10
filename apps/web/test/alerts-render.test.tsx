import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AlertRow } from '../components/alert-row';
import { PriceAlertButton } from '../components/price-alert-button';
import type { AlertView } from '../lib/account';

// Spec 2026-11-10-price-alerts: set an alert from the results page; manage alerts on /account.
const messages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));

function render(locale: string, node: ReactNode): { html: string; errors: string[] } {
  const errors: string[] = [];
  const html = renderToString(
    <NextIntlClientProvider
      locale={locale}
      messages={messages(locale)}
      timeZone="Asia/Kolkata"
      onError={(e) => errors.push(e.message)}
    >
      {node}
    </NextIntlClientProvider>,
  );
  return { html, errors };
}

const alert: AlertView = {
  id: 'a1',
  tripId: 't1',
  tripTitle: 'Goa',
  threshold: 38000,
  active: false,
  lastCheckedAt: '2026-11-10T01:30:00.000Z',
  lastNotifiedAmount: 38400,
};

describe.each(['en', 'hi', 'bn'])('price alerts render (%s)', (locale) => {
  const m = messages(locale).alerts;

  test('the button opens a form with 5% below today’s total filled in', () => {
    const { html, errors } = render(
      locale,
      <PriceAlertButton
        saved={{ status: 'saved', tripId: 't1' }}
        ensureSaved={async () => 't1'}
        total={40000}
        returnTo="/trip/s1"
        className=""
        initiallyOpen
      />,
    );
    expect(errors).toEqual([]);
    expect(html).toContain(m.button);
    expect(html).toContain('value="38000"');
    expect(html).toContain('₹40,000');
  });

  test('signed out: asks you to sign in', () => {
    const { html } = render(
      locale,
      <PriceAlertButton
        saved={{ status: 'anonymous' }}
        ensureSaved={async () => 'signin'}
        total={40000}
        returnTo="/trip/s1"
        className=""
      />,
    );
    expect(html).toContain(m.signIn);
    expect(html).toContain('/account?next=%2Ftrip%2Fs1');
  });

  test('an alert row on /account: threshold, paused, resume, last emailed', () => {
    const { html, errors } = render(
      locale,
      <AlertRow alert={alert} onToggle={() => {}} onDelete={() => {}} />,
    );
    expect(errors).toEqual([]);
    expect(html).toContain('₹38,000');
    expect(html).toContain(m.paused);
    expect(html).toContain(m.resume);
    expect(html).toContain('₹38,400');
    expect(html).toContain(m.delete);
  });
});
