'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoTrack, useChat, useConnectionState, useDataChannel, useRoomContext, useTracks } from '@livekit/components-react';
import { ConnectionState, MediaDeviceFailure, RoomEvent, Track, type Participant } from 'livekit-client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  ArrowDown,
  Hand,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Video,
  VideoOff,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Notice } from '@/components/ui/notice';
import { ChatMessageList, isNearBottom, type ChatItem } from '@/components/live/chat-messages';
import { ReactionOverlay, ReactionPicker } from '@/components/live/reactions';
import { ATTR_HAND, ATTR_ROLE, accessFromPermission, canPublishSource, type LiveJoinResult } from '@/lib/academy/live-shared';
import {
  REACTIONS,
  REACTION_COOLDOWN_MS,
  REACTION_LIFETIME_MS,
  REACTION_TOPIC,
  ReactionLimiter,
  decodeReaction,
  encodeReaction,
  pushReaction,
  type FloatingReaction,
  type ReactionCode,
} from '@/lib/academy/reactions';
import { closeLive, joinLive, lowerHand, muteEveryone, openLive, raiseHand, setParticipantAccess } from '../actions';

type Connection = Extract<LiveJoinResult, { ok: true }>;

/** Cause précise d'un échec caméra / micro (clé de message). */
function deviceMessageKey(error?: unknown, failure?: MediaDeviceFailure): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'deviceInsecure';
  const f = failure ?? MediaDeviceFailure.getFailure(error);
  if (f === MediaDeviceFailure.PermissionDenied) return 'devicePermission';
  if (f === MediaDeviceFailure.NotFound) return 'deviceMissing';
  if (f === MediaDeviceFailure.DeviceInUse) return 'deviceBusy';
  return 'deviceFailure';
}

interface Props {
  meetingId: string;
  isAdmin: boolean;
  roomOpen: boolean;
  /** Fin prévue, déjà mise en forme par le serveur (heure du Cameroun). */
  endLabel: string;
}

/**
 * Salle de visio CSC Academy. Avant l'entrée : salle d'attente. Dans la
 * salle : vidéo de l'animateur (ou son partage d'écran) en grand, chat,
 * main levée ; l'animateur gère la parole et les caméras des étudiants.
 * Les droits sont imposés par le serveur LiveKit (jeton signé par nous) :
 * l'interface ne fait que les refléter.
 */
export function LiveRoom({ meetingId, isAdmin, roomOpen, endLabel }: Props) {
  const t = useTranslations('academy.live');
  const tr = useTranslations();
  const router = useRouter();
  const [conn, setConn] = useState<Connection | null>(null);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Salle d'attente des étudiants : vérifie toutes les 20 s si l'animateur a ouvert.
  useEffect(() => {
    if (conn || isAdmin || roomOpen) return;
    const id = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(id);
  }, [conn, isAdmin, roomOpen, router]);

  const join = () =>
    startTransition(async () => {
      setError(null);
      setInfo(null);
      setDeviceNotice(null);
      if (isAdmin && !roomOpen) {
        const opened = await openLive(meetingId);
        if (!opened.ok) {
          setError(opened.error);
          return;
        }
        if (opened.recording === 'disabled' || opened.recording === 'failed') setInfo(t('notRecorded'));
      }
      const r = await joinLive(meetingId);
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
        audio={conn.isHost}
        video={conn.isHost}
        options={{ adaptiveStream: true, dynacast: true }}
        onDisconnected={onDisconnected}
        onMediaDeviceFailure={(failure) => setDeviceNotice(t(deviceMessageKey(undefined, failure)))}
        style={{ display: 'contents' }}
      >
        {info && (
          <Box sx={{ mb: 3 }}>
            <Notice tone="warning">{info}</Notice>
          </Box>
        )}
        <Stage meetingId={meetingId} isHost={conn.isHost} endLabel={endLabel} deviceNotice={deviceNotice} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, display: 'grid', gap: 4, justifyItems: 'start' }}>
      {left && <Notice tone="info">{t('leftNotice')}</Notice>}
      {error && <Notice tone="error">{tr(error)}</Notice>}
      {info && <Notice tone="warning">{info}</Notice>}
      {isAdmin ? (
        <Typography>{roomOpen ? t('hostRoomOpen') : t('hostLobby')}</Typography>
      ) : roomOpen ? (
        <Typography>{t('studentReady')}</Typography>
      ) : (
        <Typography>{t('studentWaiting')}</Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('lobbyHint', { end: endLabel })}
      </Typography>
      {(isAdmin || roomOpen) && (
        <Button variant="contained" size="large" onClick={join} disabled={pending} startIcon={<Video aria-hidden size={20} />}>
          {pending ? t('connecting') : isAdmin && !roomOpen ? t('openAndJoin') : t('join')}
        </Button>
      )}
    </Paper>
  );
}

