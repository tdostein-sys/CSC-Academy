import { describe, expect, it } from 'vitest';
import { presignUrl, rfc3986 } from '@/lib/s3-presign';
import {
  accessFromPermission,
  canPublishSource,
  formatDuration,
  formatSize,
  liveRoomName,
  recordingObjectKey,
  studentSources,
} from '@/lib/academy/live-shared';
import { hostOpensAt, meetingEnd, tooEarlyToOpen } from '@/lib/academy/types';
import { ACADEMY_ERROR_CODES, academyErrorKey } from '@/lib/academy/errors';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

describe('Liens pré-signés S3 (SigV4)', () => {
  it('reproduit l’exemple officiel AWS', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = presignUrl({
      method: 'GET',
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresIn: 86400,
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('adressage « path-style » (R2), paramètres de réponse signés, durée bornée', () => {
    const url = new URL(
      presignUrl({
        method: 'DELETE',
        endpoint: 'https://acc.r2.cloudflarestorage.com',
        path: '/bucket/recordings/a b.mp4',
        region: 'auto',
        accessKeyId: 'K',
        secretAccessKey: 'S',
        expiresIn: 10_000_000,
        query: { 'response-content-type': 'video/mp4' },
      }),
    );
    expect(url.host).toBe('acc.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/bucket/recordings/a%20b.mp4');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('604800');
    expect(url.searchParams.get('response-content-type')).toBe('video/mp4');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('encode selon la RFC 3986', () => {
    expect(rfc3986("a b!'()*~")).toBe('a%20b%21%27%28%29%2A~');
  });
});

describe('Droits dans la salle', () => {
  it('sources publiables par un étudiant', () => {
    expect(studentSources({ mic: false, camera: false })).toEqual([]);
    expect(studentSources({ mic: true, camera: false })).toEqual(['microphone']);
    expect(studentSources({ mic: true, camera: true })).toEqual(['microphone', 'camera']);
  });

  it('lit les droits LiveKit (liste vide = toutes les sources si canPublish)', () => {
    expect(canPublishSource(undefined, 'microphone')).toBe(false);
    expect(canPublishSource({ canPublish: false, canPublishSources: [] }, 'microphone')).toBe(false);
    expect(canPublishSource({ canPublish: true, canPublishSources: [] }, 'screen_share')).toBe(true);
    expect(canPublishSource({ canPublish: true, canPublishSources: [2] }, 'microphone')).toBe(true);
    expect(canPublishSource({ canPublish: true, canPublishSources: [2] }, 'camera')).toBe(false);
    expect(accessFromPermission({ canPublish: true, canPublishSources: [1, 2] })).toEqual({ mic: true, camera: true });
  });

  it('nom de salle identique à la base, chemin d’enregistrement daté', () => {
    expect(liveRoomName('abc')).toBe('csc-academy-abc');
    expect(recordingObjectKey('s1', 'm1', new Date('2026-11-20T09:05:03.123Z'))).toBe('recordings/s1/m1/20261120T090503Z.mp4');
  });
});

describe('Horaires et affichage', () => {
  const m = { starts_at: '2026-11-20T10:00:00.000Z', duration_minutes: 60 };
  it('ouverture 1 h avant, fin prévue', () => {
    expect(hostOpensAt(m)).toBe('2026-11-20T09:00:00.000Z');
    expect(meetingEnd(m)).toBe('2026-11-20T11:00:00.000Z');
    expect(tooEarlyToOpen(m, Date.parse('2026-11-20T08:59:00Z'))).toBe(true);
    expect(tooEarlyToOpen(m, Date.parse('2026-11-20T09:00:00Z'))).toBe(false);
  });

  it('durée et taille lisibles', () => {
    expect(formatDuration(3540)).toBe('59 min');
    expect(formatDuration(3900)).toBe('1 h 05');
    expect(formatSize(700_000_000, 'fr')).toBe('700 Mo');
    expect(formatSize(1_500_000_000, 'en')).toBe('1.5 GB');
  });
});

describe('Messages du lot 3', () => {
  it('chaque code d’erreur a sa traduction FR et EN', () => {
    for (const code of ACADEMY_ERROR_CODES) {
      const key = academyErrorKey({ message: code });
      if (key === 'errors.forbidden') continue;
      const name = key.replace('academy.errors.', '') as keyof typeof fr.academy.errors;
      expect(fr.academy.errors[name], `fr ${code}`).toBeTruthy();
      expect(en.academy.errors[name as keyof typeof en.academy.errors], `en ${code}`).toBeTruthy();
    }
  });

  it('mêmes clés de visio en FR et EN', () => {
    expect(Object.keys(en.academy.live).sort()).toEqual(Object.keys(fr.academy.live).sort());
  });
});
