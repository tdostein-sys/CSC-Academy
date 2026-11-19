import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { isContactSubject, whatsappLink, type ContactSettings } from '@/lib/contact';
import { localized } from '@/lib/localized';
import type { Locale } from '@/lib/types';
import { ContactForm } from './contact-form';

export const metadata: Metadata = { title: 'Contact' };

interface EnrollmentRow {
  id: string;
  academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } } | null;
}

/**
 * Page Contact, visible de tous : texte d'accueil (éditable), boutons
 * WhatsApp / téléphone / e-mail, et formulaire enregistré dans la base.
 * `?subject=payment&enrollment=<id>` préremplit le formulaire (lien depuis
 * la page d'une formation).
 */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string; enrollment?: string }> }) {
  const [sp, user, t, locale, supabase] = await Promise.all([searchParams, getSessionUser(), getTranslations('contact'), getLocale(), createClient()]);
  const l = locale as Locale;

  const [settingsRes, contentRes, enrollmentsRes] = await Promise.all([
    supabase.from('contact_settings').select('whatsapp, phone, email').maybeSingle(),
    supabase.from('site_content').select('body_fr, body_en').eq('key', 'contact_page').maybeSingle(),
    user
      ? supabase
          .from('academy_enrollments')
          .select('id, academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en))')
          .eq('student_id', user.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const settings = (settingsRes.data ?? { whatsapp: '', phone: '', email: '' }) as ContactSettings;
  const intro = localized(l, contentRes.data?.body_fr, contentRes.data?.body_en);
  const enrollments = ((enrollmentsRes.data ?? []) as unknown as EnrollmentRow[])
    .filter((e) => e.academy_sessions)
    .map((e) => ({
      id: e.id,
      label: `${localized(l, e.academy_sessions!.academy_courses.title_fr, e.academy_sessions!.academy_courses.title_en)} — ${localized(l, e.academy_sessions!.label_fr, e.academy_sessions!.label_en)}`,
    }));

  const subject = isContactSubject(sp.subject) ? sp.subject : 'course';
  const selected = enrollments.find((e) => e.id === sp.enrollment);
  const name = user ? `${user.profile.first_name} ${user.profile.last_name}`.trim() : '';
  const waText =
    subject === 'payment' && selected
      ? t('whatsappPayment', { name: name || '…', course: selected.label })
      : name
        ? t('whatsappHelloNamed', { name })
        : t('whatsappHello');
  const wa = whatsappLink(settings.whatsapp, waText);
  const hasDirect = Boolean(wa || settings.phone || settings.email);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Stack spacing={6} sx={{ maxWidth: 960 }}>
        {intro.trim() && (
          <Card>
            <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
              <Markdown source={intro} />
            </CardContent>
          </Card>
        )}

        {hasDirect && (
          <Grid container spacing={4}>
            {wa && (
              <Grid item xs={12} md={4}>
                <DirectCard icon={<MessageCircle aria-hidden size={22} />} title={t('whatsappTitle')} text={t('whatsappText')}>
                  <Button href={wa} target="_blank" rel="noopener noreferrer" variant="contained" fullWidth startIcon={<MessageCircle aria-hidden size={18} />}>
                    {t('whatsappButton')}
                  </Button>
                </DirectCard>
              </Grid>
            )}
            {settings.phone && (
              <Grid item xs={12} md={4}>
                <DirectCard icon={<Phone aria-hidden size={22} />} title={t('phoneTitle')} text={settings.phone}>
                  <Button href={`tel:${settings.phone}`} variant="outlined" fullWidth startIcon={<Phone aria-hidden size={18} />}>
                    {t('callButton')}
                  </Button>
                </DirectCard>
              </Grid>
            )}
            {settings.email && (
              <Grid item xs={12} md={4}>
                <DirectCard icon={<Mail aria-hidden size={22} />} title={t('emailTitle')} text={settings.email}>
                  <Button href={`mailto:${settings.email}`} variant="outlined" fullWidth startIcon={<Mail aria-hidden size={18} />}>
                    {t('emailButton')}
                  </Button>
                </DirectCard>
              </Grid>
            )}
          </Grid>
        )}

        <SectionCard id="contact-form-title" title={t('formTitle')} subtitle={t('formSubtitle')} highlight={subject === 'payment'}>
          <ContactForm
            defaults={{
              name,
              email: user?.email ?? '',
              phone: user?.profile.phone_whatsapp ?? '',
              subject,
              enrollmentId: selected?.id ?? '',
            }}
            enrollments={enrollments}
          />
        </SectionCard>
      </Stack>
    </>
  );
}

function DirectCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 5, display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'primary.main' }}>
          {icon}
          <Typography variant="h6" component="h2" sx={{ color: 'text.primary' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1, overflowWrap: 'anywhere' }}>
          {text}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
