'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { AlertView } from '../lib/account';
import { checkedAgo, inr } from '../lib/format';

interface Props {
  alert: AlertView;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}

/** One price alert on /account: ₹X, paused or not, last checked and last emailed, with Pause and Delete. */
export function AlertRow({ alert, onToggle, onDelete }: Props) {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const small =
    'rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink2 hover:border-brand';
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
      <div>
        🔔 <b>{t('row', { threshold: inr(alert.threshold) })}</b>
        {!alert.active && <span className="ml-1.5 text-warn">· {t('paused')}</span>}
        <div className="text-xs text-muted">
          {[
            alert.lastCheckedAt &&
              t('lastChecked', { ago: checkedAgo(alert.lastCheckedAt, Date.now(), locale) }),
            alert.lastNotifiedAmount !== null && t('lastEmailed', { amount: inr(alert.lastNotifiedAmount) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onToggle(!alert.active)} className={small}>
          {alert.active ? t('pause') : t('resume')}
        </button>
        <button type="button" onClick={onDelete} className={`${small} hover:border-bad hover:text-bad`}>
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
