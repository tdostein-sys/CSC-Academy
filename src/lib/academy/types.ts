/** Types du module CSC Academy (miroir des tables `academy_*`). */
export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type EnrollmentStatus = 'pending' | 'active' | 'cancelled';
export type InstallmentState = 'paid' | 'partial' | 'unpaid';
export type ResourceKind = 'document' | 'link' | 'video';

export const COURSE_LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

export interface Course {
  id: string;
  title_fr: string;
  title_en: string;
  summary_fr: string;
  summary_en: string;
  program_fr: string;
  program_en: string;
  source_locale: 'fr' | 'en';
  level: CourseLevel;
  status: CourseStatus;
  created_at: string;
}

export const COURSE_COLUMNS = 'id, title_fr, title_en, summary_fr, summary_en, program_fr, program_en, source_locale, level, status, created_at';

export interface Session {
  id: string;
  course_id: string;
  label_fr: string;
  label_en: string;
  payment_instructions_fr: string;
  payment_instructions_en: string;
  source_locale: 'fr' | 'en';
  trainer_name: string;
  starts_on: string;
  ends_on: string;
  seats: number;
  commission_rate: number;
  enrollment_open: boolean;
  frozen_at: string | null;
  created_at: string;
}

export const SESSION_COLUMNS =
  'id, course_id, label_fr, label_en, payment_instructions_fr, payment_instructions_en, source_locale, trainer_name, starts_on, ends_on, seats, commission_rate, enrollment_open, frozen_at, created_at';

export interface SessionOverview {
  session_id: string;
  course_id: string;
  price: number;
  installments_count: number;
  seats: number;
  taken: number;
  remaining: number;
}

export interface Installment {
  session_id: string;
  rank: number;
  amount: number;
  due_on: string;
}

