'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Check, Circle, X } from 'lucide-react';
import { passwordChecks, passwordStrength, type PasswordRule } from '@/lib/validation/password';
import { TextField } from './fields';

const RULES: PasswordRule[] = ['length', 'letter', 'digit'];
const STRENGTH_TONE = ['text.disabled', 'error.main', 'warning.main', 'success.main', 'success.main'] as const;

/**
 * Nouveau mot de passe : règles affichées en direct (chaque règle passe au
 * vert avec une coche quand elle est remplie), jauge de robustesse, bouton
 * afficher / masquer. La valeur est remontée au formulaire pour activer le
 * bouton de validation seulement quand les règles sont remplies.
 */
export function PasswordField({
  name = 'password',
  label,
  error,
  value,
  onValueChange,
  autoFocus,
}: {
  name?: string;
  label: string;
  error?: string;
  value: string;
  onValueChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations('auth.passwordRules');
  const rulesId = useId();
  const checks = passwordChecks(value);
  const strength = passwordStrength(value);

  return (
    <Box>
      <TextField
        name={name}
        type="password"
        label={label}
        autoComplete="new-password"
        required
        maxLength={72}
        error={error}
        autoFocus={autoFocus}
        onChange={(e) => onValueChange(e.target.value)}
      />
      <Box id={rulesId} sx={{ mt: 2 }}>
        {/* Jauge de robustesse : 4 segments, libellé écrit en toutes lettres. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, flex: 1, maxWidth: 200 }}>
            {[1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ height: 4, borderRadius: 2, bgcolor: strength >= i ? STRENGTH_TONE[strength] : 'divider', transition: 'background-color 150ms ease-out' }} />
            ))}
          </Box>
          <Typography variant="caption" aria-live="polite" sx={{ color: 'text.secondary', minWidth: 80 }}>
            {t(`strength${strength}`)}
          </Typography>
        </Box>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0, display: 'grid', gap: 0.5 }} aria-label={t('title')}>
          {RULES.map((r) => {
            const ok = checks[r];
            return (
              <Box component="li" key={r} sx={{ display: 'flex', alignItems: 'center', gap: 1, color: ok ? 'success.main' : 'text.secondary' }}>
                {ok ? <Check aria-hidden size={14} strokeWidth={2.5} /> : <Circle aria-hidden size={10} />}
                <Typography variant="caption" sx={{ color: 'inherit', fontWeight: ok ? 600 : 400 }}>
                  {t(r)}
                  <span className="sr-only"> — {ok ? t('met') : t('unmet')}</span>
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/** Confirmation : vérifie en direct qu'elle correspond au mot de passe. */
export function PasswordConfirmField({
  name = 'password_confirm',
  label,
  error,
  password,
  value,
  onValueChange,
}: {
  name?: string;
  label: string;
  error?: string;
  password: string;
  value: string;
  onValueChange: (v: string) => void;
}) {
  const t = useTranslations('auth.passwordRules');
  const match = value.length > 0 && value === password;
  return (
    <Box>
      <TextField name={name} type="password" label={label} autoComplete="new-password" required maxLength={72} error={error} onChange={(e) => onValueChange(e.target.value)} />
      {value.length > 0 && (
        <Box aria-live="polite" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: match ? 'success.main' : 'error.main' }}>
          {match ? <Check aria-hidden size={14} strokeWidth={2.5} /> : <X aria-hidden size={14} strokeWidth={2.5} />}
          <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
            {match ? t('match') : t('noMatch')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
