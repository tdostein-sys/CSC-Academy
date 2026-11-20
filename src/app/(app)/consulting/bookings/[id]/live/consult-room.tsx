'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoTrack, isTrackReference, useChat, useConnectionState, useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { ConnectionState, MediaDeviceFailure, Track } from 'livekit-client';
import Box from '@mui/material/Box';
import { tok } from '@/@core/theme/tokens';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { LogOut, Mic, MicOff, MonitorUp, PhoneOff, Send, Video, VideoOff, WifiOff } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Notice } from '@/components/ui/notice';
import { ChatMessageList, isNearBottom, type ChatItem } from '@/components/live/chat-messages';
import { endConsultation, joinConsultation, type ConsultJoinResult } from './actions';

type Connection = Extract<ConsultJoinResult, { ok: true }>;

function deviceMessageKey(error?: unknown, failure?: MediaDeviceFailure): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'deviceInsecure';
  const f = failure ?? MediaDeviceFailure.getFailure(error);
  if (f === MediaDeviceFailure.PermissionDenied) return 'devicePermission';
  if (f === MediaDeviceFailure.NotFound) return 'deviceMissing';
  if (f === MediaDeviceFailure.DeviceInUse) return 'deviceBusy';
  return 'deviceFailure';
}

/**
 * Salle de consultation en tête-à-tête (CSC Consulting). Le jeton est émis
 * par le serveur après vérification par la base ; aucun enregistrement.
 */
export function ConsultRoom({ bookingId, endLabel }: { bookingId: string; endLabel: string }) {
  const t = useTranslations('consulting.live');
  const tr = useTranslations();
  const router = useRouter();
  const [conn, setConn] = useState<Connection | null>(null);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const join = () =>
    startTransition(async () => {
      setError(null);
      setDeviceNotice(null);
      const r = await joinConsultation(bookingId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLeft(false);
      setConn(r);
    });

  const onDisconnected = useCallback(() => {
    setConn(null);
    setLeft(true);
    router.refresh();
  }, [router]);

  if (conn) {
    return (
      <LiveKitRoom
        serverUrl={conn.serverUrl}
        token={conn.token}
        connect
        audio
        video
        options={{ adaptiveStream: true, dynacast: true }}
        onDisconnected={onDisconnected}
        onMediaDeviceFailure={(failure) => setDeviceNotice(t(deviceMessageKey(undefined, failure)))}
        style={{ display: 'contents' }}
      >
        <Stage bookingId={bookingId} isHost={conn.isHost} endLabel={endLabel} deviceNotice={deviceNotice} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, display: 'grid', gap: 4, justifyItems: 'start' }}>
      {left && <Notice tone="info">{t('leftNotice')}</Notice>}
      {error && <Notice tone="error">{tr.has(error) ? tr(error) : tr('errors.generic')}</Notice>}
      <Typography>{t('lobby')}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('lobbyHint', { end: endLabel })}
      </Typography>
      <Button variant="contained" size="large" onClick={join} disabled={pending} startIcon={<Video aria-hidden size={20} />}>
        {pending ? t('connecting') : t('join')}
      </Button>
    </Paper>
  );
}

