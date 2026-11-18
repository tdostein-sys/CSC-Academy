import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, toLocale } from './config';

/**
 * Langue choisie via le menu « Langue » (cookie). Français par défaut.
 * Pas de préfixe /fr ou /en dans les URL : l'interface bascule entièrement.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Africa/Douala',
  };
});
