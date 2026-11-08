'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { suggestPlaces } from '../lib/api';
import type { PlaceOption } from '../lib/search-form-state';
import { FieldBox } from './field-box';
import { FieldError } from './field-error';

interface Props {
  label: string;
  placeholder: string;
  value: PlaceOption | null;
  onChange: (place: PlaceOption | null) => void;
  error?: string;
}

/** "Howrah / Sealdah (HWH, SDAH) · CCU airport · Esplanade bus" style hint under a place. */
export function usePlaceHint() {
  const t = useTranslations('search');
  return (p: PlaceOption) =>
    [
      p.kind === 'region' ? t('region') : null,
      p.stations.length ? p.stations.join(' · ') : null,
      ...p.airports.slice(0, 2).map((code) => t('airport', { code })),
      p.busPoints[0] ? t('bus', { name: p.busPoints[0] }) : null,
    ]
      .filter(Boolean)
      .join(' · ');
}

/** Accessible autocomplete (ARIA combobox) over cities, regions, stations, airports and bus points. */
export function PlaceField({ label, placeholder, value, onChange, error }: Props) {
  const t = useTranslations('search');
  const hint = usePlaceHint();
  const id = useId();
  const listId = `${id}-list`;
  const errId = `${id}-err`;
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value?.name ?? ''), [value]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const q = value && text === value.name ? '' : text;
    setLoading(true);
    const timer = setTimeout(() => {
      suggestPlaces(q, ctrl.signal)
        .then((list) => {
          setItems(list);
          setActive(0);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setItems([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, open, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function choose(p: PlaceOption) {
    onChange(p);
    setText(p.name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setText(value?.name ?? '');
    }
  }

  return (
    <div ref={boxRef} className="relative min-w-0">
      <FieldBox label={label} htmlFor={id} invalid={!!error}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${items[active].code}` : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="mt-0.5 w-full truncate bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted/70"
        />
        <div className="truncate text-xs text-muted">{value ? hint(value) : ' '}</div>
      </FieldBox>
      <FieldError id={errId} message={error} />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-auto rounded-card border border-line bg-white p-1 shadow-card sm:min-w-72"
        >
          {items.map((p, i) => (
            <li
              key={p.code}
              id={`${listId}-${p.code}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-lg px-3 py-2 ${i === active ? 'bg-brand-xl' : ''}`}
            >
              <div className="font-semibold">{p.name}</div>
              <div className="truncate text-xs text-muted">{hint(p)}</div>
            </li>
          ))}
          {!items.length && (
            <li className="px-3 py-2 text-sm text-muted" role="presentation">
              {loading ? t('loading') : t('noMatches')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
