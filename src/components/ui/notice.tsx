'use client';

import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { tok } from '@/@core/theme/tokens';

export type NoticeTone = 'success' | 'error' | 'warning' | 'info';

const ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info } as const;

/**
 * Bandeau d'information (Alert MUI) aux couleurs « douces » CSC, dont le
 * contraste est vérifié par les tests.
 */
export function Notice({
  tone,
  children,
  title,
  action,
  role,
}: {
  tone: NoticeTone;
  children: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  role?: 'status' | 'alert';
}) {
  const Icon = ICONS[tone];
  return (
    <Alert
      severity={tone}
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      icon={<Icon aria-hidden size={20} />}
      action={action}
      sx={(theme) => {
        const c = tok(theme);
        return {
          bgcolor: c[`${tone}-soft`],
          color: c[tone],
          '& .MuiAlert-icon': { color: c[tone] },
          '& .MuiAlert-message': { width: '100%' },
          '& a': { color: c[tone], fontWeight: 600 },
        };
      }}
    >
      {title && <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>}
      {children}
    </Alert>
  );
}
