# Plateforme CSC — Crypto Sans Complexe (version thème Sneat)

Reconstruction **fonctionnellement identique** de la plateforme CSC (projet de référence `c:\ProjetAC\CSC`) avec le design et les composants du template **Sneat (MUI)**. Elle est branchée sur **la même base Supabase en ligne** et **le même compte Brevo** que l'application d'origine.

| Module | État |
|---|---|
| **Socle** (comptes, rôles, langue FR/EN, thèmes clair/sombre, notifications, audit, administration) | ✅ |
| **CSC Ambassador** (charte, campagnes, déclarations d'ID, soldes, paiements, file d'envoi, exports CSV) | ✅ |
| **CSC Academy** (formations) | ✅ lots 1, 2 et 3 livrés et appliqués (formations, paiements, rappels, commissions, évaluation, attestations, visio intégrée) ([cahier des charges](docs/CSC_ACADEMY_CAHIER_DES_CHARGES.md)) |
| **CSC Consulting / CSC GA** | page « Bientôt disponible » |

Stack : **Next.js 16** (App Router, TypeScript, Turbopack) · **React 19** · **MUI 5** + thème Sneat · **Supabase** (PostgreSQL, Auth, Storage) · **next-intl** · **Zod** · e-mails **Brevo** (ou EmailJS) · traduction **DeepL** · tests **Vitest** + **PGlite**.

---

## ⚠️ À lire en premier : la base est partagée et déjà migrée

- **Ne lancez AUCUNE migration** et ne créez, modifiez ou supprimez aucune table, vue, fonction, politique ou bucket. La base en ligne est celle de l'application CSC d'origine : elle est déjà à jour.
- **Pas de seed** : l'administrateur `csc_admin` existe déjà (pas de script `seed:admin` dans ce projet).
- Les fichiers de [supabase/migrations/](supabase/migrations/) sont une **copie pour documentation et tests locaux** (ils servent aux tests SQL, exécutés sur une base en mémoire). Toute évolution future du schéma se fera par une **nouvelle** migration, appliquée **à la main** dans Supabase par un responsable, jamais automatiquement.
- **Aucun test n'écrit dans la base en ligne.**

### Migrations CSC Academy à appliquer (une seule fois chacune, dans l'ordre)

| Fichier | Contenu | État |
|---|---|---|
| [20261118000100_academy.sql](supabase/migrations/20261118000100_academy.sql) | Lot 1 : formations, sessions, inscriptions, paiements, contenus, bucket privé `academy-files` | ✅ appliqué |
| [20261119000100_academy_lot2.sql](supabase/migrations/20261119000100_academy_lot2.sql) | Lot 2 : blocage J+3, rappels, commissions, évaluation finale, attestations | ✅ appliqué |
| [20261120000100_academy_lot3.sql](supabase/migrations/20261120000100_academy_lot3.sql) | Lot 3 : salles de visio, présences, enregistrements (suppression à 7 jours) | ✅ appliqué |

Ces fichiers **ne modifient aucune table existante** : ils ajoutent des tables, vues et fonctions `academy_*`. Le lot 2 remplace en plus, par une version étendue, la fonction d'accès aux contenus (blocage J+3), la vue des soldes (colonne `blocked_since` ajoutée) et la fonction appelée après chaque paiement (délivrance de l'attestation).

1. Relire le fichier.
2. Supabase › **SQL Editor** › *New query* › coller **tout** le contenu › *Run*.
3. Vérifier dans *Table Editor* que les nouvelles tables apparaissent (lot 2 : `academy_evaluations`, `academy_questions`, `academy_certificates`…).

Tant que le lot 2 n'est pas appliqué, les nouvelles pages (évaluation, commissions, attestations) restent vides ou affichent une erreur générique ; le reste de l'application fonctionne normalement.

## 1. Prérequis

