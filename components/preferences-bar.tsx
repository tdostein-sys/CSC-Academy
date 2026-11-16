'use client';

import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore, useTransition } from 'react';
import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { setLocale } from '@/app/actions/preferences';

const subscribeNoop = () => () => {};

/** Barre fine au-dessus de l'application : langue + thème. */
export function PreferencesBar() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  // Le thème réel n'est connu qu'après hydratation.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const themes = [
    { value: 'light', label: t('light'), Icon: Sun },
    { value: 'dark', label: t('dark'), Icon: Moon },
    { value: 'system', label: t('system'), Icon: Monitor },
  ] as const;

  return (
    <div className="border-b border-border bg-surface text-xs">
      <div className="container-page flex h-9 items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 text-muted">
          <Languages aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t('language')}</span>
          <select
            className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs text-text"
            value={locale}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value;
              startTransition(() => setLocale(next));
            }}
          >
            <option value="fr">{t('french')}</option>
            <option value="en">{t('english')}</option>
          </select>
        </label>

        <div role="group" aria-label={t('theme')} className="flex items-center rounded border border-border bg-bg">
          {themes.map(({ value, label, Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => setTheme(value)}
                className={`flex size-7 items-center justify-center rounded ${active ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text'}`}
              >
                <Icon aria-hidden className="size-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
