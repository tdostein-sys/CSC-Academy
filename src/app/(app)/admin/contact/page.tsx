import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields';
import { PageHeader } from '@/components/page-header';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { LinkButton, TextLink } from '@/components/ui/links';
import { SectionCard } from '@/components/ui/section-card';
import { CONTACT_STATUSES, whatsappLink, type ContactSettings, type ContactStatus, type ContactSubject } from '@/lib/contact';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import type { Locale } from '@/lib/types';
import { updateContactRequest, updateContactSettings } from './actions';

export const metadata: Metadata = { title: 'Messages' };

interface RequestRow {
  id: string;
  created_at: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject;
  message: string;
  status: ContactStatus;
  admin_note: string;
  handled_at: string | null;
  enrollment_id: string | null;
  academy_enrollments: {
    session_id: string;
    academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } } | null;
  } | null;
}

const FILTERS = ['open', 'done', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TONE: Record<ContactStatus, BadgeTone> = { new: 'pending', in_progress: 'info', done: 'validated' };
const PAGE_SIZE = 100;

/** Boîte de réception des messages envoyés depuis la page Contact. */
export default async function AdminContactPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const [sp, t, locale, supabase] = await Promise.all([searchParams, getTranslations('adminContact'), getLocale(), createClient()]);
  const l = locale as Locale;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.filter ?? '') ? (sp.filter as Filter) : 'open';

  let query = supabase
    .from('contact_requests')
    .select(
      'id, created_at, user_id, name, email, phone, subject, message, status, admin_note, handled_at, enrollment_id, academy_enrollments (session_id, academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en)))',
    )
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (filter === 'open') query = query.in('status', ['new', 'in_progress']);
  if (filter === 'done') query = query.eq('status', 'done');

  const [listRes, settingsRes, openCount] = await Promise.all([
    query,
    supabase.from('contact_settings').select('whatsapp, phone, email').maybeSingle(),
    supabase.from('contact_requests').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
  ]);
  const requests = (listRes.data ?? []) as unknown as RequestRow[];
  const settings = (settingsRes.data ?? { whatsapp: '', phone: '', email: '' }) as ContactSettings;
  const configured = Boolean(settings.whatsapp || settings.phone || settings.email);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle', { count: openCount.count ?? 0 })} />
      <Stack spacing={6}>
        {/* Coordonnées affichées sur la page Contact */}
        <SectionCard id="contact-settings-title" title={t('settingsTitle')} subtitle={configured ? t('settingsHint') : t('settingsEmpty')} highlight={!configured}>
          <ActionForm action={updateContactSettings} style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
            <TextField name="whatsapp" type="tel" label={t('whatsapp')} hint={t('whatsappHint')} defaultValue={settings.whatsapp} optionalLabel inputMode="tel" size="small" />
            <TextField name="phone" type="tel" label={t('phone')} defaultValue={settings.phone} optionalLabel inputMode="tel" size="small" />
            <TextField name="email" type="email" label={t('email')} defaultValue={settings.email} optionalLabel inputMode="email" size="small" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('textHint')} <TextLink href="/admin/content">{t('textLink')}</TextLink>
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Button type="submit" variant="contained">
                {t('settingsSave')}
              </Button>
              <LinkButton href="/contact" variant="text" endIcon={<ExternalLink aria-hidden size={14} />}>
                {t('viewPage')}
              </LinkButton>
            </Box>
          </ActionForm>
        </SectionCard>

        {/* Filtres */}
        <Box component="nav" aria-label={t('filtersLabel')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {FILTERS.map((f) => (
            <LinkButton
              key={f}
              href={f === 'open' ? '/admin/contact' : `/admin/contact?filter=${f}`}
              variant={f === filter ? 'contained' : 'outlined'}
              size="small"
              aria-current={f === filter ? 'page' : undefined}
            >
              {t(`filters.${f}`)}
            </LinkButton>
          ))}
        </Box>

        {requests.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>{t('empty')}</Typography>
        ) : (
          <Stack component="ul" spacing={4} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {requests.map((r) => {
              const s = r.academy_enrollments?.academy_sessions;
              const wa = whatsappLink(r.phone, t('replyWhatsappText', { name: r.name }));
              return (
                <Card component="li" key={r.id} sx={{ borderLeft: 4, borderColor: r.status === 'new' ? 'warning.main' : 'transparent' }}>
                  <CardContent sx={{ p: { xs: 4, sm: 5 }, display: 'grid', gap: 3 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                      <StatusBadge tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</StatusBadge>
                      <StatusBadge tone={r.subject === 'payment' ? 'primary' : 'neutral'}>{t(`subjects.${r.subject}`)}</StatusBadge>
                      <Typography variant="body2" sx={{ color: 'text.secondary', ml: { sm: 'auto' } }}>
                        {formatDate(r.created_at, l, true)}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {r.name}
                        {!r.user_id && (
                          <Typography component="span" variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                            {t('visitor')}
                          </Typography>
                        )}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 4, rowGap: 1, mt: 1 }}>
                        <TextLink href={`mailto:${r.email}`} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                          {r.email}
                        </TextLink>
                        {r.phone && (
                          <TextLink href={`tel:${r.phone}`} variant="body2">
                            {r.phone}
                          </TextLink>
                        )}
                      </Box>
                      {s && r.academy_enrollments && (
                        <TextLink href={`/admin/academy/sessions/${r.academy_enrollments.session_id}`} variant="body2" sx={{ display: 'inline-block', mt: 1 }}>
                          {t('enrollmentLink', {
                            course: localized(l, s.academy_courses.title_fr, s.academy_courses.title_en),
                            session: localized(l, s.label_fr, s.label_en),
                          })}
                        </TextLink>
                      )}
                    </Box>

                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', p: 3, borderRadius: 1, bgcolor: 'background.default' }}>
                      {r.message}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {wa && (
                        <Button href={wa} target="_blank" rel="noopener noreferrer" size="small" variant="contained" startIcon={<MessageCircle aria-hidden size={16} />}>
                          {t('replyWhatsapp')}
                        </Button>
                      )}
                      <Button
                        href={`mailto:${r.email}?subject=${encodeURIComponent(t('replySubject'))}`}
                        size="small"
                        variant="outlined"
                        startIcon={<Mail aria-hidden size={16} />}
                      >
                        {t('replyEmail')}
                      </Button>
                      {r.phone && (
                        <Button href={`tel:${r.phone}`} size="small" variant="outlined" startIcon={<Phone aria-hidden size={16} />}>
                          {t('call')}
                        </Button>
                      )}
                    </Box>

                    <Collapsible kind="link" summary={r.admin_note ? t('followUpWithNote') : t('followUp')}>
                      <ActionForm action={updateContactRequest} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
                        <input type="hidden" name="id" value={r.id} />
                        <SelectField
                          name="status"
                          label={t('statusLabel')}
                          size="small"
                          defaultValue={r.status}
                          options={CONTACT_STATUSES.map((st) => ({ value: st, label: t(`status.${st}`) }))}
                        />
                        <TextAreaField name="admin_note" label={t('note')} hint={t('noteHint')} defaultValue={r.admin_note} maxLength={1000} minRows={2} monospace={false} />
                        <Box>
                          <Button type="submit" variant="contained" size="small">
                            {t('save')}
                          </Button>
                        </Box>
                      </ActionForm>
                    </Collapsible>
                    {r.handled_at && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {t('handledAt', { date: formatDate(r.handled_at, l, true) })}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
        {requests.length === PAGE_SIZE && <Typography variant="caption">{t('limitNotice', { count: PAGE_SIZE })}</Typography>}
      </Stack>
    </>
  );
}
