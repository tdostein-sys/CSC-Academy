import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Thème d'origine du template Sneat : style d'export conservé tel quel.
    files: ['src/@core/**'],
    rules: { 'import/no-anonymous-default-export': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**']),
]);
