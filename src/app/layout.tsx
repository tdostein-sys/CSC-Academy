import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { EmotionRegistry } from '@/components/theme/emotion-registry';
import { AppThemeProvider } from '@/components/theme/theme-provider';
import { THEME_COOKIE, THEME_SYSTEM_COOKIE, toThemePref } from '@/lib/theme-cookies';
import { publicEnv } from '@/lib/env';
import { fontVariables } from '@/@core/theme/fonts';
import { tokens } from '@/@core/theme/tokens';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'CSC — Crypto Sans Complexe', template: '%s · CSC' },
  description: 'Formations en trading et investissement, programme ambassadeur et conseil financier — Cameroun.',
  icons: { icon: '/logo-csc.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: tokens.light.surface },
    { media: '(prefers-color-scheme: dark)', color: tokens.dark.surface },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, store] = await Promise.all([getLocale(), cookies()]);
  const pref = toThemePref(store.get(THEME_COOKIE)?.value);
  const systemMode = store.get(THEME_SYSTEM_COOKIE)?.value === 'dark' ? 'dark' : 'light';

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <EmotionRegistry>
          <AppThemeProvider initialPref={pref} initialSystemMode={systemMode}>
            <NextIntlClientProvider>{children}</NextIntlClientProvider>
          </AppThemeProvider>
        </EmotionRegistry>
      </body>
    </html>
  );
}
