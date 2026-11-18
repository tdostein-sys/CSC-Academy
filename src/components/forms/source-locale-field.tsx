'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Languages } from 'lucide-react';
import { tok } from '@/@core/theme/tokens';

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
    <Box sx={(theme) => ({ borderRadius: 1, p: 4, bgcolor: tok(theme)['info-soft'], color: tok(theme).info })}>
      <Box component="label" htmlFor={id} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600, fontSize: '0.9375rem' }}>
        <Languages aria-hidden size={18} />
        {t('sourceLabel')}
      </Box>
      <Box
        component="select"
        id={id}
        name="source_locale"
        defaultValue={defaultValue}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value as 'fr' | 'en')}
        sx={(theme) => ({
          font: 'inherit',
          minWidth: 200,
          px: 3,
          py: 2,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          color: 'text.primary',
        })}
      >
        <option value="fr">{tc('french')}</option>
        <option value="en">{tc('english')}</option>
      </Box>
      <Typography variant="body2" sx={{ mt: 2, color: 'inherit' }}>
        {t('sourceHint')}
      </Typography>
    </Box>
  );
}
