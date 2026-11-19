import Button from '@mui/material/Button';
import { CheckCircle2, PlayCircle, RotateCw } from 'lucide-react';
import { ActionForm } from '@/components/forms/action-form';
import { LinkButton } from '@/components/ui/links';
import { startReplay } from './actions';

export interface ReplayActionLabels {
  watch: string;
  resume: string;
  watched: string;
  confirm: string;
  confirmTitle: string;
}

/**
 * Bouton d'un replay selon mon visionnage :
 *  - jamais lancé → « Regarder » (confirmation : visionnage unique) ;
 *  - en cours → « Reprendre » (rouvre le même visionnage) ;
 *  - délai écoulé → « Déjà visionné », inactif.
 */
export function ReplayAction({ recordingId, state, labels, size = 'medium' }: {
  recordingId: string;
  state: 'available' | 'active' | 'watched';
  labels: ReplayActionLabels;
  size?: 'small' | 'medium';
}) {
  if (state === 'active') {
    return (
      <LinkButton href={`/student/replays/${recordingId}`} size={size} variant="contained" startIcon={<RotateCw aria-hidden size={18} />}>
        {labels.resume}
      </LinkButton>
    );
  }
  if (state === 'watched') {
    return (
      <Button size={size} variant="outlined" disabled startIcon={<CheckCircle2 aria-hidden size={18} />}>
        {labels.watched}
      </Button>
    );
  }
  return (
    <ActionForm action={startReplay} confirm={labels.confirm} confirmTitle={labels.confirmTitle} confirmLabel={labels.watch}>
      <input type="hidden" name="id" value={recordingId} />
      <Button type="submit" size={size} variant="outlined" startIcon={<PlayCircle aria-hidden size={18} />}>
        {labels.watch}
      </Button>
    </ActionForm>
  );
}
