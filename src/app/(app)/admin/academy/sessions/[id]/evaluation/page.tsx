import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, Check, Lock, Play, Square, Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { TextAreaField, TextField } from '@/components/forms/fields';
import { StatusBadge } from '@/components/status-badge';
import { StatCard } from '@/components/stat-card';
import { Collapsible } from '@/components/ui/collapsible';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { SectionCard } from '@/components/ui/section-card';
import { TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { UUID, num, type Attempt, type Evaluation, type Question } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { deleteQuestion, saveEvaluation, setEvaluationStatus } from '../../../actions';
import { QuestionForm } from './question-form';

export const metadata: Metadata = { title: 'Évaluation finale' };

interface EnrollmentRow {
  id: string;
  profiles: { first_name: string; last_name: string } | null;
}

/** Évaluation finale d'une session : réglages, questions, ouverture, résultats. */
export default async function AdminEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminAcademy.evaluation'), getLocale(), createClient()]);
  const l = locale as Locale;

  const { data: session } = await supabase.from('academy_sessions').select('id, label_fr, label_en, academy_courses (title_fr, title_en)').eq('id', id).maybeSingle();
  if (!session) notFound();
  const course = (session as unknown as { academy_courses: { title_fr: string; title_en: string } }).academy_courses;

  const [evalRes, questionsRes, attemptsRes, enrollmentsRes, certsRes] = await Promise.all([
    supabase.from('academy_evaluations').select('*').eq('session_id', id).maybeSingle(),
    supabase.from('academy_questions').select('*').eq('session_id', id).order('position'),
    supabase.from('academy_evaluation_attempts').select('id, enrollment_id, attempt_no, score, max_score, percent, passed, submitted_at').eq('session_id', id).order('submitted_at'),
    supabase.from('academy_enrollments').select('id, profiles (first_name, last_name)').eq('session_id', id).eq('status', 'active'),
    supabase.from('academy_certificates').select('enrollment_id, number, revoked_at').eq('session_id', id),
  ]);
  const evaluation = evalRes.data as Evaluation | null;
  const questions = (questionsRes.data ?? []) as Question[];
  const attempts = (attemptsRes.data ?? []) as Attempt[];
  const enrollments = (enrollmentsRes.data ?? []) as unknown as EnrollmentRow[];
  const certs = new Map((certsRes.data ?? []).map((c) => [c.enrollment_id as string, c as { number: string; revoked_at: string | null }]));
  const locked = attempts.length > 0;
  const totalPoints = questions.reduce((a, q) => a + num(q.points), 0);
  const passedCount = new Set(attempts.filter((a) => a.passed).map((a) => a.enrollment_id)).size;

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href={`/admin/academy/sessions/${id}`} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {localized(l, course.title_fr, course.title_en)} — {localized(l, session.label_fr, session.label_en)}
        </LinkButton>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
          <Box>
            {evaluation && <StatusBadge tone={evaluation.status === 'open' ? 'active' : evaluation.status === 'closed' ? 'closed' : 'draft'}>{t(`status.${evaluation.status}`)}</StatusBadge>}
            <Typography variant="h5" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
              {evaluation ? localized(l, evaluation.title_fr, evaluation.title_en) : t('title')}
            </Typography>
          </Box>
          {evaluation && (
            <ActionForm
              action={setEvaluationStatus}
              confirm={evaluation.status === 'open' ? t('closeConfirm') : t('openConfirm')}
              confirmTitle={evaluation.status === 'open' ? t('close') : t('open')}
              confirmLabel={evaluation.status === 'open' ? t('close') : t('open')}
            >
              <input type="hidden" name="session_id" value={id} />
              <input type="hidden" name="status" value={evaluation.status === 'open' ? 'closed' : 'open'} />
              <Button
                type="submit"
                variant={evaluation.status === 'open' ? 'outlined' : 'contained'}
                disabled={evaluation.status !== 'open' && questions.length === 0}
                startIcon={evaluation.status === 'open' ? <Square aria-hidden size={16} /> : <Play aria-hidden size={16} />}
              >
                {evaluation.status === 'open' ? t('close') : t('open')}
              </Button>
            </ActionForm>
          )}
        </Box>
      </Box>

      <Notice tone="info">{t('intro')}</Notice>
      {locked && (
        <Notice tone="warning">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Lock aria-hidden size={16} />
            {t('lockedInfo')}
          </Box>
        </Notice>
      )}

      {evaluation && (
        <Grid container spacing={4}>
          <Grid item xs={6} md={3}>
            <StatCard label={t('questionsCount')} value={String(questions.length)} icon="ListChecks" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label={t('totalPoints')} value={String(totalPoints)} icon="Target" tone="info" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label={t('attemptsCount')} value={String(attempts.length)} icon="ClipboardCheck" tone="warning" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label={t('passedCount')} value={`${passedCount} / ${enrollments.length}`} icon="Award" tone="success" />
          </Grid>
        </Grid>
      )}

      {/* Réglages */}
      <SectionCard id="settings-title" title={t('settings')} subtitle={evaluation ? undefined : t('createHint')}>
        <ActionForm action={saveEvaluation} style={{ display: 'grid', gap: 12, maxWidth: 680 }}>
          <input type="hidden" name="session_id" value={id} />
          <input type="hidden" name="source_locale" value={l} />
          <TextField name="title" label={t('evalTitle')} required maxLength={120} defaultValue={evaluation ? localized(l, evaluation.title_fr, evaluation.title_en) : t('defaultTitle')} />
          <TextAreaField
            name="instructions"
            label={t('instructions')}
            maxLength={2000}
            minRows={3}
            monospace={false}
            defaultValue={evaluation ? localized(l, evaluation.instructions_fr, evaluation.instructions_en) : ''}
          />
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField name="pass_mark" label={t('passMark')} hint={locked ? t('passMarkLocked') : t('passMarkHint')} inputMode="numeric" required defaultValue={String(evaluation?.pass_mark ?? 50)} readOnly={locked} />
            <TextField name="max_attempts" label={t('maxAttempts')} hint={t('maxAttemptsHint')} inputMode="numeric" required defaultValue={String(evaluation?.max_attempts ?? 2)} />
          </Box>
          <Box>
            <Button type="submit" variant="contained">
              {evaluation ? t('saveSettings') : t('create')}
            </Button>
          </Box>
        </ActionForm>
      </SectionCard>

      {/* Questions */}
      {evaluation && (
        <SectionCard id="questions-title" title={t('questions')} subtitle={t('questionsHint')}>
          <Stack spacing={3}>
            {questions.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('noQuestions')}
              </Typography>
            )}
            {questions.map((q) => (
              <Box key={q.id} sx={{ p: 3, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {q.position}. {localized(l, q.prompt_fr, q.prompt_en)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {q.multiple ? t('multiple') : t('single')} · {t('points', { count: num(q.points) })}
                    </Typography>
                  </Box>
                  {!locked && (
                    <ActionForm action={deleteQuestion} confirm={t('deleteConfirm')} confirmTitle={t('delete')} confirmLabel={t('delete')} danger>
                      <input type="hidden" name="id" value={q.id} />
                      <Button type="submit" size="small" color="error" aria-label={`${t('delete')} : ${q.position}`}>
                        <Trash2 aria-hidden size={16} />
                      </Button>
                    </ActionForm>
                  )}
                </Box>
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2, display: 'grid', gap: 1 }}>
                  {q.choices.map((c, i) => (
                    <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, color: c.correct ? 'success.main' : 'text.primary', fontWeight: c.correct ? 600 : 400 }}>
                      {c.correct ? <Check aria-label={t('correct')} size={16} /> : <Box component="span" sx={{ width: 16, flexShrink: 0 }} />}
                      <Typography component="span" variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>
                        {localized(l, c.label_fr, c.label_en)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {!locked && (
                  <Box sx={{ mt: 2 }}>
                    <Collapsible kind="button" summary={t('edit')}>
                      <QuestionForm sessionId={id} locale={l} question={q} />
                    </Collapsible>
                  </Box>
                )}
              </Box>
            ))}
            {!locked && (
              <Collapsible kind="button" summary={t('addQuestion')}>
                <QuestionForm sessionId={id} locale={l} />
              </Collapsible>
            )}
          </Stack>
        </SectionCard>
      )}

      {/* Résultats */}
      {evaluation && enrollments.length > 0 && (
        <TableCard title={t('results')} head={[t('student'), t('attemptsCol'), t('best'), t('result'), t('certificate')]}>
          {enrollments.map((e) => {
            const mine = attempts.filter((a) => a.enrollment_id === e.id);
            const best = mine.reduce<Attempt | null>((acc, a) => (!acc || num(a.percent) > num(acc.percent) ? a : acc), null);
            const cert = certs.get(e.id);
            return (
              <TableRow key={e.id}>
                <TableCell>{e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : '—'}</TableCell>
                <TableCell>
                  {mine.length} / {num(evaluation.max_attempts)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {best ? `${Math.round(num(best.percent))} %` : '—'}
                  {best && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {formatDate(best.submitted_at, l, true)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {best ? (
                    <StatusBadge tone={best.passed ? 'validated' : 'rejected'}>{best.passed ? t('passed') : t('failed')}</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">{t('notTaken')}</StatusBadge>
                  )}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {cert ? (cert.revoked_at ? `${cert.number} (${t('revoked')})` : cert.number) : best?.passed ? t('awaitingPayment') : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
    </Stack>
  );
}
