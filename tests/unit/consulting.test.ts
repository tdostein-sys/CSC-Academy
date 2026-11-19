import { describe, expect, it } from 'vitest';
import {
  bookingRef,
  clientCanChange,
  doualaDay,
  doualaTime,
  groupSlotsByDay,
  isPast,
  olderThanHours,
  videoWindow,
} from '@/lib/consulting/types';
import { consultingErrorKey } from '@/lib/consulting/errors';
import {
  adminRescheduleSchema,
  bookSchema,
  checkConsultingFile,
  doualaLocalToIso,
  offerSchema,
  paymentSchema,
  settingsSchema,
  unavailabilitySchema,
} from '@/lib/validation/consulting';

const H = 3600_000;
const NOW = Date.parse('2026-11-20T12:00:00Z');

describe('CSC Consulting — heures du Cameroun', () => {
  it('jour et heure locaux (UTC+1)', () => {
    expect(doualaDay('2026-11-20T23:30:00Z')).toBe('2026-11-21');
    expect(doualaTime('2026-11-20T23:30:00Z')).toBe('00:30');
    expect(doualaLocalToIso('2026-11-21T09:00')).toBe('2026-11-21T08:00:00.000Z');
  });

  it('regroupe les créneaux par jour local, triés', () => {
    const groups = groupSlotsByDay(['2026-11-21T08:30:00.000Z', '2026-11-20T23:00:00.000Z', '2026-11-21T08:00:00.000Z', '2026-11-22T07:00:00.000Z']);
    expect(groups.map((g) => g.day)).toEqual(['2026-11-21', '2026-11-22']);
    expect(groups[0].slots.map((s) => s.time)).toEqual(['00:00', '09:00', '09:30']);
  });

  it('numéro lisible', () => {
    expect(bookingRef(42)).toBe('RDV-000042');
  });
});

describe('CSC Consulting — règles affichées (miroir de la base)', () => {
  const at = (h: number) => new Date(NOW + h * H).toISOString();

  it('annulation / report par le client jusqu’à 24 h avant', () => {
    expect(clientCanChange({ status: 'confirmed', starts_at: at(25) }, 24, NOW)).toBe(true);
    expect(clientCanChange({ status: 'confirmed', starts_at: at(23) }, 24, NOW)).toBe(false);
    // Non payé : modifiable jusqu'au début.
    expect(clientCanChange({ status: 'pending_payment', starts_at: at(2) }, 24, NOW)).toBe(true);
    expect(clientCanChange({ status: 'cancelled', starts_at: at(48) }, 24, NOW)).toBe(false);
  });

  it('fenêtre de visio : client 15 min avant, conseiller 1 h avant, fermée 30 min après la fin', () => {
    const b = { starts_at: at(0.5), ends_at: at(1.5) };
    expect(videoWindow(b, false, NOW)).toBe('early');
    expect(videoWindow(b, true, NOW)).toBe('open');
    expect(videoWindow({ starts_at: at(0.2), ends_at: at(1.2) }, false, NOW)).toBe('open');
    expect(videoWindow({ starts_at: at(-2), ends_at: at(-1) }, true, NOW)).toBe('over');
  });

  it('dates passées et ancienneté', () => {
    expect(isPast(at(-1), NOW)).toBe(true);
    expect(isPast(at(1), NOW)).toBe(false);
    expect(isPast(null, NOW)).toBe(false);
    expect(olderThanHours(at(-27), 26, NOW)).toBe(true);
    expect(olderThanHours(at(-1), 26, NOW)).toBe(false);
    expect(olderThanHours(undefined, 26, NOW)).toBe(true);
  });
});

