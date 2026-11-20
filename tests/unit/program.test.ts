import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, parseProgram } from '@/lib/academy/program';

describe('Programme de formation — texte libre vers liste', () => {
  it('« Chapitre N » sur une seule ligne, durées variées', () => {
    const p = parseProgram(
      'Chapitre 1 Introduction aux cryptomonnaies 1h Chapitre 2 La blockchain en profondeur 2h Chapitre 3 Types de cryptomonnaies 1h ' +
        'Chapitre 4 : Présentation complète de Binance 3h Chapitre 5 - Binance P2P 2h Chapitre 6 Binance Earn 2h ' +
        'Chapitre 7 Autres produits Binance 1.5h Chapitre 8 Gestion financière & psychologie 1h30',
    );
    expect(p?.chapters.map((c) => c.title)).toEqual([
      'Introduction aux cryptomonnaies',
      'La blockchain en profondeur',
      'Types de cryptomonnaies',
      'Présentation complète de Binance',
      'Binance P2P',
      'Binance Earn',
      'Autres produits Binance',
      'Gestion financière & psychologie',
    ]);
    expect(p?.chapters.map((c) => c.minutes)).toEqual([60, 120, 60, 180, 120, 120, 90, 90]);
    expect(p?.totalMinutes).toBe(840);
    expect(formatDuration(p!.totalMinutes!)).toBe('14 h');
  });

  it('une ligne par chapitre (liste numérotée ou à puces), durée entre parenthèses', () => {
    const p = parseProgram('1. Les bases du trading (45 min)\n2) Analyse technique (2 heures)\n- Gestion du risque');
    expect(p?.chapters).toEqual([
      { title: 'Les bases du trading', minutes: 45 },
      { title: 'Analyse technique', minutes: 120 },
      { title: 'Gestion du risque', minutes: null },
    ]);
    expect(p?.totalMinutes).toBe(165);
  });

  it('texte non structuré : null (le texte est affiché tel quel)', () => {
    expect(parseProgram('Une formation complète pour apprendre à investir sereinement.')).toBeNull();
    expect(parseProgram('')).toBeNull();
    expect(parseProgram('Chapitre 1 Seul chapitre 1h')).toBeNull();
  });

  it('durées', () => {
    expect(parseDuration('1,5 h')?.minutes).toBe(90);
    expect(parseDuration('1 h 30')?.minutes).toBe(90);
    expect(parseDuration('90 min')?.minutes).toBe(90);
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(65)).toBe('1 h 05');
  });
});
