import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { AccountView } from '../components/account-view';
import { SaveTripButton } from '../components/save-trip-button';
import { SignInForm } from '../components/sign-in-form';
import { VerifyLink } from '../components/verify-link';
import { signInHref } from '../lib/account';
import { safeNext } from '../lib/safe-next';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));

function render(locale: string, node: ReactNode): { html: string; errors: string[] } {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const errors: string[] = [];
  const html = renderToString(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Kolkata"
      onError={(e) => errors.push(e.message)}
    >
      {node}
    </NextIntlClientProvider>,
  );
  return { html, errors };
}

describe('safeNext (no open redirects after sign-in)', () => {
  test('keeps paths on our site, drops everything else', () => {
    expect(safeNext('/trip/abc?plan=budget&start=2026-12-08')).toBe('/trip/abc?plan=budget&start=2026-12-08');
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      undefined,
      42,
      '/a b',
    ])
      expect(safeNext(bad)).toBe('/account');
  });
  test('the sign-in link carries where to come back to', () => {
    expect(signInHref('/trip/abc?plan=budget')).toBe('/account?next=%2Ftrip%2Fabc%3Fplan%3Dbudget');
  });
});

describe('account screens render in every language', () => {
  const save = async () => 'ok' as const;
  const screens: [string, ReactNode][] = [
    ['sign-in form', <SignInForm key="s" next="/account" />],
    ['sign-in form after a Google failure', <SignInForm key="f" next="/account" failed />],
    ['account (loading)', <AccountView key="a" next="/account" failed={false} />],
    ['verify link', <VerifyLink key="v" token={'t'.repeat(30)} next="/account" />],
    [
      'save button: unsaved',
      <SaveTripButton
        key="1"
        state={{ status: 'unsaved' }}
        save={save}
        title="Goa"
        returnTo="/trip/x"
        className=""
      />,
    ],
    [
      'save button: saved',
      <SaveTripButton
        key="2"
        state={{ status: 'saved', tripId: 't1' }}
        save={save}
        title="Goa"
        returnTo="/trip/x"
        className=""
      />,
    ],
    [
      'save button: signed out',
      <SaveTripButton
        key="3"
        state={{ status: 'anonymous' }}
        save={save}
        title="Goa"
        returnTo="/trip/x?plan=budget"
        className=""
      />,
    ],
  ];
  const cases = screens.flatMap(([name, node]) => ['en', 'hi', 'bn'].map((l) => [name, l, node] as const));
  test.each(cases)('%s · %s', (_name, locale, node) => {
    expect(render(locale, node).errors).toEqual([]);
  });

  test('en: the sign-in form offers an email link; signed-out "Save trip" goes to sign in and back', () => {
    expect(render('en', <SignInForm next="/account" />).html).toContain('Email me a sign-in link');
    const html = render(
      'en',
      <SaveTripButton
        state={{ status: 'anonymous' }}
        save={async () => 'ok'}
        title="Goa"
        returnTo="/trip/x?plan=budget"
        className=""
      />,
    ).html;
    expect(html).toContain('href="/account?next=%2Ftrip%2Fx%3Fplan%3Dbudget"');
    expect(
      render(
        'en',
        <SaveTripButton
          state={{ status: 'saved', tripId: 't' }}
          save={async () => 'ok'}
          title="Goa"
          returnTo="/x"
          className=""
        />,
      ).html,
    ).toContain('Saved to My trips');
  });
});