export interface Enrollment {
  id: string;
  session_id: string;
  student_id: string;
  referral_ambassador_id: string | null;
  commission_rate: number;
  status: EnrollmentStatus;
  hold_expires_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export const ENROLLMENT_COLUMNS =
  'id, session_id, student_id, referral_ambassador_id, commission_rate, status, hold_expires_at, activated_at, cancelled_at, cancel_reason, created_at';

export interface EnrollmentBalance {
  enrollment_id: string;
  session_id: string;
  student_id: string;
  status: EnrollmentStatus;
  price: number;
  paid: number;
  remaining: number;
  fully_paid: boolean;
  overdue_count: number;
  next_due_on: string | null;
  /** Date de blocage pour retard (J+3) ; null = accès ouvert. */
  blocked_since: string | null;
}

/** Commission d'un ambassadeur sur une inscription parrainée (vue `academy_commissions`). */
export interface Commission {
  enrollment_id: string;
  session_id: string;
  course_id: string;
  ambassador_id: string;
  ambassador_code: string;
  student_label: string;
  status: EnrollmentStatus;
  commission_rate: number;
  price: number;
  student_paid: number;
  fully_paid: boolean;
  amount: number;
  earned: number;
  paid: number;
  confirmed: number;
  due: number;
  unconfirmed_count: number;
  enrolled_at: string;
  course_title_fr: string;
  course_title_en: string;
  session_label_fr: string;
  session_label_en: string;
}

export interface CommissionPayout {
  id: string;
  enrollment_id: string;
  ambassador_id: string;
  amount: number;
  method: string;
  reference: string;
  paid_at: string;
  confirmed_at: string | null;
}

export type EvaluationStatus = 'draft' | 'open' | 'closed';

export interface Evaluation {
  session_id: string;
  title_fr: string;
  title_en: string;
  instructions_fr: string;
  instructions_en: string;
  source_locale: 'fr' | 'en';
  pass_mark: number;
  max_attempts: number;
  status: EvaluationStatus;
}

export interface QuestionChoice {
  label_fr: string;
  label_en: string;
  correct?: boolean;
}

/** Question telle que l'admin la voit (avec les bonnes réponses). */
export interface Question {
  id: string;
  session_id: string;
  position: number;
  prompt_fr: string;
  prompt_en: string;
  source_locale: 'fr' | 'en';
  multiple: boolean;
  points: number;
  choices: QuestionChoice[];
}

/** Questionnaire envoyé à l'étudiant : jamais les bonnes réponses. */
export interface Paper {
  questions: { id: string; position: number; prompt_fr: string; prompt_en: string; multiple: boolean; points: number; choices: { label_fr: string; label_en: string }[] }[];
}

export interface Attempt {
  id: string;
  session_id: string;
  enrollment_id: string;
  student_id: string;
  attempt_no: number;
  score: number;
  max_score: number;
  percent: number;
  passed: boolean;
  submitted_at: string;
}

export interface Certificate {
  id: string;
  number: string;
  enrollment_id: string;
  student_id: string;
  session_id: string;
  student_name: string;
  course_title_fr: string;
  course_title_en: string;
  session_label_fr: string;
  session_label_en: string;
  session_starts_on: string;
  session_ends_on: string;
  score_percent: number;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

/** Numéro d'attestation : CSC-2027-00012-7F3A. */
export const CERTIFICATE_NUMBER = /^CSC-\d{4}-\d{5,}-[0-9A-F]{4}$/;

export interface InstallmentStateRow {
  enrollment_id: string;
  rank: number;
  amount: number;
  original_due_on: string;
  due_on: string;
  paid_amount: number;
  state: InstallmentState;
  overdue: boolean;
}

export interface Payment {
  id: string;
  enrollment_id: string;
  amount: number;
  provider: 'manual' | 'notchpay';
  status: 'pending' | 'confirmed' | 'failed';
  method: string;
  reference: string;
  paid_on: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  session_id: string;
  title_fr: string;
  title_en: string;
  starts_at: string;
  duration_minutes: number;
  external_url: string | null;
}

/** Enregistrement d'une séance (colonnes lisibles par les navigateurs). */
export interface Recording {
  id: string;
  meeting_id: string;
  session_id: string;
  status: 'recording' | 'ready' | 'failed' | 'deleted';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  size_bytes: number | string | null;
  expires_at: string;
  deleted_at: string | null;
}

/** Colonnes à demander explicitement (les autres ne sont pas accordées). */
export const RECORDING_COLUMNS = 'id, meeting_id, session_id, status, started_at, ended_at, duration_seconds, size_bytes, expires_at, deleted_at';

export interface Resource {
  id: string;
  session_id: string;
  kind: ResourceKind;
  title_fr: string;
  title_en: string;
  url: string | null;
  file_path: string | null;
  created_at: string;
}

/** Les montants `bigint` arrivent parfois en chaîne : conversion sûre. */
export const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Début de la fenêtre « prochaines séances » (séances commencées il y a moins d'une heure incluses). */
export function upcomingMeetingsSince(now = Date.now()): string {
  return new Date(now - 60 * 60_000).toISOString();
}

/** Ouverture de la salle par l'animateur : possible à partir d'une heure avant le début (comme en base). */
export function hostOpensAt(m: Pick<Meeting, 'starts_at'>): string {
  return new Date(new Date(m.starts_at).getTime() - 60 * 60_000).toISOString();
}

export function tooEarlyToOpen(m: Pick<Meeting, 'starts_at'>, now = Date.now()): boolean {
  return now < new Date(hostOpensAt(m)).getTime();
}

/** Fin prévue d'une séance. */
export function meetingEnd(m: Pick<Meeting, 'starts_at' | 'duration_minutes'>): string {
  return new Date(new Date(m.starts_at).getTime() + m.duration_minutes * 60_000).toISOString();
}

/** Rejoindre une séance : possible 15 minutes avant le début et jusqu'à la fin. */
export function meetingWindow(m: Pick<Meeting, 'starts_at' | 'duration_minutes'>, now = Date.now()) {
  const start = new Date(m.starts_at).getTime();
  const end = start + m.duration_minutes * 60_000;
  if (now > end) return 'past' as const;
  if (now >= start - 15 * 60_000) return 'live' as const;
  return 'upcoming' as const;
}
