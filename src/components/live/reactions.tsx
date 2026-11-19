'use client';

import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import { keyframes } from '@mui/material/styles';
import { SmilePlus } from 'lucide-react';
import { REACTIONS, REACTION_LIFETIME_MS, reactionEmoji, type FloatingReaction, type ReactionCode } from '@/lib/academy/reactions';

const floatUp = keyframes`
  0%   { transform: translateY(0) scale(0.6); opacity: 0; }
  12%  { transform: translateY(-12px) scale(1); opacity: 1; }
  75%  { opacity: 1; }
  100% { transform: translateY(-180px) scale(1); opacity: 0; }
`;
const fadeOnly = keyframes`
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
`;

/**
 * Emojis qui montent puis disparaissent par-dessus la vidéo. Purement
 * décoratif (aria-hidden) et sans effet sur les clics (pointer-events: none).
 */
export function ReactionOverlay({ items }: { items: FloatingReaction[] }) {
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {items.map((r) => (
        <Box
          key={r.id}
          data-reaction={r.code}
          sx={{
            position: 'absolute',
            bottom: 40,
            left: `${8 + r.x * 70}%`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            animation: `${floatUp} ${REACTION_LIFETIME_MS}ms ease-out forwards`,
            '@media (prefers-reduced-motion: reduce)': { animation: `${fadeOnly} ${REACTION_LIFETIME_MS}ms linear forwards` },
          }}
        >
          <Box component="span" sx={{ fontSize: { xs: 28, sm: 36 }, lineHeight: 1 }}>
            {reactionEmoji(r.code)}
          </Box>
          <Box
            component="span"
            sx={{ maxWidth: 140, px: 1.5, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {r.name}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export interface ReactionPickerLabels {
  button: string;
  wait: string;
  names: Record<ReactionCode, string>;
}

/** Bouton « Réactions » et sa petite palette d'emojis (clavier : Tab, Entrée, Échap). */
export function ReactionPicker({ onPick, coolingDown, labels }: { onPick: (code: ReactionCode) => void; coolingDown: boolean; labels: ReactionPickerLabels }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<SmilePlus aria-hidden size={18} />}
        aria-haspopup="true"
        aria-expanded={anchor ? 'true' : undefined}
        aria-controls={anchor ? id : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {labels.button}
      </Button>
      <Popover
        id={id}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        <Box role="group" aria-label={labels.button} sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
          {REACTIONS.map((r) => (
            <Tooltip key={r.code} title={coolingDown ? labels.wait : labels.names[r.code]}>
              <span>
                <IconButton
                  aria-label={labels.names[r.code]}
                  disabled={coolingDown}
                  onClick={() => {
                    onPick(r.code);
                    setAnchor(null);
                  }}
                  sx={{ fontSize: 26, width: 48, height: 48 }}
                >
                  <span aria-hidden>{r.emoji}</span>
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Box>
      </Popover>
    </>
  );
}
