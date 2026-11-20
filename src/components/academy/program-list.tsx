import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getTranslations } from 'next-intl/server';
import { Markdown } from '@/components/markdown';
import { SectionCard } from '@/components/ui/section-card';
import { formatDuration, parseProgram } from '@/lib/academy/program';

/**
 * Programme d'une formation : liste numérotée (numéro dans une pastille,
 * titre, durée alignée à droite) avec le total en en-tête. Si le texte saisi
 * n'est pas structuré en chapitres, il est affiché tel quel.
 */
export async function ProgramList({ source, id = 'program-title' }: { source: string; id?: string }) {
  const t = await getTranslations('academy');
  const parsed = parseProgram(source);

  if (!parsed) {
    return (
      <SectionCard id={id} title={t('program')}>
        <Markdown source={source} />
      </SectionCard>
    );
  }

  const summary = [
    t('programChapters', { count: parsed.chapters.length }),
    ...(parsed.totalMinutes ? [formatDuration(parsed.totalMinutes)] : []),
  ].join(' · ');

  return (
    <SectionCard id={id} title={t('program')} action={<Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>{summary}</Typography>}>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {parsed.chapters.map((c, i) => (
          <Box
            component="li"
            key={i}
            sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 2.5, '& + li': { borderTop: 1, borderColor: 'divider' } }}
          >
            <Box
              aria-hidden
              sx={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', border: 1, borderColor: 'divider', fontWeight: 600, fontSize: '0.8125rem', color: 'text.secondary' }}
            >
              {i + 1}
            </Box>
            <Typography sx={{ flex: 1, minWidth: 0 }}>
              <span className="sr-only">{t('programChapterLabel', { n: i + 1 })} </span>
              {c.title}
            </Typography>
            {c.minutes !== null && (
              <Typography variant="body2" sx={{ flex: '0 0 auto', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(c.minutes)}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
}
