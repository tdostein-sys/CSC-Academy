import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

/**
 * Polices de l'application, auto-hébergées par next/font (aucune requête vers
 * Google au chargement). Pour changer une police, changez UNE ligne :
 * l'import et l'appel ci-dessous (les variables CSS restent les mêmes).
 *
 *   --font-heading : titres (h1–h3), grands montants, logo texte ;
 *   --font-body    : interface et texte courant.
 */
export const headingFont = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700'], display: 'swap', variable: '--font-heading' });
export const bodyFont = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-body' });

export const fontVariables = `${headingFont.variable} ${bodyFont.variable}`;
