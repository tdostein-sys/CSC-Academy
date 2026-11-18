'use client';

import { useTranslations } from 'next-intl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { tok } from '@/@core/theme/tokens';

/**
 * Boîte de confirmation intégrée à l'application (Dialog MUI du template ;
 * remplace window.confirm) : focus piégé, touche Échap, fond assombri.
 */
export function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  /** « danger » pour les actions destructives (suppression, retrait…). */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('common');
  const danger = tone === 'danger';
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', px: 6, pt: 6 }}>
        <Avatar
          sx={(theme) => ({
            bgcolor: tok(theme)[danger ? 'error-soft' : 'primary-soft'],
            color: tok(theme)[danger ? 'error' : 'primary'],
            width: 44,
            height: 44,
          })}
        >
          <Icon aria-hidden size={22} />
        </Avatar>
        <Box>
          <DialogTitle id="confirm-title" sx={{ p: 0, mb: 1 }}>
            {title ?? t('confirmTitle')}
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <DialogContentText id="confirm-message">{message}</DialogContentText>
          </DialogContent>
        </Box>
      </Box>
      <DialogActions sx={{ px: 6, pb: 5, pt: 5, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" color="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} autoFocus>
          {confirmLabel ?? t('confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
