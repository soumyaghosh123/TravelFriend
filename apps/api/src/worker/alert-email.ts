import type { Locale } from '../account/account-store.js';
import type { MailMessage } from '../account/mailer.js';

export interface AlertEmailData {
  to: string;
  locale: string;
  destination: string;
  style: string;
  start: string;
  end: string;
  total: number;
  perPerson: number;
  threshold: number;
  tripId: string;
  webOrigin: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const dates = (start: string, end: string, locale: Locale) => {
  const f = new Intl.DateTimeFormat(`${locale}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f.format(new Date(`${start}T00:00:00Z`))} – ${f.format(new Date(`${end}T00:00:00Z`))}`;
};

type Copy = {
  plan: Record<string, string>;
  subject: (d: string, total: string) => string;
  lines: (x: {
    plan: string;
    dates: string;
    total: string;
    perPerson: string;
    threshold: string;
    open: string;
    stop: string;
  }) => string[];
};

const COPY: Record<Locale, Copy> = {
  en: {
    plan: { offbeat: 'Offbeat', budget: 'Budget', comfort: 'Comfort' },
    subject: (d, total) => `Your ${d} trip is now ${total}`,
    lines: (x) => [
      `${x.plan} plan, ${x.dates}`,
      `Total for your group: ${x.total} (${x.perPerson} per person), below your ${x.threshold} alert.`,
      'approx. · prices checked at 07:00 (India time); book soon, prices change.',
      '',
      `Open your trip: ${x.open}`,
      `Stop this alert: ${x.stop}`,
    ],
  },
  hi: {
    plan: { offbeat: 'ऑफ़बीट', budget: 'बजट', comfort: 'आरामदायक' },
    subject: (d, total) => `आपकी ${d} यात्रा अब ${total} की है`,
    lines: (x) => [
      `${x.plan} प्लान, ${x.dates}`,
      `आपके समूह का कुल खर्च: ${x.total} (प्रति व्यक्ति ${x.perPerson}), आपके ${x.threshold} अलर्ट से कम।`,
      'लगभग · कीमतें सुबह 07:00 बजे (भारतीय समय) जाँची गईं; कीमतें बदलती हैं, जल्द बुक करें।',
      '',
      `अपनी यात्रा खोलें: ${x.open}`,
      `यह अलर्ट बंद करें: ${x.stop}`,
    ],
  },
  bn: {
    plan: { offbeat: 'অফবিট', budget: 'বাজেট', comfort: 'আরামদায়ক' },
    subject: (d, total) => `আপনার ${d} ভ্রমণ এখন ${total}`,
    lines: (x) => [
      `${x.plan} প্ল্যান, ${x.dates}`,
      `আপনার দলের মোট খরচ: ${x.total} (জনপ্রতি ${x.perPerson}), আপনার ${x.threshold} অ্যালার্টের চেয়ে কম।`,
      'আনুমানিক · দাম সকাল 07:00-এ (ভারতীয় সময়) দেখা হয়েছে; দাম বদলায়, তাড়াতাড়ি বুক করুন।',
      '',
      `আপনার ভ্রমণ খুলুন: ${x.open}`,
      `এই অ্যালার্ট বন্ধ করুন: ${x.stop}`,
    ],
  },
};

/** The price-drop email, in the user's language (en / hi / bn). Amounts are the group total in rupees. */
export function alertEmail(a: AlertEmailData): MailMessage {
  const locale: Locale = a.locale === 'hi' || a.locale === 'bn' ? a.locale : 'en';
  const c = COPY[locale];
  const total = inr(a.total);
  return {
    to: a.to,
    subject: c.subject(a.destination, total),
    text: c
      .lines({
        plan: c.plan[a.style] ?? a.style,
        dates: dates(a.start, a.end, locale),
        total,
        perPerson: inr(a.perPerson),
        threshold: inr(a.threshold),
        open: `${a.webOrigin}/account?open=${encodeURIComponent(a.tripId)}`,
        stop: `${a.webOrigin}/account`,
      })
      .join('\n'),
  };
}
