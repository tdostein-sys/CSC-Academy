/**
 * Échelle typographique (refonte UI). Les polices viennent des variables CSS
 * posées par `fonts.ts` : --font-heading (titres, montants) et --font-body.
 *
 *   h1 page        26 px / 700, -0.02em      h2 section   17 px / 600
 *   corps          15 px / 400                corps court  14 px / 400
 *   légende        13 px / 500                étiquette    11 px / 600 MAJUSCULES (seul usage autorisé)
 *
 * Les variantes h3–h6 restent disponibles pour l'existant ; elles suivent la
 * même famille et des graisses cohérentes.
 */
const fallback = ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']
const body = ['var(--font-body)', 'Inter', ...fallback].join(',')
const heading = ['var(--font-heading)', '"Plus Jakarta Sans"', 'var(--font-body)', ...fallback].join(',')

const typography = {
  fontFamily: body,
  fontSize: 14,
  h1: { fontFamily: heading, fontWeight: 700, fontSize: '1.625rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
  h2: { fontFamily: heading, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.4, letterSpacing: '-0.01em' },
  h3: { fontFamily: heading, fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
  h4: { fontFamily: heading, fontWeight: 700, fontSize: '1.625rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
  h5: { fontFamily: heading, fontWeight: 700, fontSize: '1.375rem', lineHeight: 1.3, letterSpacing: '-0.02em' },
  h6: { fontFamily: heading, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.4, letterSpacing: '-0.01em' },
  subtitle1: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.5 },
  subtitle2: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.55 },
  caption: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45 },
  overline: { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  button: { fontWeight: 600, textTransform: 'none' as const, letterSpacing: 0 }
}

export default typography