// -----------------------------------------------------------------------------
// Dans la salle
// -----------------------------------------------------------------------------

/** Force un nouveau rendu à chaque changement dans la salle. */
function useRoomVersion() {
  const room = useRoomContext();
  const [, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((v) => v + 1);
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantAttributesChanged,
      RoomEvent.ParticipantPermissionsChanged,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.RecordingStatusChanged,
    ];
    events.forEach((e) => room.on(e, bump));
    return () => {
      events.forEach((e) => room.off(e, bump));
    };
  }, [room]);
  return room;
}

const isHostP = (p: Participant) => p.attributes?.[ATTR_ROLE] === 'host';
const handOf = (p: Participant) => Number(p.attributes?.[ATTR_HAND] || 0);

function Stage({ meetingId, isHost, endLabel, deviceNotice }: { meetingId: string; isHost: boolean; endLabel: string; deviceNotice: string | null }) {
  const t = useTranslations('academy.live');
  const tr = useTranslations();
  const room = useRoomVersion();
  const state = useConnectionState();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  const [audioOnly, setAudioOnly] = useState(false);
  const [tab, setTab] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const local = room.localParticipant;
  const participants: Participant[] = [local, ...room.remoteParticipants.values()];
  const myAccess = accessFromPermission(local.permissions);
  const canMic = canPublishSource(local.permissions, 'microphone');
  const canCam = canPublishSource(local.permissions, 'camera');
  const canShare = isHost && canPublishSource(local.permissions, 'screen_share');
  const handUp = handOf(local) > 0;

  // Prévient l'étudiant quand l'animateur lui donne la parole ou la caméra.
  const { mic: hasMic, camera: hasCam } = myAccess;
  const prev = useRef({ mic: hasMic, camera: hasCam });
  useEffect(() => {
    if (isHost) return;
    const before = prev.current;
    if (hasMic && !before.mic) setMessage(t('micGranted'));
    else if (hasCam && !before.camera) setMessage(t('cameraGranted'));
    else if ((!hasMic && before.mic) || (!hasCam && before.camera)) setMessage(t('accessRemoved'));
    prev.current = { mic: hasMic, camera: hasCam };
  }, [isHost, hasMic, hasCam, t]);

  // Réactions emoji : éphémères, via le canal de données LiveKit.
  const { reactions, react, coolingDown } = useReactions(local.name || '—');
  const reactionLabels = useMemo(
    () => ({
      button: t('reactions'),
      wait: t('reactionWait'),
      names: Object.fromEntries(REACTIONS.map((r) => [r.code, t(`reaction.${r.code}`)])) as Record<ReactionCode, string>,
    }),
    [t],
  );

  const screen = tracks.find((tr0) => tr0.source === Track.Source.ScreenShare);
  const hostCam = tracks.find((tr0) => tr0.source === Track.Source.Camera && isHostP(tr0.participant));
  const main = screen ?? hostCam;
  const others = tracks.filter((tr0) => tr0.source === Track.Source.Camera && tr0 !== main);
  const host = participants.find(isHostP);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok && r.error) setMessage(tr(r.error));
    });

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
        {/* Bandeau d'état */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Chip size="small" color="error" label={t('liveBadge')} />
          {room.isRecording && <Chip size="small" variant="outlined" color="error" label={t('recordingBadge')} />}
          {state === ConnectionState.Reconnecting && <Chip size="small" icon={<WifiOff aria-hidden size={14} />} label={t('reconnecting')} />}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('endAt', { end: endLabel })} · {t('participantsCount', { count: participants.length })}
          </Typography>
        </Box>

        {(message ?? deviceNotice) && (
          <Box role="status">
            <Notice tone={message ? 'info' : 'warning'}>{message ?? deviceNotice}</Notice>
          </Box>
        )}

        {/* Image principale : partage d'écran, sinon caméra de l'animateur */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            bgcolor: '#111418',
            borderRadius: 1,
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {main && !audioOnly ? (
            <VideoTrack trackRef={main} style={{ width: '100%', height: '100%', objectFit: main.source === Track.Source.ScreenShare ? 'contain' : 'cover' }} />
          ) : (
            <Typography sx={{ color: '#E8EAED', px: 4, textAlign: 'center' }}>
              {audioOnly ? t('audioOnlyOn') : host ? t('hostNoVideo', { name: host.name ?? '' }) : t('hostAbsent')}
            </Typography>
          )}
          {main && !audioOnly && (
            <Typography variant="caption" sx={{ position: 'absolute', left: 8, bottom: 8, px: 2, py: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}>
              {main.participant.name}
              {main.source === Track.Source.ScreenShare ? ` · ${t('screen')}` : ''}
            </Typography>
          )}
          <ReactionOverlay items={reactions} />
        </Box>

        {/* Caméras autorisées (étudiants, ou animateur pendant un partage d'écran) */}
        {!audioOnly && others.length > 0 && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {others.map((ref) => (
              <Box key={`${ref.participant.identity}-${ref.source}`} sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: '#111418', borderRadius: 1, overflow: 'hidden' }}>
                <VideoTrack trackRef={ref} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Typography variant="caption" sx={{ position: 'absolute', left: 6, bottom: 6, px: 1.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                  {ref.participant.name}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Commandes */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <ControlButton
            label={local.isMicrophoneEnabled ? t('micOff') : t('micOn')}
            disabledLabel={t('micLocked')}
            disabled={!canMic}
            active={local.isMicrophoneEnabled}
            onClick={() => toggle(() => local.setMicrophoneEnabled(!local.isMicrophoneEnabled))}
            icon={local.isMicrophoneEnabled ? <Mic aria-hidden size={20} /> : <MicOff aria-hidden size={20} />}
          />
          <ControlButton
            label={local.isCameraEnabled ? t('cameraOff') : t('cameraOn')}
            disabledLabel={t('cameraLocked')}
            disabled={!canCam}
            active={local.isCameraEnabled}
            onClick={() => toggle(() => local.setCameraEnabled(!local.isCameraEnabled))}
            icon={local.isCameraEnabled ? <Video aria-hidden size={20} /> : <VideoOff aria-hidden size={20} />}
          />
          {canShare && (
            <ControlButton
              label={local.isScreenShareEnabled ? t('shareOff') : t('shareOn')}
              active={local.isScreenShareEnabled}
              onClick={() => toggle(() => local.setScreenShareEnabled(!local.isScreenShareEnabled))}
              icon={<MonitorUp aria-hidden size={20} />}
            />
          )}
          {!isHost && (
            <Button
              variant={handUp ? 'contained' : 'outlined'}
              color={handUp ? 'warning' : 'primary'}
              startIcon={<Hand aria-hidden size={18} />}
              aria-pressed={handUp}
              disabled={busy}
              onClick={() => run(() => raiseHand(meetingId, !handUp))}
            >
              {handUp ? t('lowerHand') : t('raiseHand')}
            </Button>
          )}
          <ReactionPicker onPick={react} coolingDown={coolingDown} labels={reactionLabels} />
          <Button variant="outlined" color="secondary" startIcon={<Volume2 aria-hidden size={18} />} aria-pressed={audioOnly} onClick={() => setAudioOnly((v) => !v)}>
            {audioOnly ? t('showVideo') : t('audioOnly')}
          </Button>
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
      </Box>

      {/* Panneau : discussion et participants */}
      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: 360, maxHeight: { lg: 'calc(100vh - 220px)' } }}>
        <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="fullWidth" aria-label={t('panel')}>
          <Tab label={t('chat')} id="live-tab-0" aria-controls="live-panel-0" />
          <Tab
            label={`${t('participants')} (${participants.length})${participants.some((p) => handOf(p) > 0) ? ' ✋' : ''}`}
            id="live-tab-1"
            aria-controls="live-panel-1"
          />
        </Tabs>
        <Box role="tabpanel" id="live-panel-0" aria-labelledby="live-tab-0" hidden={tab !== 0} sx={{ flex: 1, minHeight: 0, display: tab === 0 ? 'flex' : 'none', flexDirection: 'column' }}>
          <Chat />
        </Box>
        <Box role="tabpanel" id="live-panel-1" aria-labelledby="live-tab-1" hidden={tab !== 1} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
          <ParticipantList meetingId={meetingId} isHost={isHost} participants={participants} onError={(e) => setMessage(tr(e))} />
        </Box>
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
          run(() => closeLive(meetingId));
        }}
      />
    </Box>
  );
}

