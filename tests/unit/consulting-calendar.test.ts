import { describe, expect, it } from 'vitest';
import { toCalendarBookings } from '@/lib/consulting/calendar';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const row = (over: Record<string, unknown>) => ({
  id: 'b1',
  ref: 42,
  offer_title_fr: 'Bilan patrimonial',
  offer_title_en: 'Wealth review',
  starts_at: '2026-11-21T09:00:00Z',
  ends_at: '2026-11-21T10:00:00Z',
  status: 'confirmed',
  advisor_name: 'Conseiller CSC',
  client_first_name: 'Awa',
  client_last_name: 'Ndiaye',
  ...over,
});

describe('Calendrier des rendez-vous', () => {
  it('client : offre en titre, conseiller en sous-titre, lien vers « Mes rendez-vous »', () => {
    const [e] = toCalendarBookings([row({}) as never], 'client', 'fr', { now: NOW });
    expect(e).toMatchObject({ title: 'Bilan patrimonial', subtitle: 'RDV-000042 · Conseiller CSC', status: 'confirmed', href: '/consulting/bookings/b1' });
  });

  it('équipe : client en titre, offre (+ conseiller pour l’admin), lien vers la fiche de suivi', () => {
    const [e] = toCalendarBookings([row({}) as never], 'staff', 'en', { showAdvisor: true, now: NOW });
    expect(e).toMatchObject({ title: 'Awa Ndiaye', subtitle: 'Wealth review · Conseiller CSC', href: '/consulting/manage/b1' });
  });

  it('statuts : non payé, terminé ; annulés / expirés / remboursés exclus', () => {
    const list = toCalendarBookings(
      [
        row({ id: 'p', status: 'pending_payment' }),
        row({ id: 'd', starts_at: '2026-11-19T09:00:00Z', ends_at: '2026-11-19T10:00:00Z' }),
        row({ id: 'c', status: 'cancelled' }),
        row({ id: 'x', status: 'expired' }),
        row({ id: 'r', status: 'refunded' }),
      ] as never[],
      'client',
      'fr',
      { now: NOW },
    );
    expect(list.map((e) => [e.id, e.status])).toEqual([
      ['p', 'pending'],
      ['d', 'done'],
    ]);
  });
});
