# CSC Consulting — lot C1 : livrable

*20 novembre 2026. Phases 2a et 2b du plan (`docs/CSC_CONSULTING_INVESTISSEMENT_AUDIT.md`). Code livré **non poussé** ; migration livrée **non exécutée**.*

---

## 1. Résumé

Le module **CSC Consulting** est opérationnel de bout en bout :

1. offres de conseil configurables ;
2. réservation d'un créneau réellement libre ;
3. paiement enregistré par l'administrateur ;
4. confirmation ;
5. rappels ;
6. visio intégrée en tête-à-tête ;
7. compte rendu confidentiel remis au client.

Les règles métier sont garanties **par la base de données**, comme pour Academy :

- **Créneau unique** : un même créneau ne peut jamais être réservé deux fois. Une contrainte d'exclusion PostgreSQL le garantit, même en cas de clics simultanés.
- **Réservation de 24 h** : un rendez-vous payant non réglé garde son créneau 24 h, puis le créneau est libéré automatiquement.
- **Paiement vérifié** : seul un paiement enregistré par l'admin confirme le rendez-vous, au montant exact et avec une référence unique.
- **Lectures tracées** : chaque lecture d'un compte rendu est inscrite dans le journal d'audit.

## 2. Fonctionnalités

| Pour qui | Fonctionnalités |
|---|---|
| **Visiteur** | Catalogue des offres (`/consulting`) et fiche d'une offre, avec un avertissement sur les risques. |
| **Client** | Choix d'un jour puis d'une heure, avec un message facultatif. Instructions de paiement, numéro `RDV-000123` à indiquer, date limite. Annulation ou report jusqu'à 24 h avant. Bouton de visio 15 min avant. Compte rendu et documents joints. Historique (`/consulting/bookings`). |
| **Conseiller** | « Consultations » (`/consulting/manage`) : uniquement ses rendez-vous, avec les coordonnées du client. Salle de visio dès 1 h avant. Rédaction du compte rendu (brouillon, pièces jointes, publication). |
| **Administrateur** | `/admin/consulting` : vue d'ensemble, offres, conseillers, disponibilités hebdomadaires et indisponibilités, paiements, réglages. Sur chaque rendez-vous : paiement avec justificatif, report, annulation et remboursement. |
| **Automatique** | Expiration des réservations non payées et avis au client. Rappels la veille et 1 h avant, au client et au conseiller. Chaque exécution est journalisée dans `job_runs`. |

