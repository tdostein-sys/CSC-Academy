import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';

export interface GoalView {
  label: string;
  actual: string;
  target: string;
  percent: number;
  expected: number;
  status: 'reached' | 'on_track' | 'behind';
  statusLabel: string;
}

const TONE = { reached: 'success', on_track: 'primary', behind: 'warning' } as const;
const ICON = { reached: CheckCircle2, on_track: TrendingUp, behind: Clock };

/**
 * Jauge d'objectif du mois : remplissage = réalisé / objectif ; repère
 * vertical = rythme attendu à cette date du mois. L'état est écrit en
 * toutes lettres avec une icône (jamais par la couleur seule).
 */
export function GoalMeter({ goal, expectedLabel }: { goal: GoalView; expectedLabel: string }) {
  const tone = TONE[goal.status];
  const Icon = ICON[goal.status];
  const fill = Math.min(goal.percent, 100);
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {goal.label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {goal.actual}
          </Box>{' '}
          / {goal.target}
        </Typography>
      </Box>
      <Box
        role="meter"
        aria-label={goal.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
        aria-valuetext={`${goal.percent} % — ${goal.statusLabel}`}
        sx={{ position: 'relative', height: 8, borderRadius: 999, bgcolor: `${tone}.main`, overflow: 'visible' }}
      >
        {/* Piste : teinte claire de la même couleur */}
        <Box sx={(t) => ({ position: 'absolute', inset: 0, borderRadius: 999, bgcolor: t.palette.background.paper, opacity: 0.75 })} />
        <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, borderRadius: 999, bgcolor: `${tone}.main` }} />
        {goal.status !== 'reached' && (
          <Box
            title={expectedLabel}
            sx={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${Math.min(goal.expected, 100)}% - 1px)`, width: 2, borderRadius: 1, bgcolor: 'text.primary', opacity: 0.6 }}
          />
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, color: `${tone}.main` }}>
        <Icon aria-hidden size={14} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {goal.percent} % · {goal.statusLabel}
        </Typography>
      </Box>
    </Box>
  );
}
