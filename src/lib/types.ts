export type Locale = 'fr' | 'en';

export interface Profile {
  id: string;
  username: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone_whatsapp: string;
  locale: Locale;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
