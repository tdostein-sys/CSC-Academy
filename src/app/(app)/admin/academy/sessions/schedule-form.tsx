'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { Plus, Trash2 } from 'lucide-react';
import { FormMessage, SubmitButton, TextField } from '@/components/forms/fields';
import { useFormSubmit } from '@/components/forms/use-validated-action';
import type { FormState } from '@/lib/forms';
import { formatXAF } from '@/lib/format';
import { parseAmount } from '@/lib/numbers';
import { MAX_INSTALLMENTS } from '@/lib/validation/academy';
import type { Installment } from '@/lib/academy/types';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

interface Row {
  key: number;
  amount: string;
  due: string;
}

/**
 * Échéancier d'une session : une ligne par tranche (montant + date limite).
 * Le prix total est la somme des tranches. Figé dès le premier paiement.
 */
export function ScheduleForm({ action, sessionId, installments }: { action: ServerAction; sessionId: string; installments: Installment[] }) {
  const t = useTranslations('adminAcademy.session');
  const ta = useTranslations('academy');
  const locale = useLocale() === 'en' ? 'en' : 'fr';
  const { state, submit, pending } = useFormSubmit(action);
  const [rows, setRows] = useState<Row[]>(() =>
    installments.length
      ? installments.map((i) => ({ key: i.rank, amount: String(i.amount), due: i.due_on }))
      : [{ key: 1, amount: '', due: '' }],
  );
  const total = rows.reduce((sum, r) => sum + (parseAmount(r.amount) ?? 0), 0);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form onSubmit={submit} noValidate>
      <input type="hidden" name="id" value={sessionId} />
      <Box sx={{ display: 'grid', gap: 3 }}>
        {rows.map((r, i) => (
          <Box key={r.key} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr 1fr auto' }, gap: 3, alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600 }}>{ta('installment', { rank: i + 1 })}</Typography>
            <TextField name={`amount_${i + 1}`} label={t('amount')} inputMode="numeric" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} size="small" required />
            <TextField name={`due_${i + 1}`} type="date" label={t('dueOn')} value={r.due} onChange={(e) => update(r.key, { due: e.target.value })} size="small" required />
            <IconButton
              aria-label={t('removeRow', { rank: i + 1 })}
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              <Trash2 aria-hidden size={18} />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            startIcon={<Plus aria-hidden size={16} />}
            disabled={rows.length >= MAX_INSTALLMENTS}
            onClick={() => setRows((rs) => [...rs, { key: Math.max(0, ...rs.map((x) => x.key)) + 1, amount: '', due: '' }])}
          >
            {t('addRow')}
          </Button>
          <Typography aria-live="polite">
            {t('total')} : <strong>{formatXAF(total, locale)}</strong>
          </Typography>
        </Box>
        <FormMessage state={state} />
        <Box>
          <SubmitButton pending={pending} fullWidth={false}>
            {t('saveSchedule')}
          </SubmitButton>
        </Box>
      </Box>
    </form>
  );
}
