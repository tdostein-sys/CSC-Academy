import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import themeOptions from '@/@core/theme/ThemeOptions';
import { defaultSettings } from '@/@core/theme/settings';
import { ChatMessageList, isNearBottom, type ChatItem } from '@/components/live/chat-messages';
import { ReactionOverlay } from '@/components/live/reactions';
import {
  MAX_VISIBLE_REACTIONS,
  REACTIONS,
  ReactionLimiter,
  decodeReaction,
  encodeReaction,
  pushReaction,
  type FloatingReaction,
} from '@/lib/academy/reactions';
import { ADMIN_LINK_SECONDS, STUDENT_LINK_MAX_SECONDS, canStream, linkLifetimeSeconds, replayListState } from '@/lib/academy/live-shared';
import { academyErrorKey } from '@/lib/academy/errors';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

// -----------------------------------------------------------------------------
// 1. Chat : une carte par message
// -----------------------------------------------------------------------------
describe.each(['light', 'dark'] as const)('chat — rendu des messages (thème %s)', (mode) => {
  const theme = createTheme(themeOptions({ ...defaultSettings, mode }));
  const labels = { title: 'Discussion', empty: 'Aucun message', host: 'Formateur', you: 'vous' };
  const item = (over: Partial<ChatItem>): ChatItem => ({
    id: 'm1',
    author: 'Awa Ndiaye',
    time: '14:05',
    dateTime: '2026-11-19T13:05:00.000Z',
    text: 'Bonjour',
    mine: false,
    host: false,
    ...over,
  });
  const render = (items: ChatItem[]) => renderToString(h(ThemeProvider, { theme }, h(ChatMessageList, { items, labels })));

  it('chaque message est une carte avec auteur, heure et texte', () => {
    const html = render([item({ id: 'a' }), item({ id: 'b', author: 'Paul Biya', text: 'Salut' })]);
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain('Awa Ndiaye');
    expect(html).toContain('Paul Biya');
    expect(html).toMatch(/<time[^>]*datetime="2026-11-19T13:05:00.000Z"/i);
    expect(html).toContain('14:05');
    expect(html).toContain('Salut');
    expect(html).toContain('role="log"');
  });

  it('mes messages sont repérés et mon nom suivi de « (vous) »', () => {
    const html = render([item({ mine: true, author: 'Moi Même' })]);
    expect(html).toContain('data-mine="true"');
    expect(html).toContain('Moi Même (vous)');
  });

  it('les messages du formateur portent un badge', () => {
    const html = render([item({ host: true, author: 'Formateur CSC' }), item({ id: 'x' })]);
    expect(html.match(/data-host="true"/g)).toHaveLength(1);
    expect(html.match(/>Formateur</g)).toHaveLength(1);
  });

  it('texte échappé et sans débordement (mots très longs)', () => {
    const long = 'x'.repeat(400);
    const html = render([item({ text: `<script>alert(1)</script> ${long}` })]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).toContain('max-width:88%');
  });

  it('liste vide : message d’attente', () => {
    expect(render([])).toContain('Aucun message');
  });
});

describe('chat — défilement automatique', () => {
  it('suit le bas seulement si l’utilisateur y est déjà', () => {
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 560, scrollHeight: 1000, clientHeight: 400 })).toBe(true); // 40 px : toléré
    expect(isNearBottom({ scrollTop: 300, scrollHeight: 1000, clientHeight: 400 })).toBe(false); // remonté dans l'historique
  });
});

// -----------------------------------------------------------------------------
// 2. Réactions
// -----------------------------------------------------------------------------
describe('réactions emoji', () => {
  it('les 8 réactions demandées', () => {
    expect(REACTIONS.map((r) => r.emoji)).toEqual(['👍', '👎', '😂', '😢', '👏', '❤️', '😮', '🎉']);
  });

  it('encodage / décodage ; contenu inattendu ignoré', () => {
    for (const r of REACTIONS) expect(decodeReaction(encodeReaction(r.code))).toBe(r.code);
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(decodeReaction(enc('{"r":"bomb"}'))).toBeNull();
    expect(decodeReaction(enc('pas du json'))).toBeNull();
    expect(decodeReaction(enc(JSON.stringify({ r: 'like', pad: 'x'.repeat(100) })))).toBeNull(); // trop long
    expect(decodeReaction(enc('null'))).toBeNull();
  });

  it('1 réaction par seconde et par personne', () => {
    const limiter = new ReactionLimiter(1000);
    expect(limiter.allow('awa', 0)).toBe(true);
    expect(limiter.allow('awa', 400)).toBe(false);
    expect(limiter.allow('paul', 400)).toBe(true); // autre personne : indépendante
    expect(limiter.allow('awa', 999)).toBe(false);
    expect(limiter.allow('awa', 1000)).toBe(true);
    // Une rafale de 50 envois en 1 s : un seul passe.
    const burst = new ReactionLimiter(1000);
    const passed = Array.from({ length: 50 }, (_, i) => burst.allow('spam', i * 20)).filter(Boolean);
    expect(passed).toHaveLength(1);
  });

  it('plafond d’emojis affichés en même temps (les plus anciens disparaissent)', () => {
    let list: FloatingReaction[] = [];
    for (let i = 0; i < 20; i++) list = pushReaction(list, { id: `r${i}`, code: 'like', name: `P${i}`, x: 0.5 });
    expect(list).toHaveLength(MAX_VISIBLE_REACTIONS);
    expect(list[list.length - 1].id).toBe('r19');
    expect(list[0].id).toBe(`r${20 - MAX_VISIBLE_REACTIONS}`);
  });

  it('affichage : emoji + nom, sans bloquer les clics ni les lecteurs d’écran', () => {
    const theme = createTheme(themeOptions({ ...defaultSettings, mode: 'dark' }));
    const html = renderToString(h(ThemeProvider, { theme }, h(ReactionOverlay, { items: [{ id: 'r1', code: 'clap', name: 'Awa', x: 0.2 }] })));
    expect(html).toContain('👏');
    expect(html).toContain('Awa');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pointer-events:none');
  });
});

