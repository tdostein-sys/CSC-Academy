import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextField } from '@/components/forms/fields';
import { Collapsible } from '@/components/ui/collapsible';
import { payoutMethodOptions } from '@/lib/ambassador/methods';
import { formatDate, formatXAF } from '@/lib/format';
import type { InstallmentStateRow } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { cancelEnrollment, grantExtension, recordPayment } from '../actions';

/** Date du jour au Cameroun, au format AAAA-MM-JJ (valeur par défaut des champs date). */
function doualaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());
}

/**
 * Actions de l'admin sur une inscription : enregistrer un paiement (montant
 * proposé = reste à payer), accorder un délai, annuler une inscription non payée.
 * La base revérifie tout (plafond, statut, droits).
 */
export async function EnrollmentActions({
  enrollmentId,
  status,
  paid,
  remaining,
  states,
}: {
  enrollmentId: string;
  status: 'pending' | 'active' | 'cancelled';
  paid: number;
  remaining: number;
  states: InstallmentStateRow[];
}) {
  const [t, ta, locale] = await Promise.all([getTranslations('adminAcademy.session'), getTranslations('academy'), getLocale()]);
  const l = locale as Locale;
  if (status === 'cancelled') return null;
  const unpaid = states.filter((s) => s.state !== 'paid');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
      {remaining > 0 && (
        <Collapsible kind="button" summary={t('record')}>
          <ActionForm action={recordPayment} resetOnSuccess style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <TextField name="amount" label={t('amount')} inputMode="numeric" defaultValue={String(remaining)} hint={t('remainingHint', { amount: formatXAF(remaining, l) })} required size="small" />
            <SelectField name="method" label={t('method')} required size="small" defaultValue="" options={[{ value: '', label: '—' }, ...payoutMethodOptions(l)]} />
            <TextField name="reference" label={t('reference')} maxLength={120} size="small" optionalLabel />
            <TextField name="paid_on" type="date" label={t('paidOn')} defaultValue={doualaToday()} max={doualaToday()} required size="small" />
            <Button type="submit" variant="contained">
              {t('record')}
            </Button>
          </ActionForm>
        </Collapsible>
      )}

      {unpaid.length > 0 && (
        <Collapsible kind="link" summary={t('extension')}>
          <ActionForm action={grantExtension} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <SelectField
              name="rank"
              label={t('extensionRank')}
              size="small"
              defaultValue={String(unpaid[0].rank)}
              options={unpaid.map((s) => ({ value: String(s.rank), label: `${ta('installment', { rank: s.rank })} — ${formatDate(s.due_on, l)}` }))}
            />
            <TextField name="due_on" type="date" label={t('extensionDate')} required size="small" />
            <TextField name="reason" label={t('extensionReason')} maxLength={500} size="small" optionalLabel />
            <Button type="submit" variant="outlined">
              {t('extensionSubmit')}
            </Button>
          </ActionForm>
        </Collapsible>
      )}

      {status === 'pending' && paid === 0 && (
        <ActionForm action={cancelEnrollment} confirm={t('cancelConfirm')} confirmTitle={t('cancelEnrollment')} confirmLabel={t('cancelEnrollment')} danger>
          <input type="hidden" name="id" value={enrollmentId} />
          <Button type="submit" size="small" color="error">
            {t('cancelEnrollment')}
          </Button>
        </ActionForm>
      )}
    </Box>
  );
}
