import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Garde-fou d'encodage : aucun texte « abîmé » (UTF-8 relu en Windows-1252,
 * ex. « Ã© » au lieu de « é », « â€™ » au lieu de « ’ ») ni marque BOM dans
 * les traductions et le code source.
 */
const ROOT = path.resolve(__dirname, '../..');
const MOJIBAKE = /Ã[\u0080-¿]|â€[\u0098-\u009f‘-„†-…™€™œ”“]|Â[«» °]/;

function files(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, exts));
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

describe('Encodage des textes', () => {
  const all = [...files(path.join(ROOT, 'src'), ['.ts', '.tsx', '.json']), ...files(path.join(ROOT, 'supabase'), ['.sql'])];

  it('aucun texte abîmé (accents, apostrophes, guillemets)', () => {
    const bad = all.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => (MOJIBAKE.test(line) ? `${path.relative(ROOT, f)}:${i + 1}` : null))
        .filter(Boolean),
    );
    expect(bad).toEqual([]);
  });

  it('aucun fichier avec marque BOM', () => {
    const bom = all.filter((f) => readFileSync(f)[0] === 0xef).map((f) => path.relative(ROOT, f));
    expect(bom).toEqual([]);
  });

  it('les textes français gardent leurs accents', () => {
    const fr = JSON.parse(readFileSync(path.join(ROOT, 'src/messages/fr.json'), 'utf8'));
    expect(fr.auth.backToHome).toBe('Retour à l’accueil');
    expect(fr.auth.remember).toBe('Rester connecté sur cet appareil');
  });
});
