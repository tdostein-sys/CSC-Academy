import { describe, expect, it } from 'vitest';
import { doualaLocalToIso, enrollSchema, linkResourceSchema, parseSchedule, sessionSchema } from '@/lib/validation/academy';
import { academyErrorKey } from '@/lib/academy/errors';
import { meetingWindow } from '@/lib/academy/types';

describe('Academy — échéancier saisi par l’admin', () => {
  it('lit les tranches dans l’ordre et ignore les lignes vides', () => {
    expect(parseSchedule({ amount_1: '40 000', due_1: '2027-01-10', amount_2: '', due_2: '', amount_3: '60000', due_3: '2027-02-10' })).toEqual({
      amounts: [40000, 60000],
      dates: ['2027-01-10', '2027-02-10'],
    });
  });

  it('refuse des dates non croissantes, un montant invalide ou un échéancier vide', () => {
    expect(parseSchedule({ amount_1: '100', due_1: '2027-02-10', amount_2: '100', due_2: '2027-01-10' })).toEqual({ error: 'academy.errors.schedule_dates_order' });
    expect(parseSchedule({ amount_1: '0', due_1: '2027-02-10' })).toEqual({ error: 'validation.amountInvalid' });
    expect(parseSchedule({})).toEqual({ error: 'academy.errors.schedule_invalid' });
  });
});

describe('Academy — saisies', () => {
  const id = '6f1c2b8e-1d2a-4c5b-9e8f-0a1b2c3d4e5f';

  it('normalise le code de parrainage', () => {
    const r = enrollSchema.safeParse({ session_id: id, referral_code: ' csc-amb-0001 ' });
    expect(r.success && r.data.referral_code).toBe('CSC-AMB-0001');
    expect(enrollSchema.safeParse({ session_id: id, referral_code: 'ABC' }).success).toBe(false);
    expect(enrollSchema.safeParse({ session_id: id }).success).toBe(true);
  });

  it('session : fin après début, places et taux valides', () => {
    const base = { course_id: id, label: 'Session janvier', starts_on: '2027-01-10', ends_on: '2027-03-10', seats: '30', commission_rate: '10,5' };
    const ok = sessionSchema.safeParse(base);
    expect(ok.success && ok.data.commission_rate).toBe(10.5);
    expect(sessionSchema.safeParse({ ...base, ends_on: '2027-01-01' }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, seats: '0' }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, commission_rate: '120' }).success).toBe(false);
  });

  it('vidéo : seuls les liens intégrables sont acceptés', () => {
    const v = { session_id: id, kind: 'video', title: 'Replay' };
    expect(linkResourceSchema.safeParse({ ...v, url: 'https://www.tiktok.com/@csc/video/7301234567890123456' }).success).toBe(true);
    expect(linkResourceSchema.safeParse({ ...v, url: 'https://example.com/video.mp4' }).success).toBe(false);
    expect(linkResourceSchema.safeParse({ ...v, kind: 'link', url: 'https://example.com/support' }).success).toBe(true);
    expect(linkResourceSchema.safeParse({ ...v, kind: 'link', url: 'http://example.com' }).success).toBe(false);
  });

  it('heure saisie au Cameroun (UTC+1) convertie en UTC', () => {
    expect(doualaLocalToIso('2027-01-15T18:00')).toBe('2027-01-15T17:00:00.000Z');
  });
});

describe('Academy — séances et erreurs', () => {
  const m = { starts_at: '2027-01-15T17:00:00.000Z', duration_minutes: 60 };
  const at = (iso: string) => new Date(iso).getTime();

  it('« Rejoindre » s’active 15 minutes avant et jusqu’à la fin', () => {
    expect(meetingWindow(m, at('2027-01-15T16:40:00Z'))).toBe('upcoming');
    expect(meetingWindow(m, at('2027-01-15T16:46:00Z'))).toBe('live');
    expect(meetingWindow(m, at('2027-01-15T17:59:00Z'))).toBe('live');
    expect(meetingWindow(m, at('2027-01-15T18:01:00Z'))).toBe('past');
  });

  it('traduit les erreurs SQL sans détail technique', () => {
    expect(academyErrorKey({ message: 'session_full' })).toBe('academy.errors.session_full');
    expect(academyErrorKey({ message: 'forbidden' })).toBe('errors.forbidden');
    expect(academyErrorKey({ message: 'update or delete violates foreign key', code: '23503' })).toBe('academy.errors.has_dependents');
    expect(academyErrorKey({ message: 'connection refused' })).toBe('errors.generic');
  });
});
