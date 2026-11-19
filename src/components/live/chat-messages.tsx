'use client';

import { forwardRef } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

export interface ChatItem {
  id: string;
  author: string;
  /** Heure déjà mise en forme (ex. « 14:05 »). */
  time: string;
  /** Heure au format machine, pour la balise <time>. */
  dateTime: string;
  text: string;
  mine: boolean;
  host: boolean;
}

export interface ChatLabels {
  title: string;
  empty: string;
  host: string;
  you: string;
}

/** Marge (px) en dessous de laquelle on considère que l'utilisateur lit le bas du chat. */
export const STICK_THRESHOLD = 48;

/** L'utilisateur est-il (presque) en bas de la liste ? Sinon, il relit l'historique. */
export function isNearBottom(el: { scrollTop: number; scrollHeight: number; clientHeight: number }, threshold = STICK_THRESHOLD) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * Liste des messages du chat : une carte par message (auteur, heure, texte).
 * Mes messages sont à droite et colorés ; ceux du formateur portent un badge.
 */
export const ChatMessageList = forwardRef<HTMLDivElement, { items: ChatItem[]; labels: ChatLabels; onScroll?: () => void }>(function ChatMessageList(
  { items, labels, onScroll },
  ref,
) {
  return (
    <Box
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label={labels.title}
      onScroll={onScroll}
      sx={{ flex: 1, minHeight: 200, overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {items.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {labels.empty}
        </Typography>
      )}
      {items.map((m) => (
        <ChatBubble key={m.id} item={m} labels={labels} />
      ))}
    </Box>
  );
});

export function ChatBubble({ item, labels }: { item: ChatItem; labels: ChatLabels }) {
  const { mine, host } = item;
  return (
    <Box
      component="article"
      data-mine={mine ? 'true' : undefined}
      data-host={host ? 'true' : undefined}
      aria-label={`${item.author}${host ? ` (${labels.host})` : ''}, ${item.time}`}
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        minWidth: 0,
        px: 2.5,
        py: 1.5,
        borderRadius: 2,
        borderTopRightRadius: mine ? 4 : undefined,
        borderTopLeftRadius: mine ? undefined : 4,
        border: 1,
        borderColor: mine || host ? 'primary.main' : 'divider',
        borderLeftWidth: host && !mine ? 4 : 1,
        bgcolor: mine ? 'primary.main' : 'background.default',
        color: mine ? 'primary.contrastText' : 'text.primary',
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, mb: 0.5 }}>
        <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: 'inherit', overflowWrap: 'anywhere' }}>
          {mine ? `${item.author} (${labels.you})` : item.author}
        </Typography>
        {host && (
          <Chip
            size="small"
            label={labels.host}
            color={mine ? 'default' : 'primary'}
            sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, ...(mine ? { bgcolor: 'background.paper', color: 'text.primary' } : {}) }}
          />
        )}
        <Typography component="time" dateTime={item.dateTime} variant="caption" sx={{ color: mine ? 'inherit' : 'text.secondary', ml: 'auto' }}>
          {item.time}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {item.text}
      </Typography>
    </Box>
  );
}