function ControlButton({
  label,
  disabledLabel,
  disabled,
  active,
  onClick,
  icon,
}: {
  label: string;
  disabledLabel?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  const text = disabled && disabledLabel ? disabledLabel : label;
  return (
    <Tooltip title={text}>
      <span>
        <IconButton
          aria-label={text}
          aria-pressed={active}
          disabled={disabled}
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
      </span>
    </Tooltip>
  );
}

function ParticipantList({
  meetingId,
  isHost,
  participants,
  onError,
}: {
  meetingId: string;
  isHost: boolean;
  participants: Participant[];
  onError: (key: string) => void;
}) {
  const t = useTranslations('academy.live');
  const [busy, startTransition] = useTransition();
  const sorted = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (isHostP(a) !== isHostP(b)) return isHostP(a) ? -1 : 1;
        const ha = handOf(a);
        const hb = handOf(b);
        if (ha && hb) return ha - hb;
        if (ha || hb) return ha ? -1 : 1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      }),
    [participants],
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok && r.error) onError(r.error);
    });

  return (
    <Stack spacing={2}>
      {isHost && (
        <Button size="small" variant="outlined" color="secondary" startIcon={<MicOff aria-hidden size={16} />} disabled={busy} onClick={() => run(() => muteEveryone(meetingId))}>
          {t('muteAll')}
        </Button>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}>
        {sorted.map((p) => {
          const access = accessFromPermission(p.permissions);
          const hand = handOf(p) > 0;
          const student = !isHostP(p);
          return (
            <Box component="li" key={p.identity} sx={{ p: 2, borderRadius: 1, border: 1, borderColor: hand ? 'warning.main' : 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name || '—'}
                  {p.isLocal ? ` (${t('you')})` : ''}
                </Typography>
                {!student && <Chip size="small" color="primary" label={t('hostBadge')} />}
                {hand && <Hand aria-label={t('handRaised')} size={16} />}
                {p.isMicrophoneEnabled ? <Mic aria-label={t('micActive')} size={16} /> : <MicOff aria-label={t('micMuted')} size={16} />}
              </Box>
              {isHost && student && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                  <Button size="small" variant={access.mic ? 'contained' : 'outlined'} disabled={busy} onClick={() => run(() => setParticipantAccess(meetingId, p.identity, !access.mic, access.camera))}>
                    {access.mic ? t('revokeMic') : t('grantMic')}
                  </Button>
                  <Button size="small" variant={access.camera ? 'contained' : 'outlined'} disabled={busy} onClick={() => run(() => setParticipantAccess(meetingId, p.identity, access.mic, !access.camera))}>
                    {access.camera ? t('revokeCamera') : t('grantCamera')}
                  </Button>
                  {hand && (
                    <Button size="small" color="secondary" disabled={busy} onClick={() => run(() => lowerHand(meetingId, p.identity))}>
                      {t('lowerHandOf')}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}

/**
 * Réactions emoji : envoi limité à 1 par seconde (bouton désactivé), même
 * limite appliquée à la réception par personne, plafond d'emojis à l'écran.
 * Le nom affiché vient du participant LiveKit (jeton signé par le serveur),
 * jamais du contenu du message.
 */
function useReactions(myName: string) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [coolingDown, setCoolingDown] = useState(false);
  const limiter = useRef<ReactionLimiter | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const seq = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const show = useCallback(
    (code: ReactionCode, name: string) => {
      seq.current += 1;
      const id = `r${seq.current}`;
      setReactions((list) => pushReaction(list, { id, code, name, x: Math.random() }));
      later(() => setReactions((list) => list.filter((r) => r.id !== id)), REACTION_LIFETIME_MS);
    },
    [later],
  );

  const onMessage = useCallback(
    (msg: { payload: Uint8Array; from?: Participant }) => {
      const code = decodeReaction(msg.payload);
      if (!code || !msg.from) return;
      limiter.current ??= new ReactionLimiter();
      if (!limiter.current.allow(msg.from.identity, Date.now())) return;
      show(code, msg.from.name || '—');
    },
    [show],
  );
  const { send } = useDataChannel(REACTION_TOPIC, onMessage);

  const react = useCallback(
    (code: ReactionCode) => {
      if (coolingDown) return;
      setCoolingDown(true);
      later(() => setCoolingDown(false), REACTION_COOLDOWN_MS);
      show(code, myName);
      send(encodeReaction(code), { reliable: false, topic: REACTION_TOPIC }).catch(() => {
        // Réaction perdue (connexion) : sans importance, elle est éphémère.
      });
    },
    [coolingDown, later, myName, send, show],
  );

  return { reactions, react, coolingDown };
}

function Chat() {
  const t = useTranslations('academy.live');
  const locale = useLocale();
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // L'utilisateur lit-il le bas du chat ? Sinon, il relit l'historique : on ne le déplace pas.
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
      host: m.from ? isHostP(m.from) : false,
    };
  });
  const count = items.length;
  const lastMine = count > 0 && items[count - 1].mine;

  const toBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
    stick.current = true;
    setUnread(false);
  }, []);

  useEffect(() => {
    if (count === 0) return;
    // Mon propre message : on descend toujours ; sinon seulement si l'on était en bas.
    if (stick.current || lastMine) toBottom();
    else setUnread(true);
  }, [count, lastMine, toBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = isNearBottom(el);
    if (stick.current) setUnread(false);
  };

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const v = text.trim().slice(0, 500);
    if (!v) return;
    try {
      await send(v);
      setText('');
    } catch {
      // Message non envoyé (connexion) : le texte reste dans le champ.
    }
  };

  return (
    <>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ChatMessageList
          ref={listRef}
          items={items}
          onScroll={onScroll}
          labels={{ title: t('chat'), empty: t('chatEmpty'), host: t('trainerBadge'), you: t('you') }}
        />
        {unread && (
          <Button
            size="small"
            variant="contained"
            onClick={toBottom}
            startIcon={<ArrowDown aria-hidden size={16} />}
            sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', boxShadow: 3 }}
          >
            {t('newMessages')}
          </Button>
        )}
      </Box>
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 2, p: 3, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          size="small"
          fullWidth
          placeholder={t('chatPlaceholder')}
          inputProps={{ maxLength: 500, 'aria-label': t('chatPlaceholder') }}
        />
        <IconButton type="submit" color="primary" aria-label={t('send')} disabled={isSending || !text.trim()}>
          <Send aria-hidden size={18} />
        </IconButton>
      </Box>
    </>
  );
}