describe('CSC Consulting — validation des saisies', () => {
  it('offre : adresse exigée en présentiel, durée bornée, prix en FCFA', () => {
    const base = { source_locale: 'fr', title: 'Bilan patrimonial', category: 'investment', duration_minutes: '60', price: '25 000' };
    expect(offerSchema.safeParse({ ...base, mode: 'video' }).success).toBe(true);
    expect(offerSchema.safeParse({ ...base, mode: 'video' }).data?.price).toBe(25000);
    expect(offerSchema.safeParse({ ...base, mode: 'in_person' }).success).toBe(false);
    expect(offerSchema.safeParse({ ...base, mode: 'in_person', location: 'Akwa, Douala' }).success).toBe(true);
    expect(offerSchema.safeParse({ ...base, mode: 'video', duration_minutes: '5' }).success).toBe(false);
    expect(offerSchema.safeParse({ ...base, mode: 'video', once_per_client: 'on' }).data?.once_per_client).toBe(true);
  });

  it('réservation : un créneau complet est exigé', () => {
    const offer_id = '3f1c2a4e-1b2c-4d5e-8f90-112233445566';
    expect(bookSchema.safeParse({ offer_id, starts_at: '2026-11-21T08:00:00.000Z' }).success).toBe(true);
    expect(bookSchema.safeParse({ offer_id, starts_at: '' }).success).toBe(false);
    expect(bookSchema.safeParse({ offer_id, starts_at: '2026-11-21' }).success).toBe(false);
  });

  it('paiement : référence obligatoire sauf espèces, montant positif', () => {
    const booking_id = '3f1c2a4e-1b2c-4d5e-8f90-112233445566';
    expect(paymentSchema.safeParse({ booking_id, amount: '25000', method: 'orange_money', reference: '', paid_on: '2026-11-20' }).success).toBe(false);
    expect(paymentSchema.safeParse({ booking_id, amount: '25000', method: 'cash', reference: '', paid_on: '2026-11-20' }).success).toBe(true);
    expect(paymentSchema.safeParse({ booking_id, amount: '0', method: 'cash', reference: '', paid_on: '2026-11-20' }).success).toBe(false);
  });

  it('réglages, indisponibilités et report : bornes et ordre des dates', () => {
    const s = { source_locale: 'fr', hold_hours: '24', min_notice_hours: '24', horizon_days: '30', cancel_limit_hours: '24', slot_step_minutes: '30' };
    expect(settingsSchema.safeParse(s).data?.slot_step_minutes).toBe(30);
    expect(settingsSchema.safeParse({ ...s, hold_hours: '100' }).success).toBe(false);
    const advisor_id = '3f1c2a4e-1b2c-4d5e-8f90-112233445566';
    expect(unavailabilitySchema.safeParse({ advisor_id, starts_at: '2026-12-01T08:00', ends_at: '2026-12-01T07:00' }).success).toBe(false);
    expect(adminRescheduleSchema.safeParse({ id: advisor_id, starts_at: '2026-12-01T08:00' }).success).toBe(true);
  });

  it('fichiers : PDF ou image, 4 Mo maximum', () => {
    expect(checkConsultingFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(checkConsultingFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).toBe('validation.pdfOrImageOnly');
    expect(checkConsultingFile(new File([new Uint8Array(5 * 1024 * 1024)], 'b.pdf', { type: 'application/pdf' }))).toBe('validation.consultingFileTooLarge');
  });
});

describe('CSC Consulting — messages d’erreur', () => {
  it('codes SQL traduits, détails techniques masqués', () => {
    expect(consultingErrorKey({ message: 'slot_taken' })).toBe('consulting.errors.slot_taken');
    expect(consultingErrorKey({ message: 'booking_not_cancellable' })).toBe('consulting.errors.booking_not_cancellable');
    expect(consultingErrorKey({ message: 'forbidden' })).toBe('errors.forbidden');
    expect(consultingErrorKey({ message: 'conflicting key value', code: '23P01' })).toBe('consulting.errors.slot_taken');
    expect(consultingErrorKey({ message: 'relation xyz does not exist' })).toBe('errors.generic');
  });
});
