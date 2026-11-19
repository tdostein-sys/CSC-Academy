import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/status-badge';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, SubmitButton, TextField } from '@/components/forms/fields';
import { formatDate } from '@/lib/format';
import { isPast, type Advisor, type AvailabilityRule } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { addAdvisor, addAvailability, addUnavailability, removeAvailability, removeUnavailability, setAdvisorStatus } from '../actions';

export const metadata: Metadata = { title: 'Disponibilités — CSC Consulting' };
export const dynamic = 'force-dynamic';

interface UnavailabilityRow {
  id: string;
  advisor_id: string;
  period: string;
  reason: string;
}

/** « ["2027-01-10 08:00:00+00","2027-01-12 18:00:00+00") » → bornes ISO. */
function parseRange(range: string): [string, string] {
  const [a, b] = range.replace(/^[[(]|[\])]$/g, '').split(',').map((s) => s.trim().replace(/"/g, ''));
  return [new Date(a.replace(' ', 'T')).toISOString(), new Date(b.replace(' ', 'T')).toISOString()];
}

/** Conseillers, créneaux habituels (heure du Cameroun) et indisponibilités. */
export default async function AvailabilityPage() {
  await requireAdmin();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminConsulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const [{ data: advisorsData }, { data: rulesData }, { data: unavData }] = await Promise.all([
    supabase.from('consulting_advisors').select('user_id, display_name, active').order('display_name'),
    supabase.from('consulting_availability').select('id, advisor_id, weekday, start_time, end_time').order('weekday').order('start_time'),
    supabase.from('consulting_unavailabilities').select('id, advisor_id, period, reason').order('created_at', { ascending: false }).limit(100),
  ]);
  const advisors = (advisorsData ?? []) as Advisor[];
  const rules = (rulesData ?? []) as AvailabilityRule[];
  const unavailabilities = ((unavData ?? []) as UnavailabilityRow[])
    .map((u) => ({ ...u, range: parseRange(u.period) }))
    .filter((u) => !isPast(u.range[1]));
  const active = advisors.filter((a) => a.active);
  const advisorOptions = active.map((a) => ({ value: a.user_id, label: a.display_name }));
  const weekdays = [1, 2, 3, 4, 5, 6, 7];
  const hm = (v: string) => v.slice(0, 5);

  return (
    <>
      <PageHeader title={t('availability.title')} subtitle={t('availability.subtitle')} />
      <Stack spacing={6}>
        {/* Conseillers */}
        <SectionCard id="advisors" title={t('advisors.title')} subtitle={t('advisors.subtitle')}>
          <Stack spacing={4}>
            {advisors.length > 0 && (
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
                {advisors.map((a) => (
                  <Box component="li" key={a.user_id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
                    <Typography sx={{ fontWeight: 600 }}>{a.display_name}</Typography>
                    <StatusBadge tone={a.active ? 'active' : 'neutral'}>{a.active ? t('advisors.active') : t('advisors.inactive')}</StatusBadge>
                    <ActionForm action={setAdvisorStatus} confirm={a.active ? t('advisors.deactivateConfirm') : undefined}>
                      <input type="hidden" name="user_id" value={a.user_id} />
                      <input type="hidden" name="display_name" value={a.display_name} />
                      <input type="hidden" name="active" value={a.active ? '0' : '1'} />
                      <SubmitButton pending={false} fullWidth={false} size="small" variant="text">
                        {a.active ? t('advisors.deactivate') : t('advisors.activate')}
                      </SubmitButton>
                    </ActionForm>
                  </Box>
                ))}
              </Box>
            )}
            <ActionForm action={addAdvisor} resetOnSuccess>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ flex: '1 1 240px', maxWidth: 320 }}>
                  <TextField name="email" type="email" label={t('advisors.email')} hint={t('advisors.emailHint')} required size="small" />
                </Box>
                <Box sx={{ flex: '1 1 200px', maxWidth: 280 }}>
                  <TextField name="display_name" label={t('advisors.displayName')} hint={t('advisors.displayNameHint')} required maxLength={120} size="small" />
                </Box>
                <SubmitButton pending={false} fullWidth={false} size="medium" variant="outlined">
                  {t('advisors.add')}
                </SubmitButton>
              </Box>
            </ActionForm>
          </Stack>
        </SectionCard>

        {/* Créneaux habituels */}
        {active.length > 0 && (
          <SectionCard id="rules" title={t('availability.rulesTitle')} subtitle={t('availability.rulesHint')}>
            <Stack spacing={5}>
              {active.map((a) => {
                const mine = rules.filter((r) => r.advisor_id === a.user_id);
                return (
                  <Box key={a.user_id}>
                    <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 2 }}>
                      {a.display_name}
                    </Typography>
                    {mine.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('availability.noRules')}
                      </Typography>
                    ) : (
                      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
                        {mine.map((r) => (
                          <Box component="li" key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ minWidth: 200 }}>
                              {t(`weekday.${r.weekday}`)} · {hm(r.start_time)} – {hm(r.end_time)}
                            </Typography>
                            <ActionForm action={removeAvailability}>
                              <input type="hidden" name="id" value={r.id} />
                              <SubmitButton pending={false} fullWidth={false} size="small" variant="text" color="error" startIcon={<Trash2 aria-hidden size={14} />}>
                                {t('availability.remove')}
                              </SubmitButton>
                            </ActionForm>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
              <ActionForm action={addAvailability}>
                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '2fr 2fr 1fr 1fr auto' }, alignItems: 'start' }}>
                  <SelectField name="advisor_id" label={t('availability.advisor')} options={advisorOptions} size="small" />
                  <SelectField name="weekday" label={t('availability.weekday')} options={weekdays.map((d) => ({ value: String(d), label: t(`weekday.${d}`) }))} size="small" />
                  <TextField name="start_time" type="time" label={t('availability.start')} defaultValue="09:00" size="small" required />
                  <TextField name="end_time" type="time" label={t('availability.end')} defaultValue="17:00" size="small" required />
                  <SubmitButton pending={false} fullWidth={false} size="medium" variant="outlined">
                    {t('availability.add')}
                  </SubmitButton>
                </Box>
              </ActionForm>
            </Stack>
          </SectionCard>
        )}

        {/* Indisponibilités */}
        {active.length > 0 && (
          <SectionCard id="unavailabilities" title={t('availability.unavailabilityTitle')} subtitle={t('availability.unavailabilityHint')}>
            <Stack spacing={4}>
              {unavailabilities.length > 0 && (
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
                  {unavailabilities.map((u) => (
                    <Box component="li" key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="body2">
                        <strong>{advisors.find((a) => a.user_id === u.advisor_id)?.display_name ?? '—'}</strong> · {formatDate(u.range[0], l, true)} → {formatDate(u.range[1], l, true)}
                        {u.reason ? ` · ${u.reason}` : ''}
                      </Typography>
                      <ActionForm action={removeUnavailability}>
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitButton pending={false} fullWidth={false} size="small" variant="text" color="error" startIcon={<Trash2 aria-hidden size={14} />}>
                          {t('availability.remove')}
                        </SubmitButton>
                      </ActionForm>
                    </Box>
                  ))}
                </Box>
              )}
              <ActionForm action={addUnavailability} resetOnSuccess>
                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '2fr 2fr 2fr 2fr auto' }, alignItems: 'start' }}>
                  <SelectField name="advisor_id" label={t('availability.advisor')} options={advisorOptions} size="small" />
                  <TextField name="starts_at" type="datetime-local" label={t('availability.from')} size="small" required />
                  <TextField name="ends_at" type="datetime-local" label={t('availability.to')} size="small" required />
                  <TextField name="reason" label={t('availability.reason')} maxLength={300} size="small" />
                  <SubmitButton pending={false} fullWidth={false} size="medium" variant="outlined">
                    {t('availability.add')}
                  </SubmitButton>
                </Box>
              </ActionForm>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('availability.existingKept')}
              </Typography>
            </Stack>
          </SectionCard>
        )}
      </Stack>
    </>
  );
}
