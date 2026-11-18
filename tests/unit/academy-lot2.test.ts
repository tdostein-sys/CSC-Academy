import { describe, expect, it } from 'vitest';
import { answersFromFormData, commissionPayoutSchema, evaluationSchema, normalizeCertificateNumber, parseChoices } from '@/lib/validation/academy';
import { displayTone, enrollmentDisplay } from '@/lib/academy/display';
import { academyErrorKey } from '@/lib/academy/errors';
import { CERTIFICATE_NUMBER } from '@/lib/academy/types';
import { certificatePdf, textWidth, wrapText } from '@/lib/academy/certificate-pdf';

describe('Academy lot 2 — questionnaire', () => {
  it('lit les propositions et les bonnes réponses, ignore les lignes vides', () => {
    expect(parseChoices({ choice_1: 'Oui', correct_1: 'on', choice_2: '', choice_3: 'Non' }, false)).toEqual({
      labels: ['Oui', 'Non'],
      correct: [true, false],
    });
  });

  it('refuse un choix unique à deux bonnes réponses, ou sans bonne réponse', () => {
    expect(parseChoices({ choice_1: 'A', correct_1: 'on', choice_2: 'B', correct_2: 'on' }, false)).toEqual({ error: 'validation.singleCorrect' });
    expect(parseChoices({ choice_1: 'A', correct_1: 'on', choice_2: 'B', correct_2: 'on' }, true)).toMatchObject({ correct: [true, true] });
    expect(parseChoices({ choice_1: 'A', choice_2: 'B' }, true)).toEqual({ error: 'validation.correctMissing' });
    expect(parseChoices({ choice_1: 'A', correct_1: 'on' }, false)).toEqual({ error: 'validation.choicesTooFew' });
  });

  it('réponses : indices cochés, dédoublonnés et triés, valeurs farfelues ignorées', () => {
    const fd = new FormData();
    fd.append('q_a', '2');
    fd.append('q_a', '0');
    fd.append('q_a', '2');
    fd.append('q_a', '-1');
    fd.append('q_a', 'x');
    fd.append('q_z', '1'); // question inconnue : ignorée
    expect(answersFromFormData(fd, ['a', 'b'])).toEqual({ a: [0, 2], b: [] });
  });

  it('réglages : seuil 1–100 %, tentatives 1–10', () => {
    const base = { session_id: '6f1c2b8e-1d2a-4c5b-9e8f-0a1b2c3d4e5f', source_locale: 'fr', title: 'Évaluation', pass_mark: '60', max_attempts: '2' };
    expect(evaluationSchema.safeParse(base).success).toBe(true);
    expect(evaluationSchema.safeParse({ ...base, pass_mark: '0' }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...base, max_attempts: '11' }).success).toBe(false);
  });

  it('paiement de commission : montant et moyen obligatoires', () => {
    const id = '6f1c2b8e-1d2a-4c5b-9e8f-0a1b2c3d4e5f';
    expect(commissionPayoutSchema.safeParse({ enrollment_id: id, amount: '10 000', method: 'orange_money' }).success).toBe(true);
    expect(commissionPayoutSchema.safeParse({ enrollment_id: id, amount: '0', method: 'orange_money' }).success).toBe(false);
  });
});

describe('Academy lot 2 — état affiché et erreurs', () => {
  it('le blocage prime sur le retard ; une inscription en attente reste « en attente »', () => {
    expect(enrollmentDisplay('active', { overdue_count: 1, blocked_since: '2027-01-13' })).toBe('blocked');
    expect(enrollmentDisplay('active', { overdue_count: 1, blocked_since: null })).toBe('overdue');
    expect(enrollmentDisplay('active', { overdue_count: 0, blocked_since: null })).toBe('active');
    expect(enrollmentDisplay('pending', { overdue_count: 1, blocked_since: null })).toBe('pending');
    expect(displayTone('blocked')).toBe('rejected');
  });

  it('nouveaux codes d’erreur traduits sans détail technique', () => {
    expect(academyErrorKey({ message: 'access_blocked' })).toBe('academy.errors.access_blocked');
    expect(academyErrorKey({ message: 'evaluation_already_passed' })).toBe('academy.errors.evaluation_already_passed');
    expect(academyErrorKey({ message: 'payout_exceeds_due' })).toBe('academy.errors.payout_exceeds_due');
  });
});

describe('Academy lot 2 — attestation', () => {
  it('numéro : format attendu, saisie normalisée', () => {
    expect(CERTIFICATE_NUMBER.test('CSC-2027-00012-7F3A')).toBe(true);
    expect(CERTIFICATE_NUMBER.test('CSC-2027-12-7F3A')).toBe(false);
    expect(normalizeCertificateNumber(' csc-2027-00012-7f3a ')).toBe('CSC-2027-00012-7F3A');
    expect(normalizeCertificateNumber(undefined)).toBe('');
  });

  it('PDF valide : en-tête, table des objets exacte, accents encodés', () => {
    const bytes = certificatePdf({
      org: 'CSC Academy',
      heading: 'Attestation de formation',
      awardedTo: 'Décernée à',
      name: 'Hélène Ngo’o (Test)',
      completed: 'pour avoir suivi et réussi la formation',
      course: 'Trading crypto — niveau débutant',
      session: 'Session de janvier · du 10/01/2027 au 10/03/2027',
      score: 'Résultat : 85 %',
      numberLabel: 'N° d’attestation',
      number: 'CSC-2027-00012-7F3A',
      issuedLabel: 'Délivrée le',
      issued: '15/03/2027',
      verifyLabel: 'Vérifiez :',
      verifyUrl: 'https://csc.example/academy/verify?n=CSC-2027-00012-7F3A',
    });
    const pdf = new TextDecoder('latin1').decode(bytes);
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    // Tout le fichier est en ASCII (accents en séquences octales).
    expect([...bytes].every((b) => b < 128)).toBe(true);
    expect(pdf).toContain('(H\\351l\\350ne Ngo\\222o \\(Test\\))');
    // Chaque entrée de la table xref pointe bien sur « n 0 obj ».
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(7);
    offsets.forEach((o, i) => expect(pdf.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it('mise en page : largeur de texte et retour à la ligne', () => {
    expect(textWidth('AAA', 'F1', 10)).toBeCloseTo(20.01, 1);
    expect(textWidth('é', 'F1', 10)).toBe(textWidth('e', 'F1', 10));
    const lines = wrapText('Analyse technique avancée des marchés financiers et gestion du risque', 'F2', 20, 300);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line) => expect(textWidth(line, 'F2', 20)).toBeLessThanOrEqual(300));
  });
});
