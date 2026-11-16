export type CampaignStatus = 'draft' | 'launched' | 'closed';
export type SubmissionStatus = 'pending' | 'validated' | 'rejected';
export type AmbassadorStatus = 'active' | 'suspended';

export interface Campaign {
  id: string;
  title_fr: string;
  title_en: string;
  summary_fr: string;
  summary_en: string;
  modop_fr: string;
  modop_en: string;
  modop_file_path: string | null;
  /** Langue de saisie (l'autre version est traduite automatiquement). */
  source_locale: 'fr' | 'en';
  video_url: string | null;
  amount_per_account: number;
  min_volume: number | null;
  ends_on: string | null;
  status: CampaignStatus;
  launched_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  campaign_id: string;
  ambassador_id: string;
  binance_uid: string;
  trading_volume: number;
  status: SubmissionStatus;
  amount: number;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  campaign_id: string;
  ambassador_id: string;
  amount: number;
  method: string;
  reference: string;
  paid_at: string;
  confirmed_at: string | null;
}

export interface CampaignBalance {
  campaign_id: string;
  ambassador_id: string;
  earned: number;
  paid: number;
  confirmed: number;
  due: number;
  validated_count: number;
  unconfirmed_count: number;
}

export interface Ambassador {
  user_id: string;
  number: number;
  code: string;
  status: AmbassadorStatus;
  status_reason: string | null;
  charter_accepted_at: string;
}

/** Colonnes de campagne lues par l'interface. */
export const CAMPAIGN_COLUMNS =
  'id, title_fr, title_en, summary_fr, summary_en, modop_fr, modop_en, modop_file_path, source_locale, video_url, amount_per_account, min_volume, ends_on, status, launched_at, closed_at, created_at';

/** Le numeric Postgres peut arriver en chaîne : on normalise. */
export function num(v: number | string | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}
