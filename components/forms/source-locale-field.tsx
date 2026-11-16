'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';

/**
 * Choix de la langue de saisie. Le contenu est rédigé une seule fois ;
 * l'autre langue est traduite automatiquement à l'enregistrement.
 */
export function SourceLocaleField({
  defaultValue,
  onChange,
}: {
  defaultValue: 'fr' | 'en';
  onChange?: (v: 'fr' | 'en') => void;
}) {
  const t = useTranslations('translation');
  const tc = useTranslations('common');
  const id = useId();
  return (
    <div className="rounded-lg bg-info-soft p-3 text-info">
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Languages aria-hidden className="size-4" />
        {t('sourceLabel')}
      </label>
      <select
        id={id}
        name="source_locale"
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value as 'fr' | 'en')}
        className="input max-w-xs text-text"
      >
        <option value="fr">{tc('french')}</option>
        <option value="en">{tc('english')}</option>
      </select>
      <p className="mt-1 text-xs">{t('sourceHint')}</p>
    </div>
  );
}