function Stage({ bookingId, isHost, endLabel, deviceNotice }: { bookingId: string; isHost: boolean; endLabel: string; deviceNotice: string | null }) {
  const t = useTranslations('consulting.live');
  const room = useRoomContext();
  const state = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  // Une vignette par participant, même caméra coupée (emplacement réservé).
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const screen = tracks.filter(isTrackReference).find((x) => x.source === Track.Source.ScreenShare);
  const cameras = tracks.filter((x) => x.source === Track.Source.Camera);
  const others = room.remoteParticipants.size;

  const toggle = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setMessage(null);
    } catch (e) {
      setMessage(t(deviceMessageKey(e)));
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Chip size="small" color="error" label={t('liveBadge')} />
          {state === ConnectionState.Reconnecting && <Chip size="small" icon={<WifiOff aria-hidden size={14} />} label={t('reconnecting')} />}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('endAt', { end: endLabel })} · {others === 0 ? t('waitingOther') : t('otherPresent')}
          </Typography>
        </Box>

        {(message ?? deviceNotice) && (
          <Box role="status">
            <Notice tone="warning">{message ?? deviceNotice}</Notice>
          </Box>
        )}

        {screen && (
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', bgcolor: (t) => tok(t).media, borderRadius: 1, overflow: 'hidden' }}>
            <VideoTrack trackRef={screen} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <Typography variant="caption" sx={{ position: 'absolute', left: 8, bottom: 8, px: 2, py: 0.5, borderRadius: 1, bgcolor: (t) => tok(t)['media-label'], color: (t) => tok(t)['on-media'] }}>
              {screen.participant.name} · {t('screen')}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: screen ? 'repeat(2, minmax(0, 220px))' : 'repeat(2, minmax(0, 1fr))' } }}>
          {cameras.map((ref) => (
            <Box key={ref.participant.identity} sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: (t) => tok(t).media, borderRadius: 1, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
              {isTrackReference(ref) && !ref.publication.isMuted ? (
                <VideoTrack trackRef={ref} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: ref.participant.isLocal ? 'scaleX(-1)' : undefined }} />
              ) : (
                <Typography sx={{ color: (t) => tok(t)['on-media'] }}>{t('cameraOffFor', { name: ref.participant.name ?? '' })}</Typography>
              )}
              <Typography variant="caption" sx={{ position: 'absolute', left: 8, bottom: 8, px: 2, py: 0.5, borderRadius: 1, bgcolor: (t) => tok(t)['media-label'], color: (t) => tok(t)['on-media'] }}>
                {ref.participant.name}
                {ref.participant.isLocal ? ` (${t('you')})` : ''}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <ControlButton
            label={isMicrophoneEnabled ? t('micOff') : t('micOn')}
            active={isMicrophoneEnabled}
            onClick={() => toggle(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}
            icon={isMicrophoneEnabled ? <Mic aria-hidden size={20} /> : <MicOff aria-hidden size={20} />}
          />
          <ControlButton
            label={isCameraEnabled ? t('cameraOff') : t('cameraOn')}
            active={isCameraEnabled}
            onClick={() => toggle(() => localParticipant.setCameraEnabled(!isCameraEnabled))}
            icon={isCameraEnabled ? <Video aria-hidden size={20} /> : <VideoOff aria-hidden size={20} />}
          />
          <ControlButton
            label={isScreenShareEnabled ? t('shareOff') : t('shareOn')}
            active={isScreenShareEnabled}
            onClick={() => toggle(() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled))}
            icon={<MonitorUp aria-hidden size={20} />}
          />
          <StartAudio label={t('enableSound')} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid currentColor', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }} />
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" color="secondary" startIcon={<LogOut aria-hidden size={18} />} onClick={() => room.disconnect()}>
            {t('leave')}
          </Button>
          {isHost && (
            <Button variant="contained" color="error" startIcon={<PhoneOff aria-hidden size={18} />} onClick={() => setConfirmEnd(true)} disabled={busy}>
              {t('endForAll')}
            </Button>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('privacy')}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: 360, maxHeight: { lg: 'calc(100vh - 220px)' } }}>
        <Typography variant="subtitle2" component="h2" sx={{ px: 3, py: 2, fontWeight: 700, borderBottom: 1, borderColor: 'divider' }}>
          {t('chat')}
        </Typography>
        <Chat />
      </Paper>

      <ConfirmDialog
        open={confirmEnd}
        title={t('endForAll')}
        message={t('endConfirm')}
        confirmLabel={t('endForAll')}
        tone="danger"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          startTransition(async () => {
            await endConsultation(bookingId);
          });
        }}
      />
    </Box>
  );
}

function ControlButton({ label, active, onClick, icon }: { label: string; active?: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        sx={{
          border: 1,
          borderColor: 'divider',
          bgcolor: active ? 'primary.main' : 'transparent',
          color: active ? 'primary.contrastText' : 'text.primary',
          '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover' },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function Chat() {
  const t = useTranslations('consulting.live');
  const locale = useLocale();
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const timeLocale = locale === 'en' ? 'en-GB' : 'fr-FR';

  const items: ChatItem[] = chatMessages.map((m) => {
    const d = new Date(m.timestamp);
    return {
      id: m.id,
      author: m.from?.name || '—',
      time: d.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
      dateTime: d.toISOString(),
      text: m.message,
      mine: Boolean(m.from?.isLocal),
      host: m.from?.attributes?.role === 'host',
    };
  });
  const count = items.length;

  useEffect(() => {
    const el = listRef.current;
    if (el && count > 0 && stick.current) el.scrollTo({ top: el.scrollHeight });
  }, [count]);

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const v = text.trim().slice(0, 1000);
    if (!v) return;
    try {
      await send(v);
      setText('');
      stick.current = true;
    } catch {
      // Message non envoyé (connexion) : le texte reste dans le champ.
    }
  };

  return (
    <>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ChatMessageList
          ref={listRef}
          items={items}
          onScroll={() => {
            if (listRef.current) stick.current = isNearBottom(listRef.current);
          }}
          labels={{ title: t('chat'), empty: t('chatEmpty'), host: t('advisorBadge'), you: t('you') }}
        />
      </Box>
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 2, p: 3, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          size="small"
          fullWidth
          placeholder={t('chatPlaceholder')}
          inputProps={{ maxLength: 1000, 'aria-label': t('chatPlaceholder') }}
        />
        <IconButton type="submit" color="primary" aria-label={t('send')} disabled={isSending || !text.trim()}>
          <Send aria-hidden size={18} />
        </IconButton>
      </Box>
    </>
  );
}