- Node.js **22.13 ou plus** (`node -v`)
- npm (le projet n'utilise pas yarn)
- Les accès existants : projet Supabase, compte Brevo, clé DeepL (facultative)

## 2. Installation

```powershell
cd c:\ProjetAC\Template-main
npm install
copy .env.example .env.local      # copier, ne pas renommer
```

Puis renseignez `.env.local` (voir § 3). Le `.env.local` de l'application CSC d'origine fonctionne **tel quel** (mêmes noms de variables).

> **Poste Windows d'entreprise** : si `npm install` échoue sur un paquet `esbuild`, c'est la politique de sécurité du poste qui bloque son exécutable ; le projet n'en a pas besoin. Docker n'est pas nécessaire non plus.

## 3. Variables d'environnement

Toutes sont documentées dans [.env.example](.env.example) (fichier sans aucune valeur). Résumé :

| Variable | Où la trouver | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL de l'application (`http://localhost:3000` en local) | non |
| `DEV_ALLOWED_ORIGINS` | nom du PC si le serveur de dev est ouvert par ce nom (dev uniquement) | non |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › API Keys › *publishable* (ou *anon*) | non |
| `SUPABASE_SECRET_KEY` | Supabase › API Keys › *secret* (ou *service_role*) | **OUI** |
| `EMAIL_PROVIDER` | `brevo`, `emailjs` ou `console` (vide = `console`) | non |
| `EMAIL_FROM_NAME` | nom d'expéditeur affiché | non |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Brevo › SMTP & API › API Keys (clé `xkeysib-…`) | **OUI** (clé) |
| `EMAILJS_*` | EmailJS (alternative à Brevo) | **OUI** (clé privée) |
| `WHATSAPP_*` | désactivé (`WHATSAPP_ENABLED` vide ou `false`) | **OUI** (jeton) |
| `DEEPL_API_KEY` | [DeepL API Free](https://www.deepl.com/pro-api) (clé `…:fx`) | **OUI** |
| `LIVEKIT_URL` | [LiveKit Cloud](https://cloud.livekit.io) › projet › Settings › Project (`wss://…livekit.cloud`) | non |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit › Settings › Keys | **OUI** |
| `RECORDINGS_S3_ENDPOINT`, `RECORDINGS_S3_BUCKET` | Cloudflare › R2 (`https://<compte>.r2.cloudflarestorage.com`, `csc-academy-recordings`) | non |
| `RECORDINGS_S3_ACCESS_KEY_ID`, `RECORDINGS_S3_SECRET_ACCESS_KEY` | R2 › Manage API tokens (*Object Read & Write*, limité au bucket) | **OUI** |
| `CRON_SECRET` | chaîne aléatoire longue (`openssl rand -hex 32`) | **OUI** |

Règles :
- Les variables `NEXT_PUBLIC_*` sont visibles dans le navigateur : **jamais de secret dedans**.
- `SUPABASE_SECRET_KEY` contourne la sécurité de la base : elle n'est lue que par du code serveur (`server-only`).
- `.env.local` est exclu de Git (`.gitignore`) : ne le partagez jamais (ni par e-mail, ni sur une messagerie).

## 4. Supabase : seul réglage à vérifier

Rien à créer. **Si l'adresse de l'application change** (nouveau PC, nom de machine, domaine de production), ajoutez-la dans Supabase › **Authentication › URL Configuration** :
- *Site URL* : la valeur de `NEXT_PUBLIC_SITE_URL` ;
- *Redirect URLs* : `<url>/**` (ex. `http://localhost:3000/**`, `https://csc.example.com/**`).

Sans cela, les liens des e-mails (confirmation d'inscription, mot de passe oublié) ne fonctionnent pas.

## 5. Lancer l'application

```powershell
npm run dev                  # développement : http://localhost:3000
npm run build; npm start     # production locale
```

- Un visiteur qui ouvre l'application arrive directement sur **« Se connecter / Créer un compte »**.
- Connexion administrateur : `csc_admin` (ou son adresse e-mail) avec son mot de passe actuel.
- Si vous ouvrez le serveur de dev par le **nom du PC** (et non `localhost`), ajoutez ce nom dans `DEV_ALLOWED_ORIGINS` et l'URL dans Supabase (§ 4).

## 6. Fonctionnement

### Socle
- **Langue** : français par défaut, bascule complète en anglais (cookie `NEXT_LOCALE` ; enregistrée dans le profil, elle fixe aussi la langue des e-mails).
- **Thème** : bouton soleil / lune dans la barre du haut ; tant qu'on n'a pas choisi, le thème suit celui de l'appareil.
- **Comptes** : inscription (e-mail de confirmation), connexion par identifiant ou e-mail, mot de passe oublié, changement imposé si nécessaire. Les messages d'erreur ne révèlent jamais si un compte existe.
- **Mon espace**, **Profil**, **Notifications** (centre de notifications + e-mails).
- **Administration** (`/admin`) : vue d'ensemble, utilisateurs, contenus (charte ambassadeur), envois, journal d'audit.

### CSC Ambassador
**Côté ambassadeur** (`/ambassador`) : lecture de la charte et bouton « D'accord » (profil complet exigé) → badge `CSC-AMB-0001` ; campagnes en cours (vidéo chargée au clic, mode opératoire, choix « Je participe / Je ne participe pas » modifiable tant qu'aucun ID n'est soumis) ; déclaration d'ID Binance + volume ; suivi des gains et **confirmation de réception** des paiements.

**Côté admin** (`/admin/ambassador`) : vue d'ensemble et **exports CSV** ; campagnes (brouillon → lancer → clôturer ; la clôture reste grisée, avec la liste des blocages, tant qu'il reste des soumissions en attente, un montant dû ou un paiement non confirmé) ; soumissions (valider, rejeter avec motif, supprimer un rejet) ; paiements (partiels possibles) ; ambassadeurs (suspendre avec motif, réactiver) ; file d'envoi (traiter maintenant, réessayer).

### CSC Academy (lot 1)
**Catalogue** (`/academy`, visible sans compte) : formations publiées, sessions ouvertes, prix, échéancier, places restantes. **Inscription** (compte et profil complets exigés) avec **code de parrainage** facultatif, pré-rempli par un lien `/academy?ref=CSC-AMB-0001` : la place est réservée **3 jours**, puis libérée automatiquement si aucun paiement n'est reçu.

**Espace étudiant** (`/student`) : état de chaque inscription, échéancier (tranches payées, partielles, en retard, délais accordés), paiements reçus, instructions de paiement ; une fois le premier paiement enregistré : séances (bouton « Rejoindre » 15 min avant), documents PDF (liens temporaires), liens de cours, vidéos YouTube / TikTok / Vimeo / Google Drive chargées au clic. Une inscription sans paiement peut être annulée ; ensuite, ni remboursement ni désistement.

**Côté admin** (`/admin/academy`) : formations (brouillon → publiée → archivée), sessions (dates, places, taux de commission, instructions de paiement), **échéancier** (1 à 12 tranches, figé dès le premier paiement), ouverture / fermeture des inscriptions, **enregistrement des paiements** (partiels possibles, jamais au-delà du reste dû), délais, annulation d'une inscription non payée, séances (lien de visio externe en attendant la visio intégrée), documents, liens et vidéos ; listes des inscrits et des paiements. Les étudiants et les admins sont prévenus par notification et e-mail.

### CSC Academy (lot 2)
**Rappels et blocage** : chaque matin, la tâche planifiée envoie les rappels de paiement (e-mail + notification) **3 jours avant** la date limite d'une tranche et **le jour même**, puis, **3 jours après** une tranche impayée, **bloque l'accès** (séances, documents, liens, vidéos, évaluation) et prévient l'étudiant. Le blocage est calculé par la base à chaque accès : il est levé **immédiatement** dès que le paiement est enregistré ou qu'un délai est accordé. Chaque rappel n'est envoyé qu'une fois.

**Commissions des ambassadeurs** : pourcentage du prix (taux de la session, figé à l'inscription), **dû une fois la formation entièrement payée**. L'ambassadeur voit ses parrainages dans son espace (prénom + initiale, formation, avancement du paiement) et son lien de parrainage ; ses commissions s'ajoutent à ses gains. Côté admin : `/admin/academy/commissions` (« Payer », historique, export CSV) ; l'ambassadeur confirme la réception comme pour les campagnes.

**Évaluation finale** (`/admin/academy/sessions/<id>/evaluation`) : questionnaire à choix unique ou multiple, seuil de réussite et nombre de tentatives fixés par l'admin, correction automatique **par la base** (les bonnes réponses ne sont jamais envoyées aux étudiants). Questions et seuil figés dès la première copie rendue.

**Attestation** : délivrée **automatiquement** quand l'évaluation est réussie **et** la formation entièrement payée ; PDF téléchargeable dans l'espace étudiant, numéro unique non devinable (`CSC-2027-00012-7F3A`). **Page publique de vérification** : `/academy/verify`. L'admin peut retirer une attestation (motif obligatoire) depuis `/admin/academy/certificates`.

### CSC Academy (lot 3) : visio intégrée
**Séances** : par défaut, chaque séance utilise la visio intégrée (LiveKit). Un lien externe (Meet, Zoom…) reste possible : il remplace alors la visio intégrée pour cette séance.

**Animateur (admin)** : bouton « Animer la séance » sur la page de la session (`/live/<séance>`). La salle s'ouvre **à partir d'une heure avant** le début ; l'**enregistrement démarre automatiquement**. Dans la salle : caméra, micro, **partage d'écran** ; liste des participants avec les mains levées dans l'ordre d'arrivée ; « Donner la parole » (micro), « Autoriser la caméra », « Couper tous les micros » ; « Terminer la séance » déconnecte tout le monde et arrête l'enregistrement.

**Étudiant** : « Rejoindre » apparaît 15 minutes avant le début, **seulement s'il est inscrit, à jour (non bloqué)**. Il entre micro et caméra coupés, peut **lever la main** et écrire dans la **discussion** ; un mode « audio seul » économise les données mobiles. Les droits sont imposés par le serveur LiveKit (jeton signé par notre serveur, après vérification par la base) : impossible d'allumer sa caméra sans autorisation, même en bricolant le navigateur.

**Enregistrements** : stockés dans **Cloudflare R2** (bucket privé, hors Supabase, sans frais de visionnage). Replay visible par les inscrits à jour pendant **7 jours**, par un lien temporaire (2 h) ; ensuite le fichier est **effacé** par la tâche quotidienne (et, en filet de sécurité, par la règle de suppression à 7 jours du bucket). L'admin peut supprimer un enregistrement plus tôt. Présences : nombre d'étudiants entrés, affiché par séance.

**À la mise en ligne** : LiveKit › Settings › **Webhooks** › ajouter l'adresse `https://<votre-site>/api/livekit/webhook` (signée avec vos clés LiveKit). Sans elle tout fonctionne, mais un replay n'apparaît qu'au passage de la tâche quotidienne au lieu de quelques minutes après la séance.

Paiement en ligne : pas encore branché, mais la base distingue déjà les paiements « en cours / confirmés / échoués » et propose deux fonctions réservées au serveur pour l'ajouter plus tard.

Toutes les règles sensibles sont **dans la base** (fonctions SQL `SECURITY DEFINER` + RLS) : chaque action est vérifiée une première fois par l'action serveur (rôle + validation Zod), puis par la base. Les confirmations passent par une boîte de dialogue intégrée.

### Traduction automatique
Chaque contenu (campagne, charte) est saisi **une seule fois**, dans la langue choisie (« Langue de saisie ») ; DeepL produit l'autre version à l'enregistrement. Sans clé ou sans quota, le contenu reste dans sa langue d'origine et un message le signale.

## 7. Qualité et tests

> Lancez les tests depuis **PowerShell** (`Set-Location C:\ProjetAC\Template-main`). Depuis Git Bash, une différence de casse de la lettre de lecteur (`c:` / `C:`) fait échouer Vitest.

```powershell
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest (tests unitaires + tests SQL)
npm run check       # tout, plus le build
```

- **Tests SQL** ([tests/db/](tests/db/)) : PostgreSQL en WebAssembly (PGlite), **en mémoire, sans Docker**, sur une copie locale des migrations. Ils vérifient la RLS et les règles d'Ambassador (calcul des soldes, unicité de l'ID Binance, blocage de la clôture, paiements plafonnés, accès par rôle) et d'Academy (places, réservation de 3 jours, code de parrainage, échéancier figé, paiements plafonnés, accès aux contenus réservé aux inscrits actifs, blocage J+3 et déblocage, rappels envoyés une seule fois, commissions, correction du questionnaire, attestation et vérification publique). Ils ne touchent **jamais** la base en ligne.
- **Tests unitaires** ([tests/unit/](tests/unit/)) : validation des formulaires, notifications, fournisseurs d'e-mail, export CSV, liens vidéo, questionnaire et PDF de l'attestation, parité des traductions FR/EN et **contraste WCAG AA** des thèmes clair et sombre (dont le menu latéral).

## 8. Arborescence

```
src/
  app/
    (app)/            pages dans le cadre Sneat (menu latéral + barre du haut)
      ambassador/     espace ambassadeur
      academy/        catalogue des formations, inscription, ouverture des PDF, vérification des attestations
      student/        espace étudiant (mes formations, évaluation finale, attestation PDF)
      admin/          administration (dont admin/ambassador et admin/academy)
      dashboard/, profile/, notifications/, consulting/, ga/
    auth/             connexion, inscription, mots de passe, /auth/confirm
    api/cron/         tâche planifiée quotidienne (notifications, rappels et blocage Academy)
  @core/theme/        thème Sneat (palette, typographie, composants) ; couleurs dans tokens.ts
  components/         composants d'interface (cadre, formulaires, cartes, tableaux…)
  i18n/, messages/    langues (fr par défaut, en)
  lib/                logique serveur : supabase, auth, notifications, e-mail, traduction, validation
  proxy.ts            session Supabase + garde des routes
supabase/migrations/  copie des migrations (documentation + tests locaux, NE PAS EXÉCUTER)
tests/                tests unitaires et SQL
public/               logo (versions claire et sombre), illustrations
```

## 9. Déploiement (Vercel)

1. **Code** : dépôt GitHub privé, **sans** `.env.local`.
2. **Vercel** › *Add New › Project* › importer le dépôt. Dans *Environment Variables*, reporter les variables de `.env.local` (§ 3), avec `NEXT_PUBLIC_SITE_URL` = l'URL publique (pas `localhost`) et `EMAIL_PROVIDER=brevo`. `DEV_ALLOWED_ORIGINS` est inutile en ligne.
3. **Supabase** › Authentication › URL Configuration : ajouter l'URL publique (§ 4). Seules migrations à appliquer à la main : celles d'Academy (voir en haut de ce fichier).
4. **Cron** : [vercel.json](vercel.json) appelle `/api/cron/notifications` une fois par jour à 6 h UTC, soit 7 h au Cameroun (Vercel transmet `CRON_SECRET`). C'est cette tâche qui envoie les rappels de paiement Academy, libère les places non payées et efface les enregistrements de plus de 7 jours.
   **LiveKit** › Settings › Webhooks : ajouter `https://<votre-site>/api/livekit/webhook` (voir « CSC Academy (lot 3) »).
5. **Domaine** (facultatif) : Vercel › Settings › Domains ; dans Brevo, authentifier ce domaine (SPF/DKIM).

## 10. Sauvegarde du template d'origine

Le template Sneat d'origine, intact, est conservé dans `c:\ProjetAC\Template-main.original-backup`.
