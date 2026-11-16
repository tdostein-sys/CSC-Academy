import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import { PreferencesBar } from '@/components/preferences-bar';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { publicEnv } from '@/lib/env';
import './globals.css';

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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b120d' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased">
        <ThemeProvider>
          <NextIntlClientProvider>
            <PreferencesBar />
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
