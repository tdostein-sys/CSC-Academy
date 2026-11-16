import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      // `server-only` lève une erreur hors d'un bundle serveur Next : neutralisé en test.
      'server-only': fileURLToPath(new URL('./tests/helpers/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Les tests SQL démarrent une instance PGlite (Postgres en WebAssembly).
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