// -----------------------------------------------------------------------------
// 3. Replays : durée et refus des liens
// -----------------------------------------------------------------------------
describe('replays — liens de lecture', () => {
  const now = Date.parse('2026-11-19T10:00:00Z');
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  it('lien valable jusqu’à la fin du visionnage, jamais au-delà', () => {
    expect(linkLifetimeSeconds(at(120), now, STUDENT_LINK_MAX_SECONDS)).toBe(7200);
    expect(linkLifetimeSeconds(at(30), now, STUDENT_LINK_MAX_SECONDS)).toBe(1800); // reprise : jusqu'à l'heure initiale
    expect(linkLifetimeSeconds(at(600), now, ADMIN_LINK_SECONDS)).toBe(7200); // admin : 2 h par lien
  });

  it('délai écoulé : aucun lien', () => {
    expect(linkLifetimeSeconds(at(0), now, STUDENT_LINK_MAX_SECONDS)).toBe(0);
    expect(linkLifetimeSeconds(at(-1), now, STUDENT_LINK_MAX_SECONDS)).toBe(0);
    expect(linkLifetimeSeconds(null, now, STUDENT_LINK_MAX_SECONDS)).toBe(0);
    expect(linkLifetimeSeconds('pas une date', now, STUDENT_LINK_MAX_SECONDS)).toBe(0);
  });

  it('seuls « admin » et « visionnage en cours » donnent un lien', () => {
    expect(canStream('admin')).toBe(true);
    expect(canStream('active')).toBe(true);
    expect(canStream('available')).toBe(false);
    expect(canStream('watched')).toBe(false);
    expect(canStream(undefined)).toBe(false);
  });

  it('bouton de la liste : Regarder → Reprendre → Déjà visionné', () => {
    expect(replayListState(null, now)).toBe('available');
    expect(replayListState({ expires_at: at(60) }, now)).toBe('active');
    expect(replayListState({ expires_at: at(-1) }, now)).toBe('watched');
  });

  it('second visionnage refusé : message clair', () => {
    expect(academyErrorKey({ message: 'replay_already_watched' })).toBe('academy.errors.replay_already_watched');
  });

  describe('lien R2 signé', () => {
    const saved = { ...process.env };
    beforeAll(() => {
      process.env.RECORDINGS_S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
      process.env.RECORDINGS_S3_BUCKET = 'test-bucket';
      process.env.RECORDINGS_S3_ACCESS_KEY_ID = 'AKIDTEST';
      process.env.RECORDINGS_S3_SECRET_ACCESS_KEY = 'secret-test';
    });
    afterAll(() => {
      process.env = saved;
    });

    it('durée du lien = temps restant ; refus après le délai', async () => {
      const { playbackUrl } = await import('@/lib/academy/live');
      const soon = new Date(Date.now() + 30 * 60_000).toISOString();
      const url = playbackUrl('recordings/s/m/x.mp4', soon, STUDENT_LINK_MAX_SECONDS);
      expect(url).toBeTruthy();
      const expires = Number(new URL(url!).searchParams.get('X-Amz-Expires'));
      expect(expires).toBeGreaterThan(1790);
      expect(expires).toBeLessThanOrEqual(1800);
      expect(new URL(url!).searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);

      expect(playbackUrl('recordings/s/m/x.mp4', new Date(Date.now() - 1000).toISOString(), STUDENT_LINK_MAX_SECONDS)).toBeNull();
    });
  });
});

describe('traductions des nouveautés', () => {
  type Tree = Record<string, unknown>;
  const get = (tree: Tree, key: string) => key.split('.').reduce<unknown>((n, p) => (n as Tree | undefined)?.[p], tree);
  const keys = [
    'academy.live.trainerBadge',
    'academy.live.reactions',
    'academy.live.newMessages',
    ...REACTIONS.map((r) => `academy.live.reaction.${r.code}`),
    'academy.errors.replay_already_watched',
    'student.replayResume',
    'student.replayWatched',
    'student.replayConfirm',
    'adminAcademy.session.replayReset',
    'adminAcademy.session.replayHoursSaved',
  ];
  it.each(keys)('%s existe en français et en anglais', (key) => {
    expect(typeof get(fr as Tree, key)).toBe('string');
    expect(typeof get(en as Tree, key)).toBe('string');
  });
});
