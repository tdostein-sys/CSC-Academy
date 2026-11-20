'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CalendarCheck } from 'lucide-react';
import { FormMessage, SubmitButton, TextAreaField } from '@/components/forms/fields';
import { useFormSubmit } from '@/components/forms/use-validated-action';
import type { FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

export interface SlotDay {
  day: string;
  label: string;
  slots: { iso: string; time: string }[];
}

/**
 * Choix d'un créneau : jours disponibles, puis heures libres du jour.
 * Les créneaux viennent de la base (consulting_available_slots) ; la base
 * revérifie le créneau à l'envoi (jamais deux réservations du même créneau).
 */
export function SlotPicker({
  days,
  action,
  hidden,
  submitLabel,
  withMessage = false,
  timezoneNote,
}: {
  days: SlotDay[];
  action: ServerAction;
  hidden: Record<string, string>;
  submitLabel: string;
  withMessage?: boolean;
  timezoneNote: string;
}) {
  const t = useTranslations('consulting.picker');
  const { state, submit, pending } = useFormSubmit(action);
  const [dayIndex, setDayIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const day = days[dayIndex];

  if (days.length === 0) {
    return <Typography sx={{ color: 'text.secondary' }}>{t('none')}</Typography>;
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="starts_at" value={chosen ?? ''} />

        <Box>
          <Typography id="slot-days" variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            {t('chooseDay')}
          </Typography>
          <Box role="group" aria-labelledby="slot-days" sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
            {days.map((d, i) => (
              <Button
                key={d.day}
                type="button"
                size="small"
                variant={i === dayIndex ? 'contained' : 'outlined'}
                aria-pressed={i === dayIndex}
                onClick={() => {
                  setDayIndex(i);
                  setChosen(null);
                }}
                sx={{ flexShrink: 0, flexDirection: 'column', lineHeight: 1.3, py: 1.5, minWidth: 96 }}
              >
                <span>{d.label}</span>
                <Typography component="span" variant="caption" sx={{ color: 'inherit', opacity: 0.85 }}>
                  {t('slotsCount', { count: d.slots.length })}
                </Typography>
              </Button>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography id="slot-times" variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            {t('chooseTime', { day: day.label })}
          </Typography>
          <Box role="radiogroup" aria-labelledby="slot-times" sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
            {day.slots.map((s) => (
              <Button
                key={s.iso}
                type="button"
                role="radio"
                aria-checked={chosen === s.iso}
                variant={chosen === s.iso ? 'contained' : 'outlined'}
                color={chosen === s.iso ? 'primary' : 'secondary'}
                onClick={() => setChosen(s.iso)}
              >
                {s.time}
              </Button>
            ))}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            {timezoneNote}
          </Typography>
          {state.fieldErrors?.starts_at && (
            <Typography variant="body2" role="alert" sx={{ mt: 1, color: 'error.main' }}>
              {t('slotRequired')}
            </Typography>
          )}
        </Box>

        {withMessage && (
          <TextAreaField name="message" label={t('message')} hint={t('messageHint')} maxLength={2000} minRows={3} monospace={false} error={state.fieldErrors?.message} />
        )}

        <Box>
          <SubmitButton pending={pending} fullWidth={false} startIcon={<CalendarCheck aria-hidden size={18} />}>
            {chosen ? submitLabel : t('pickFirst')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
