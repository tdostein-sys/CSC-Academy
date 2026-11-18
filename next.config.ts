import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Développement en réseau local : noms d'hôte (sans http:// ni port) autorisés à
// utiliser le serveur de dev en plus de localhost, ex. DEV_ALLOWED_ORIGINS=mon-pc.
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: devOrigins,
  experimental: {
    // Fichiers de mode opératoire jusqu'à 5 Mo (+ marge multipart).
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Caméra, micro et partage d'écran : réservés à notre propre site (visio
          // CSC Academy), toujours refusés aux contenus intégrés (vidéos, autres
          // sites). Autorisés sur toutes les pages car l'accès à la visio se fait
          // sans rechargement complet : le navigateur garde la règle de la page
          // de départ.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