Les notifications (dans l'application et par e-mail) sont envoyées à chaque étape :

- réservation ;
- confirmation ;
- annulation ;
- report ;
- expiration ;
- rappels ;
- compte rendu publié ;
- remboursement.

### Choix faits sans vous demander (modifiables)

- **Conseillers** : une table `consulting_advisors`, sans toucher au rôle `admin` existant. L'admin peut s'ajouter lui-même comme conseiller.
- **Paiement** : le paiement est **intégral**, au montant exact ; pas de paiement en plusieurs fois.
- **Paiement tardif** : il réactive un rendez-vous expiré, si le créneau est encore libre.
- **Remboursement** : il n'est possible qu'après l'annulation du rendez-vous. La base refuse l'inverse.
- **Visio** : aucune séance n'est enregistrée. Le client et le conseiller publient tous deux caméra, micro et partage d'écran.
- **Comptes rendus** : ils sont rédigés dans une seule langue, sans traduction (document personnel). Ils sont **figés une fois publiés**.
- **Réglages par défaut** (dans *Réglages*) :
  - délai de paiement : 24 h ;
  - annulation ou report : jusqu'à 24 h avant ;
  - délai minimal de réservation : 24 h ;
  - horizon : 30 jours ;
  - intervalle entre deux créneaux : 30 min.
- **Pièces jointes et justificatifs** : 4 Mo maximum. Vercel limite les envois à 4,5 Mo.

## 3. Fichiers

**Base de données**

- `supabase/migrations/20261123000100_consulting.sql`
- `supabase/rollbacks/20261123000100_consulting.down.sql`

**Code serveur**

- `src/lib/consulting/` : types, erreurs, notifications, tâches planifiées, créneaux, visio
- `src/lib/validation/consulting.ts`
- `src/lib/cron.ts`

**Pages**

- `src/app/(app)/consulting/**` : client et conseiller
- `src/app/(app)/admin/consulting/**` : administration
- `src/app/api/cron/frequent/route.ts`

**Composants**

- `src/components/consulting/` : sélecteur de créneaux, statut, fiche de rendez-vous

**Fichiers existants modifiés (ajouts uniquement)**

- `auth.ts` : ajout de `isAdvisor` et `requireConsultingStaff`.
- `routes.ts` : nouvelles pages protégées.
- Menu latéral et page d'accueil : Consulting n'est plus « Bientôt ».
- `notifications/templates.ts` : 12 nouveaux modèles.
- `stat-card.tsx` : 2 icônes.
- `fields.tsx` : `defaultChecked` facultatif.
- `cron/notifications` : ajout du volet Consulting.
- `fr.json` / `en.json` : nouvelles clés seulement.
- `tests/db/harness.ts` : chargement de `btree_gist`.

## 4. Tables (toutes nouvelles)

| Domaine | Tables |
|---|---|
| Réglages et conseillers | `consulting_settings`, `consulting_advisors` |
| Offres et disponibilités | `consulting_offers`, `consulting_availability`, `consulting_unavailabilities` |
| Rendez-vous et paiements | `consulting_bookings`, `consulting_booking_events`, `consulting_payments`, `consulting_reminders` |
| Comptes rendus | `consulting_reports`, `consulting_report_files` |
| Tâches planifiées | `job_runs` |

La migration crée aussi :
- la vue `consulting_booking_details` ;
- l'espace de stockage privé `consulting-files` ;
- l'extension `btree_gist`.

**Aucune table existante n'est modifiée.**

## 5. Tests

| Suite | Résultat |
|---|---|
| Tests de base de données (`tests/db/consulting*.test.ts`, 23 tests sur les vraies migrations) : créneaux, double réservation refusée par la base, chevauchement client, offre unique, paiement (montant, référence réutilisée, réactivation, créneau repris), expiration et avis unique, annulation (délais, droits), remboursement, report, visio (fenêtres, rôles), rappels sans doublon, comptes rendus (droits, journalisation, gel), cloisonnement client / conseiller, retour arrière puis réapplication | ✅ |
| Tests unitaires (`tests/unit/consulting.test.ts`) : heures du Cameroun, règles affichées, validations, messages d'erreur | ✅ |
| Suite complète : 22 fichiers, **502 tests** | ✅ |
| `tsc`, `eslint`, `next build` | ✅ |

**Non testé à ce stade : l'utilisation réelle dans le navigateur.** La migration doit d'abord être appliquée sur Supabase. À vérifier après l'étape 6.1 : le parcours complet, la visio sur deux appareils, et la réception des e-mails.

## 6. Mise en ligne

### 6.1 Appliquer la migration
Dans Supabase › **SQL Editor**, collez puis exécutez `supabase/migrations/20261123000100_consulting.sql`.

### 6.2 Planifier la tâche toutes les 15 minutes
L'offre gratuite de Vercel n'autorise qu'**un cron par jour**. Le rappel « 1 h avant » a donc besoin d'un autre déclencheur : **Supabase pg_cron**, disponible dans l'offre gratuite.

1. Dans Supabase › **Database › Extensions**, activez `pg_cron` et `pg_net`.
2. Dans **SQL Editor**, exécutez le script ci-dessous. Remplacez `<CRON_SECRET>` par la valeur de `.env.local` (la même que sur Vercel). Le secret est rangé dans le coffre chiffré de Supabase (Vault), pas dans le texte de la tâche.

```sql
select vault.create_secret('<CRON_SECRET>', 'csc_cron_secret');

select cron.schedule(
  'csc-consulting-frequent',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://csc-academy-woad.vercel.app/api/cron/frequent',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'csc_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
```

3. Vérifiez : dans `/admin/consulting`, l'alerte « tâches automatiques » disparaît après le premier passage. Les exécutions sont visibles dans la table `job_runs`.

En attendant, le cron quotidien existant (6 h UTC) fait le même travail une fois par jour. De plus, un créneau non payé est libéré dès son échéance, même si la tâche n'est pas encore passée.

### 6.3 Pousser le code
Une fois la migration appliquée, poussez le code : `git push`, puis Vercel déploie. Aucune nouvelle variable d'environnement n'est nécessaire : la visio réutilise les clés LiveKit d'Academy.

### 6.4 Première configuration (administrateur)
1. **Disponibilités** : ajoutez-vous comme conseiller (votre e-mail CSC et le nom affiché aux clients), puis vos créneaux habituels.
2. **Réglages** : saisissez les **instructions de paiement** (numéros Orange Money / MTN MoMo, bénéficiaire).
3. **Offres** : créez les offres, puis **publiez-les**. Par exemple : « Premier échange », 30 min, gratuit, réservable une fois par client.
4. Faites un essai avec un compte client de test : réservation, paiement enregistré, rappel, visio, compte rendu.

## 7. Retour arrière

- **Code** : revenir au commit précédent (`git revert`), puis redéployer.
- **Base** : ⚠ cette opération est **destructive**, car elle efface les données Consulting. Procédez dans cet ordre :
  1. faites une sauvegarde ;
  2. videz le stockage `consulting-files` ;
  3. exécutez `supabase/rollbacks/20261123000100_consulting.down.sql`.

  Le journal d'audit est conservé. Le test `tests/db/consulting-rollback.test.ts` vérifie que ce script fonctionne et que la migration peut ensuite être réappliquée.
- **Tâche planifiée** : `select cron.unschedule('csc-consulting-frequent');`

## 8. Risques restants

| Risque | Mesure |
|---|---|
| **Réglementaire** (question 1 de l'audit) : le conseil en investissement peut exiger un agrément COSUMAF | Avertissement affiché sur le catalogue et chaque offre. À valider avec un juriste avant l'ouverture publique. Un intitulé « accompagnement » est possible. |
| **Hébergement** : Vercel Hobby (usage non commercial) et pas de sauvegarde automatique avec Supabase gratuit | Passer aux offres payantes avant l'ouverture commerciale (question 8 de l'audit). |
| Le **paiement en ligne** n'est pas branché | L'admin enregistre les paiements vérifiés. La structure (fournisseur, référence fournisseur unique) est prête pour un webhook signé. |
| **Notifications WhatsApp** | Elles restent désactivées tant que l'API officielle WhatsApp Cloud n'est pas configurée. Les e-mails et notifications internes sont actifs. |
