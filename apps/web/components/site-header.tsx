import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AccountLink } from './account-link';
import { LanguageSwitcher } from './language-switcher';

export async function SiteHeader() {
  const t = await getTranslations('header');
  return (
    <header className="flex items-center gap-4 border-b border-line bg-white px-3.5 py-3 md:gap-[18px] md:px-6 md:py-3.5">
      <Link
        href="/"
        aria-label={t('home')}
        className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-.3px] text-ink"
      >
        <span
          className="grid size-[30px] place-items-center rounded-[9px] bg-gradient-to-br from-brand to-[#14b8a6] text-base text-white"
          aria-hidden
        >
          ₹
        </span>
        <span>
          Trip<span className="text-accent">Saver</span>
        </span>
      </Link>
      <nav className="hidden gap-[18px] font-medium text-ink2 md:flex">
        <a href="#destinations" className="hover:text-brand">
          {t('destinations')}
        </a>
        <a href="#how" className="hover:text-brand">
          {t('howItWorks')}
        </a>
      </nav>
      <div className="flex-1" />
      <AccountLink />
      <LanguageSwitcher />
      <span className="hidden rounded-full border border-line px-3 py-1.5 font-medium text-ink2 sm:inline">
        {t('currency')}
      </span>
    </header>
  );
}
