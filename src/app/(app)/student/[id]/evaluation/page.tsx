import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, Send } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { Markdown } from '@/components/markdown';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { localized } from '@/lib/localized';
import { academyErrorKey } from '@/lib/academy/errors';
import { UUID, num, type Evaluation, type Paper } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { submitEvaluation } from '../../../academy/actions';

export const metadata: Metadata = { title: 'Évaluation finale' };

/**
 * Questionnaire de l'évaluation finale. Le contenu vient de
 * academy_evaluation_paper() : jamais les bonnes réponses. La correction est
 * faite par la base à l'envoi.
 */
export default async function StudentEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('/student');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, tr, locale, supabase] = await Promise.all([getTranslations('student'), getTranslations(), getLocale(), createClient()]);
  const l = locale as Locale;

  const { data: e } = await supabase.from('academy_enrollments').select('id, session_id').eq('id', id).eq('student_id', user.id).maybeSingle();
  if (!e) notFound();

  const [evalRes, paperRes, attemptsRes] = await Promise.all([
    supabase.from('academy_evaluations').select('*').eq('session_id', e.session_id).maybeSingle(),
    supabase.rpc('academy_evaluation_paper', { p_session: e.session_id }),
    supabase.from('academy_evaluation_attempts').select('passed').eq('enrollment_id', id),
  ]);
  const evaluation = evalRes.data as Evaluation | null;
  if (!evaluation) notFound();
  const paper = paperRes.data as Paper | null;
  const attempts = (attemptsRes.data ?? []) as { passed: boolean }[];
  const left = num(evaluation.max_attempts) - attempts.length;
  const passed = attempts.some((a) => a.passed);

  const back = (
    <LinkButton href={`/student/${id}`} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
      {t('evaluation.back')}
    </LinkButton>
  );

  // Accès refusé (bloqué, évaluation fermée…) ou plus de tentative : message clair, sans détail technique.
  const unavailable = paperRes.error ? academyErrorKey(paperRes.error) : passed ? 'academy.errors.evaluation_already_passed' : left <= 0 ? 'academy.errors.attempts_exhausted' : null;
  if (unavailable || !paper) {
    return (
      <Box sx={{ maxWidth: 760 }}>
        {back}
        <Notice tone="warning">{tr.has(unavailable ?? '') ? tr(unavailable as never) : tr('errors.generic')}</Notice>
      </Box>
    );
  }

  const instructions = localized(l, evaluation.instructions_fr, evaluation.instructions_en);

  return (
    <Box sx={{ maxWidth: 760 }}>
      {back}
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {localized(l, evaluation.title_fr, evaluation.title_en)}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 4, color: 'text.secondary' }}>
        {t('evaluation.rules', { mark: num(evaluation.pass_mark), attempts: num(evaluation.max_attempts) })} · {t('evaluation.attemptsLeft', { count: left })}
      </Typography>
      {instructions.trim() && (
        <Box sx={{ mb: 4 }}>
          <Markdown source={instructions} />
        </Box>
      )}

      <ActionForm
        action={submitEvaluation}
        confirm={t('evaluation.submitConfirm')}
        confirmTitle={t('evaluation.submit')}
        confirmLabel={t('evaluation.submit')}
      >
        <input type="hidden" name="enrollment_id" value={id} />
        <Stack spacing={4} component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {paper.questions.map((q) => {
            const legendId = `q-${q.id}`;
            return (
              <Card component="li" key={q.id}>
                <CardContent>
                  <Box component="fieldset" aria-labelledby={legendId} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
                    <Typography id={legendId} component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                      {q.position}. {localized(l, q.prompt_fr, q.prompt_en)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
                      {q.multiple ? t('evaluation.multipleHint') : t('evaluation.singleHint')} · {t('evaluation.points', { count: q.points })}
                    </Typography>
                    <Stack spacing={1}>
                      {q.choices.map((c, i) => (
                        <Box
                          component="label"
                          key={i}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            p: 2,
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider',
                            cursor: 'pointer',
                            '&:has(input:checked)': { borderColor: 'primary.main', bgcolor: 'action.selected' },
                            '&:has(input:focus-visible)': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
                          }}
                        >
                          <Box
                            component="input"
                            type={q.multiple ? 'checkbox' : 'radio'}
                            name={`q_${q.id}`}
                            value={String(i)}
                            required={!q.multiple}
                            sx={{ mt: '3px', width: 18, height: 18, flexShrink: 0, accentColor: 'var(--mui-palette-primary-main, #1d5fd6)' }}
                          />
                          <Typography component="span" variant="body2">
                            {localized(l, c.label_fr, c.label_en)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
        <Box sx={{ mt: 6 }}>
          <Button type="submit" variant="contained" size="large" startIcon={<Send aria-hidden size={18} />}>
            {t('evaluation.submit')}
          </Button>
        </Box>
      </ActionForm>
    </Box>
  );
}
