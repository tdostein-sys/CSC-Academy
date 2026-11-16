# Plateforme CSC — Crypto Sans Complexe

Application web unique (FR / EN) regroupant les activités de CSC :

| Module | État |
|---|---|
| **Socle** (comptes, rôles, thèmes, notifications, audit) | ✅ Étape 1 |
| **CSC Ambassador** (ambassadeurs, campagnes, soumissions, paiements) | ✅ Étape 2 |
| **CSC Academy** (formations, inscriptions, paiements Notch Pay) | ⏳ Étape 3 |
| **CSC Consulting / CSC GA** | Page « Bientôt disponible » + proposition (étape 4) |

Stack : **Next.js 16** (App Router, TypeScript) · **Supabase** (PostgreSQL, Auth, Storage) · **Tailwind CSS 4** · **next-intl** · **Zod** · e-mails via **Brevo** ou **EmailJS**.

---

## 1. Prérequis

- Node.js **22.13 ou plus** (`node -v`)
- Un projet [Supabase](https://supabase.com) (offre gratuite suffisante pour démarrer)
- Un compte [Brevo](https://www.brevo.com) (recommandé) **ou** [EmailJS](https://www.emailjs.com)

## 2. Installation

```bash
npm install
cp .env.example .env.local     # Windows : copy .env.example .env.local  (copier, ne pas renommer)
```

Puis renseignez `.env.local` (voir § 3).

> **Poste Windows d'entreprise** : si `npm install` échoue sur un paquet `esbuild`, c'est que la politique de sécurité du poste bloque son exécutable. Le projet n'en a pas besoin (le seed utilise le support TypeScript natif de Node).

## 3. Variables d'environnement

Toutes sont documentées dans [.env.example](.env.example). Résumé :

| Variable | Où la trouver | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL de l'application (`http://localhost:3000` en local) | non |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › API Keys › *publishable* (ou *anon*) | non |
| `SUPABASE_SECRET_KEY` | Supabase › API Keys › *secret* (ou *service_role*) | **OUI** |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | à choisir | **OUI** (mot de passe) |
| `EMAIL_PROVIDER` | `brevo`, `emailjs` ou `console` | non |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Brevo › SMTP & API | **OUI** (clé) |
| `EMAILJS_*` | EmailJS › Account / Email Services / Templates | **OUI** (clé privée) |
| `WHATSAPP_ENABLED` | `false` tant que WhatsApp n'est pas branché | non |
| `DEEPL_API_KEY` | [DeepL API Free](https://www.deepl.com/pro-api) (traduction automatique, voir § 7 bis) | **OUI** |
| `CRON_SECRET` | chaîne aléatoire longue (`openssl rand -hex 32`) | **OUI** |

⚠️ Les variables `NEXT_PUBLIC_*` sont visibles dans le navigateur : n'y mettez jamais de secret. `SUPABASE_SECRET_KEY` contourne la sécurité de la base ; elle n'est utilisée que côté serveur.

## 4. Configuration de Supabase

### 4.1 Appliquer les migrations

Les migrations SQL versionnées sont dans [supabase/migrations/](supabase/migrations/). Deux options :

**A. Éditeur SQL (le plus simple)** : Supabase › SQL Editor › collez le contenu de chaque fichier **dans l'ordre des noms** et exécutez.

| Fichier | Contenu |
|---|---|
| `20261116000100_core.sql` | profils, rôles, contenus, notifications, audit |
| `20261116000200_ambassador.sql` | ambassadeurs, campagnes, soumissions, soldes, paiements, bucket Storage `campaign-files` |
| `20261116000300_content_translation.sql` | langue de saisie des contenus (traduction automatique) |
| `20261116000400_delivery_queue.sql` | file d'envoi des messages aux ambassadeurs (supervision, relance des échecs) |
| `20261116000500_payout_confirmation.sql` | clôture bloquée tant que les paiements ne sont pas confirmés ; état de paiement par ID |
| `20261116000600_participation_lock.sql` | impossible de ne plus participer après avoir soumis un ID (en attente ou validé) |

Chaque fichier ne s'applique **qu'une seule fois** (ne relancez pas un fichier déjà exécuté).

**B. Supabase CLI** :
```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

### 4.2 Authentification (Supabase › Authentication)

1. **URL Configuration**
   - *Site URL* : la valeur de `NEXT_PUBLIC_SITE_URL`
   - *Redirect URLs* : ajoutez `http://localhost:3000/auth/confirm` (et l'URL de production + `/auth/confirm`)
2. **Sign In / Providers › Email** : activé, *Confirm email* activé (recommandé).
3. **Emails › SMTP Settings** — **fortement recommandé** : le serveur d'e-mails par défaut de Supabase est limité à quelques e-mails par heure. Branchez le SMTP de Brevo (gratuit) :
   - Host `smtp-relay.brevo.com`, port `587`
   - Identifiant et mot de passe : Brevo › SMTP & API › onglet SMTP
   - Expéditeur : votre adresse vérifiée dans Brevo
4. **Emails › Templates** (recommandé, pour que les liens fonctionnent même ouverts sur un autre appareil) :
   - *Confirm signup* : remplacez le lien par
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   - *Reset password* : remplacez le lien par
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

## 5. E-mails de l'application (notifications)

Les notifications (campagne lancée, soumission validée…) passent par une couche [lib/notifications/](lib/notifications/) : chaque notification est **enregistrée dans l'application** (centre de notifications) et **mise en file** pour l'envoi par e-mail. Un envoi qui échoue est réessayé automatiquement (2, 4, 8, 16 min… jusqu'à 5 tentatives).

### Brevo (recommandé)
Offre gratuite : **300 e-mails/jour** (≈ 9 000/mois), contre 200/mois pour EmailJS.
1. Créez un compte Brevo, vérifiez une adresse expéditrice (Senders, Domains & Dedicated IPs). Idéalement, authentifiez votre propre domaine (SPF/DKIM) pour éviter les spams ; une adresse Gmail comme expéditeur est souvent filtrée.
2. SMTP & API › onglet **API Keys** › *Generate a new API key*. ⚠️ La clé API commence par `xkeysib-`. Ne pas confondre avec la clé **SMTP** (`xsmtpsib-…`, onglet SMTP), qui ne sert qu'au réglage SMTP de Supabase (§ 4.2) : avec elle, Brevo répond `401 Key not found`.
3. `.env.local` : `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY=…`, `BREVO_SENDER_EMAIL=…`

### EmailJS (alternative)
1. Account › Security : cochez **« Allow EmailJS API for non-browser applications »**.
2. Créez un service e-mail, puis **un modèle générique** :
   - *To Email* : `{{to_email}}` — *Subject* : `{{subject}}`
   - *Content* (HTML) : `{{{message_html}}}` (triple accolades : HTML déjà échappé par l'application)
3. `.env.local` : `EMAIL_PROVIDER=emailjs` + les 4 variables `EMAILJS_*`.

### Développement
`EMAIL_PROVIDER=console` affiche les e-mails dans le terminal au lieu de les envoyer.

### WhatsApp
Canal prévu dans [lib/notifications/channels.ts](lib/notifications/channels.ts), **désactivé** (`WHATSAPP_ENABLED=false`). Pour l'activer plus tard : compte WhatsApp Business + WhatsApp Cloud API (Meta), modèles de messages approuvés, puis renseigner `WHATSAPP_PHONE_NUMBER_ID` et `WHATSAPP_ACCESS_TOKEN`.

### Reprise des envois (cron)
Appelez périodiquement (ex. toutes les 5 minutes) :
```
GET /api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```

## 6. Premier administrateur (seed)

Après avoir appliqué les migrations et renseigné `SEED_ADMIN_*` :
```bash
npm run seed:admin
```
- Crée l'utilisateur `csc_admin` (e-mail `SEED_ADMIN_EMAIL`) avec le rôle administrateur.
- Le mot de passe (`SEED_ADMIN_PASSWORD`, 12 caractères min. avec lettres et chiffres) doit être **changé à la première connexion** : l'application l'impose.
- Le script est **idempotent** (relançable sans risque). Pour réinitialiser le mot de passe : `npm run seed:admin -- --reset-password`.
- Vous pouvez ensuite **vider `SEED_ADMIN_PASSWORD`** de `.env.local`.

Connexion : `/auth/login` avec `csc_admin` **ou** l'adresse e-mail.

## 7. CSC Ambassador — fonctionnement

**Côté ambassadeur** (`/ambassador`)
1. L'utilisateur lit la charte et clique sur **« D'accord »** (profil complet exigé) : il reçoit un badge et un numéro séquentiel `CSC-AMB-0001`, jamais réutilisé.
2. À chaque campagne lancée, il est notifié (application + e-mail). Sur la page de la campagne : vidéo (chargée seulement au clic), mode opératoire (texte et/ou fichier), choix **Je participe / Je ne participe pas** (modifiable tant que la campagne est ouverte). Chaque ouverture est comptée **une seule fois** par ambassadeur.
3. S'il participe, il **déclare des comptes** : ID Binance (unique sur toute la plateforme) + volume de trading (≥ minimum de la campagne s'il existe). Il peut retirer une déclaration encore en attente.
4. Il suit ses gains (**toujours calculés** à partir des comptes validés et des paiements) et **confirme la réception** de chaque paiement.

**Côté admin** (`/admin/ambassador`)
- Tableau de bord : ambassadeurs, soumissions à traiter, total dû / payé, paiements non confirmés, **exports CSV** (soumissions, soldes, paiements, ambassadeurs).
- **Campagnes** : brouillon → **lancer** (exige modop + vidéo ; le montant et le volume minimum sont alors **figés**) → **clôturer**. La clôture est **refusée par la base** (et le bouton reste grisé) tant qu'il reste des soumissions en attente, un montant dû non payé, ou un paiement dont l'ambassadeur n'a **pas confirmé la réception**. Un ID validé n'est considéré comme « Payé » qu'après cette confirmation (sinon : « Payé, réception à confirmer »).
- **Soumissions** : valider, ou rejeter avec un motif (visible par l'ambassadeur). Une soumission rejetée peut être supprimée (action auditée), ce qui libère l'ID Binance.
- **Paiements** : depuis la campagne, bouton « Payer » par ambassadeur (paiements partiels possibles, jamais au-delà du dû ; moyen + référence).
- **Ambassadeurs** : recherche, suspension avec motif (l'ambassadeur garde l'accès à ses gains et paiements), réactivation.
- **File d'envoi** : chaque message envoyé aux ambassadeurs (destinataire, type, objet, canal, statut, tentatives, dernière erreur, lu ou non dans l'application), avec compteurs et filtres. Boutons **« Traiter la file maintenant »** (envoie ce qui est en attente — utile tant que le cron n'est pas planifié) et **« Réessayer »** (un envoi ou tous les échecs, action auditée).

Toutes ces actions sont **vérifiées côté serveur** (fonctions SQL `SECURITY DEFINER` + RLS) et **journalisées** dans l'audit.

**Fichiers de mode opératoire** : bucket Storage privé `campaign-files` (créé par la migration ; PDF, PNG, JPEG, WebP ; 5 Mo max). Les ambassadeurs y accèdent par des liens temporaires (1 h), uniquement pour les campagnes lancées.

## 7 bis. Traduction automatique des contenus

L'admin rédige chaque contenu (campagne : titre, résumé, mode opératoire ; charte ambassadeur) **une seule fois**, dans la langue de son choix (« Langue de saisie »). À l'enregistrement, l'application le traduit automatiquement dans l'autre langue avec **DeepL** et stocke les deux versions : le sélecteur « Langue » affiche ensuite la bonne version instantanément, sans appel externe.

Mise en place :
1. Créez un compte sur [deepl.com/pro-api](https://www.deepl.com/pro-api) › offre **DeepL API Free** (500 000 caractères/mois gratuits ; une carte bancaire peut être demandée pour vérification, sans prélèvement).
2. Compte › *API Keys* : copiez la clé (elle se termine par `:fx`) dans `DEEPL_API_KEY`.

Sans clé (ou si le quota est atteint), le contenu est enregistré dans sa langue d'origine et s'affiche ainsi pour tous ; un message le signale à l'admin. Il suffit de l'enregistrer à nouveau plus tard pour le traduire. La structure Markdown (titres, listes) est préservée : seul le texte de chaque ligne est traduit.

## 8. Lancer l'application

```bash
npm run dev        # développement : http://localhost:3000
npm run build && npm start   # production locale
```

## 9. Qualité et tests

```bash
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # Vitest
npm run check      # les quatre, plus le build
```

Les tests SQL ([tests/db/](tests/db/)) s'exécutent **sans Docker** : ils lancent PostgreSQL en WebAssembly (PGlite), reproduisent l'environnement Supabase (schéma `auth`, rôles `anon` / `authenticated`, privilèges par défaut) et appliquent les **vraies migrations**. Ils vérifient la RLS et les règles métier sous l'identité de chaque rôle.

Les tests unitaires ([tests/unit/](tests/unit/)) couvrent la validation des formulaires, les modèles de notifications, les fournisseurs d'e-mail, l'export CSV (dont la protection contre l'injection de formules), les liens vidéo, la parité des traductions FR/EN et le **contraste WCAG AA** des thèmes clair et sombre.

Règles critiques d'Ambassador testées sur la base ([tests/db/ambassador.test.ts](tests/db/ambassador.test.ts)) : **calcul du solde**, **unicité de l'ID Binance**, **blocage de la clôture**, paiement plafonné au dû, montant figé au lancement, vue comptée une fois, numérotation, et **accès par rôle** (visiteur, ambassadeur, ambassadeur suspendu, admin).

## 10. Sécurité — principes

- **RLS activée sur toutes les tables** ; les privilèges par défaut de Supabase sont révoqués puis rouverts au cas par cas.
- Les actions sensibles passent par des **fonctions SQL `SECURITY DEFINER`** qui vérifient elles-mêmes le rôle (jamais uniquement l'interface), et par des actions serveur qui revalident tout avec Zod.
- Le rôle administrateur est stocké dans `user_roles`, **non modifiable** par un utilisateur.
- **Journal d'audit** en ajout seul (toute modification ou suppression est refusée par un trigger).
- Redirections après connexion limitées aux chemins internes (pas de redirection ouverte).
- Le message d'erreur de connexion ne révèle pas si un compte existe.

## 11. Arborescence

```
app/                 pages (App Router) et actions serveur
  auth/              connexion, inscription, mots de passe, /auth/confirm
  ambassador/        espace ambassadeur (charte, campagnes, déclarations, paiements)
  admin/             administration (vue d'ensemble, Ambassador, utilisateurs, contenus, envois, audit)
  api/cron/          tâches planifiées
components/          composants d'interface
i18n/, messages/     langues (fr par défaut, en)
lib/                 logique serveur : supabase, auth, notifications, e-mail, validation
proxy.ts             session Supabase + garde des routes (ex-middleware)
scripts/             seed de l'administrateur
supabase/migrations/ migrations SQL versionnées
tests/               tests unitaires et SQL
docs/                propositions (Consulting / GA — étape 4)
```

## 12. Déploiement

Hébergement recommandé : **Vercel** (compatible avec tout hébergeur Next.js).

1. **Code** : le dépôt GitHub (privé) contient le code, **jamais** `.env.local` (exclu par `.gitignore`).
2. **Vercel** › *Add New › Project* › importer le dépôt (Next.js détecté automatiquement). Avant *Deploy*, dans *Environment Variables*, reporter les variables de `.env.local` (voir § 3) :
   - `NEXT_PUBLIC_SITE_URL` = l'URL publique (ex. `https://csc.example.com`), **pas** `localhost` ;
   - Supabase, Brevo (`EMAIL_PROVIDER=brevo`, clé `xkeysib-`), `DEEPL_API_KEY`, `CRON_SECRET` ;
   - les variables `SEED_ADMIN_*` sont inutiles en ligne.
   Ensuite, chaque `git push` sur `main` redéploie automatiquement.
3. **Supabase** › Authentication › URL Configuration : *Site URL* = l'URL publique ; *Redirect URLs* : ajouter `https://<url-publique>/**`. Toutes les migrations (§ 4.1) doivent être appliquées. Recommandé : un **projet Supabase distinct pour la production** (migrations + `npm run seed:admin` avec les clés de ce projet).
4. **Domaine** (facultatif) : Vercel › Settings › Domains, puis les entrées DNS indiquées. Dans Brevo, authentifier ce domaine (SPF/DKIM) et utiliser une adresse expéditrice de ce domaine.
5. **Cron** : [vercel.json](vercel.json) planifie `/api/cron/notifications` **une fois par jour** (limite de l'offre Vercel gratuite ; Vercel transmet automatiquement `CRON_SECRET`). Pour une reprise toutes les 5 minutes : passer `schedule` à `*/5 * * * *` avec l'offre Pro, ou programmer un appel sur [cron-job.org](https://cron-job.org) avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

Coûts à prévoir : l'offre Vercel *Hobby* est réservée à un usage non commercial (offre *Pro* pour CSC) ; un projet Supabase gratuit est mis en pause après une semaine d'inactivité (offre *Pro* conseillée en production, avec sauvegardes).
