/**
 * Attestation CSC Academy au format PDF (A4 paysage), générée sans
 * dépendance : polices standard Helvetica (aucun fichier de police à
 * embarquer), encodage WinAnsi (accents français pris en charge).
 */

export interface CertificateContent {
  heading: string;
  awardedTo: string;
  name: string;
  completed: string;
  course: string;
  session: string;
  score: string;
  numberLabel: string;
  number: string;
  issuedLabel: string;
  issued: string;
  verifyLabel: string;
  verifyUrl: string;
  org: string;
}

type Font = 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold

// Largeurs (1/1000 em) des caractères ASCII 32 à 126 (métriques AFM standard).
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Caractères hors Latin-1 présents dans WinAnsi. */
const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, 'Œ': 0x8c, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Ÿ': 0x9f,
};
const SPECIAL_WIDTH: Record<number, number> = {
  0x80: 556, 0x82: 278, 0x84: 500, 0x85: 1000, 0x8c: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333,
  0x95: 350, 0x96: 556, 0x97: 1000, 0x9c: 944, 0x9f: 667, 0xa0: 278, 0xab: 556, 0xbb: 556, 0xb0: 400,
};

/** Code WinAnsi d'un caractère (espaces insécables → espace, inconnu → « ? »). */
function winAnsi(ch: string): number {
  if (ch === ' ' || ch === ' ' || ch === ' ') return 0x20;
  const extra = WIN_ANSI_EXTRA[ch];
  if (extra) return extra;
  const c = ch.codePointAt(0) ?? 63;
  if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) return c;
  return 63;
}

function charWidth(code: number, font: Font): number {
  const table = font === 'F2' ? HELVETICA_BOLD : HELVETICA;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (SPECIAL_WIDTH[code]) return SPECIAL_WIDTH[code];
  // Lettre accentuée : largeur de la lettre de base (é → e).
  const base = String.fromCharCode(code).normalize('NFD')[0];
  const b = base.charCodeAt(0);
  return b >= 32 && b <= 126 ? table[b - 32] : 556;
}

export function textWidth(text: string, font: Font, size: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(winAnsi(ch), font);
  return (w * size) / 1000;
}

/** Chaîne PDF littérale : ASCII uniquement (octets > 127 en séquences octales). */
function pdfString(text: string): string {
  let out = '(';
  for (const ch of text) {
    const code = winAnsi(ch);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return `${out})`;
}

/** Découpe un texte en lignes d'une largeur maximale. */
export function wrapText(text: string, font: Font, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, font, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const W = 842; // A4 paysage, en points
const H = 595;

export function certificatePdf(c: CertificateContent): Uint8Array {
  const ops: string[] = [];
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  const centered = (text: string, font: Font, size: number, y: number, color = '#1f2937') => {
    const x = (W - textWidth(text, font, size)) / 2;
    ops.push(`BT ${rgb(color)} rg /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(text)} Tj ET`);
  };
  const at = (text: string, font: Font, size: number, x: number, y: number, color = '#4b5563') => {
    ops.push(`BT ${rgb(color)} rg /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(text)} Tj ET`);
  };

  // Cadre : bande de couleur + double filet.
  ops.push(`${rgb('#1d5fd6')} rg 0 ${H - 14} ${W} 14 re f 0 0 ${W} 14 re f`);
  ops.push(`${rgb('#1d5fd6')} RG 2 w 28 28 ${W - 56} ${H - 56} re S`);
  ops.push(`${rgb('#9db8ec')} RG 0.75 w 36 36 ${W - 72} ${H - 72} re S`);

  centered(c.org, 'F2', 14, H - 90, '#1d5fd6');
  centered(c.heading.toUpperCase(), 'F2', 30, H - 140);
  ops.push(`${rgb('#1d5fd6')} RG 1.5 w ${W / 2 - 60} ${H - 158} m ${W / 2 + 60} ${H - 158} l S`);

  centered(c.awardedTo, 'F1', 13, H - 200, '#4b5563');
  const nameSize = textWidth(c.name, 'F2', 30) > W - 160 ? 22 : 30;
  centered(c.name, 'F2', nameSize, H - 240, '#111827');
  centered(c.completed, 'F1', 13, H - 280, '#4b5563');

  let y = H - 318;
  for (const line of wrapText(c.course, 'F2', 20, W - 200).slice(0, 3)) {
    centered(line, 'F2', 20, y, '#1d5fd6');
    y -= 26;
  }
  centered(c.session, 'F1', 12, y - 2, '#4b5563');
  centered(c.score, 'F2', 12, y - 24, '#15803d');

  // Pied de page : numéro, date, vérification.
  const footY = 92;
  at(c.numberLabel, 'F1', 9, 70, footY + 16);
  at(c.number, 'F2', 12, 70, footY, '#111827');
  const issuedX = W - 70 - Math.max(textWidth(c.issuedLabel, 'F1', 9), textWidth(c.issued, 'F2', 12));
  at(c.issuedLabel, 'F1', 9, issuedX, footY + 16);
  at(c.issued, 'F2', 12, issuedX, footY, '#111827');
  centered(c.verifyLabel, 'F1', 9, 64, '#4b5563');
  centered(c.verifyUrl, 'F1', 9, 52, '#1d5fd6');

  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title ${pdfString(`${c.heading} - ${c.number}`)} /Producer (CSC) >>`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Le document est en ASCII pur : un caractère = un octet.
  return new TextEncoder().encode(pdf);
}
