import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields';
import { localized } from '@/lib/localized';
import { MAX_CHOICES } from '@/lib/validation/academy';
import type { Question } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { saveQuestion } from '../../../actions';

/**
 * Ajout / modification d'une question à choix. Saisie dans la langue de
 * l'interface (l'autre langue est traduite à l'enregistrement). Cocher la ou
 * les bonnes réponses ; la base revérifie tout.
 */
export async function QuestionForm({ sessionId, locale, question }: { sessionId: string; locale: Locale; question?: Question }) {
  const t = await getTranslations('adminAcademy.evaluation');
  const rows = Math.min(MAX_CHOICES, Math.max(6, question?.choices.length ?? 0));
  const key = question?.id ?? 'new';
  return (
    <ActionForm action={saveQuestion} resetOnSuccess={!question} style={{ marginTop: 12, display: 'grid', gap: 12, maxWidth: 680 }}>
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="id" value={question?.id ?? ''} />
      <input type="hidden" name="source_locale" value={locale} />
      <TextAreaField
        name="prompt"
        label={t('prompt')}
        required
        maxLength={1000}
        minRows={2}
        monospace={false}
        defaultValue={question ? localized(locale, question.prompt_fr, question.prompt_en) : ''}
      />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
        <SelectField
          name="multiple"
          label={t('kind')}
          size="small"
          defaultValue={question?.multiple ? '1' : '0'}
          options={[
            { value: '0', label: t('single') },
            { value: '1', label: t('multiple') },
          ]}
        />
        <TextField name="points" label={t('pointsLabel')} inputMode="numeric" defaultValue={String(question?.points ?? 1)} required size="small" />
      </Box>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Typography component="legend" variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {t('choices')}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
          {t('choicesHint')}
        </Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          {Array.from({ length: rows }, (_, i) => {
            const c = question?.choices[i];
            const n = i + 1;
            return (
              <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  component="label"
                  htmlFor={`correct-${key}-${n}`}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  <Box
                    component="input"
                    id={`correct-${key}-${n}`}
                    type="checkbox"
                    name={`correct_${n}`}
                    defaultChecked={Boolean(c?.correct)}
                    sx={{ width: 18, height: 18, accentColor: 'var(--mui-palette-success-main, #15803d)' }}
                  />
                  <span>{t('correct')}</span>
                </Box>
                <TextField
                  name={`choice_${n}`}
                  label={t('choice', { n })}
                  maxLength={300}
                  size="small"
                  defaultValue={c ? localized(locale, c.label_fr, c.label_en) : ''}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box>
        <Button type="submit" variant="contained">
          {question ? t('saveQuestion') : t('addQuestion')}
        </Button>
      </Box>
    </ActionForm>
  );
}
