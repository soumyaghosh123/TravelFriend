'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { fetchMe, type Me } from '../lib/account';

/** Header link: "My trips" when signed in, "Sign in" otherwise. */
export function AccountLink() {
  const t = useTranslations('account');
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
  return (
    <Link
      href="/account"
      className="rounded-full border border-line px-3 py-1.5 font-medium text-ink2 hover:border-brand"
    >
      {me ? t('myTrips') : t('signIn')}
    </Link>
  );
}
