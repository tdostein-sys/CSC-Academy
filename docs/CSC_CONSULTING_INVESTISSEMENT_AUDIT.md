# CSC Consulting & CSC Investissement — Phase 0 : audit et architecture cible

*19 novembre 2026. Livrable de la Phase 0 du cahier des charges « CSC Consulting & CSC Investissement ». Aucun code ni aucune migration n'a été écrit. **En attente de votre validation** (questions au § 8).*

> Ce document remplace le brouillon `docs/CSC_CONSULTING_GA_CAHIER_DES_CHARGES.md` (v1, « Gestion d'actifs »). Le nouveau cahier des charges le complète et le dépasse : véhicule mutualisé, parts, frais 2 % / 30 %, High-Water Mark. Je propose de garder le brouillon pour l'historique, sans le mettre à jour.

---

## 1. Architecture existante

### 1.1 Technologies

| Couche | Choix actuel |
|---|---|
| Frontend + backend | **Next.js 16** (App Router, React 19, Server Components, Server Actions), TypeScript 6 |
| Interface | MUI 5 (thème Sneat), mode clair/sombre, icônes lucide, `next-intl` (fr/en), traduction automatique DeepL |
| Base de données | **Supabase PostgreSQL** : RLS sur toutes les tables, règles métier dans des fonctions `SECURITY DEFINER` |
| Authentification | Supabase Auth (JWT vérifié par `getClaims`), `src/lib/auth.ts` (`requireUser`, `requireAdmin`, `assertAdmin`) |
| Validation | `zod` côté serveur (`src/lib/validation/*`), contraintes `check` côté base |
| Fichiers | Supabase Storage, buckets **privés** (`campaign-files`, `academy-files`) ouverts par liens temporaires ; Cloudflare R2 pour les enregistrements visio (`src/lib/s3-presign.ts`) |
| Visio | LiveKit Cloud (jetons émis côté serveur, webhook `/api/livekit/webhook`) |
| Notifications | Table `notifications` + file `notification_deliveries` (e-mail Brevo/EmailJS, WhatsApp Cloud API officielle désactivée), reprise des envois en échec |
| Tâches planifiées | **1 seul cron Vercel par jour** (`/api/cron/notifications`, 6 h UTC), protégé par `CRON_SECRET` |
| PDF | Générateur maison sans dépendance (`src/lib/academy/certificate-pdf.ts`) : une page, Helvetica, encodage WinAnsi |
| Tests | Vitest : tests unitaires, et **tests SQL sur les vraies migrations** via PGlite (PostgreSQL en WebAssembly, `tests/db/harness.ts`) |
| Hébergement | Vercel (offre Hobby, `*.vercel.app`) + Supabase (offre gratuite) |

### 1.2 Base de données (11 migrations, environ 3 900 lignes SQL)

- **Socle** : `profiles` (1-1 avec `auth.users`), `user_roles` (énumération `app_role` = **`admin` uniquement**), `site_content`, `notifications`, `notification_deliveries`, `audit_log`.
- **Ambassador** : `ambassadors`, `campaigns`, `campaign_participations`, `submissions`, `payouts`.
- **Academy** : courses, sessions, installments, enrollments, `academy_payments`, extensions, meetings, resources, reminders, commission payouts, evaluations, certificates, live rooms, attendance, recordings, replays.
- **Contact** : `contact_settings`, `contact_requests`.

**Conventions établies, à conserver :**

- Montants en FCFA stockés en `bigint`, sans flottant.
- Fermeture par défaut (`revoke all`), puis ouverture explicite table par table.
- Écritures sensibles uniquement par des RPC qui vérifient le rôle et écrivent dans le journal d'audit.
- Soldes **calculés**, jamais stockés.
- Valeurs figées au premier paiement (`frozen_at`).
- Réservation temporaire (`hold_expires_at`) vérifiée au moment de la lecture, puis nettoyée par le cron.
- `audit_log` en ajout seul : un trigger interdit toute modification ou suppression.

### 1.3 Pages

- **Client** : `/dashboard`, `/academy`, `/student`, `/live/[id]`, `/ambassador`, `/notifications`, `/profile`, `/contact`.
- **Admin** : `/admin/{academy, ambassador, users, content, contact, deliveries, audit}`.
- `/consulting` et `/ga` existent déjà, mais affichent seulement « Bientôt » (`ComingSoon`).

---

## 2. Éléments réutilisables

| Besoin du cahier | Existant réutilisé |
|---|---|
| Authentification, sessions | Supabase Auth + `src/lib/auth.ts` (étendu aux nouveaux rôles) |
| Notifications internes, e-mail, WhatsApp officiel, historique | `notifications` + `notification_deliveries` + `src/lib/notifications` |
| Journal d'audit protégé | `audit_log` + `write_audit()` (enrichi, § 3) |
| Paiement enregistré par l'admin, fondations paiement en ligne | Modèle `academy_payments` (fournisseur, statut, `provider_reference` unique) |
| Réservation temporaire de 24 h | Mécanisme `hold_expires_at` d'Academy |
| Rappels sans doublon | Modèle `academy_reminders` (clé unique par type de rappel) |
| Visio avec lien sécurisé | LiveKit : jeton nominatif émis par le serveur, aucune URL publique |
| Stockage privé, liens temporaires | Supabase Storage (KYC, contrats, justificatifs, comptes rendus, relevés) |
| PDF | Générateur maison, généralisé en mise en page multi-pages (§ 5.4) |
| Textes éditables + traduction | `site_content`, DeepL |
| Interface | Composants `table-card`, `filter-pills`, `search-form`, `stat-card`, `status-badge`, `confirm-dialog`, `action-form`, `markdown` |
| Tests financiers reproductibles | Banc PGlite : les calculs écrits en SQL sont testés sur les vraies migrations |

---

## 3. Éléments existants à modifier (tous non destructifs)

1. **Rôles** — ajouter `manager` (gestionnaire), `advisor` (conseiller) et `supervisor` (superviseur) à l'énumération `app_role`. Ajouter les fonctions `has_role(role)` et `is_staff()`, et étendre `SessionUser` avec la liste des rôles.
   - « Client » reste implicite : c'est tout compte connecté.
   - `is_admin()` ne change pas : Ambassador et Academy ne sont pas touchés.
   - Retour arrière : une valeur d'énumération ne peut pas être retirée simplement. Le script de retour arrière retire donc les attributions de rôle et les fonctions ; la valeur reste en base, inutilisée et sans effet.
2. **`audit_log`** — ajouter des colonnes facultatives `reason`, `old_value`, `new_value` et `ip_address`, ainsi qu'une variante `write_audit_ex(...)`. Les lignes existantes ne changent pas.
3. **Cron** — séparer la route actuelle :
   - `/api/cron/daily` pour Academy (inchangé) ;
   - une route **horaire** pour les rappels à 1 h, l'expiration à 24 h et les envois (voir le risque R3).
4. **Navigation** — remplacer les pages `ComingSoon` de `/consulting` et `/ga` (qui devient `/invest`, avec une redirection depuis `/ga`) ; ajouter des entrées dans `/admin`.
5. **Générateur PDF** — extraire le moteur de `certificate-pdf.ts` dans `src/lib/pdf/` (texte qui passe à la ligne, plusieurs pages, petits caractères, en-tête et pied de page). L'attestation Academy le réutilise sans changement visible ; un test garantit qu'elle reste identique.

Aucune table existante n'est renommée ni supprimée, et aucune colonne existante n'est modifiée.

---

## 4. Nouvelles tables proposées

Chaque migration est **nouvelle, non exécutée, appliquée par vous**, et accompagnée d'un script de retour arrière `supabase/rollbacks/<migration>.down.sql`. Ce sera une nouveauté : les migrations précédentes n'en ont pas.

### Phase 1 — Fondations communes

| Table | Rôle |
|---|---|
| `risk_questionnaires` | Versions du questionnaire : statut brouillon/publié/archivé, seuils des 4 profils, validité (12 mois par défaut) |
| `risk_questions`, `risk_question_options` | Questions pondérées et réponses notées, liées à une version **figée dès sa publication** |
| `risk_assessments` | Résultat de chaque questionnaire rempli : réponses figées (jsonb), score, profil, version, date et expiration. Aucune modification possible |
| `legal_documents`, `legal_document_versions` | CG, politique de confidentialité et fiches de formule : n° de version, rubriques (les 22 du § 5.1), statut, dates de création, de publication et d'entrée en vigueur, auteur, historique. Une version publiée est **figée** |
| `legal_acceptances` | Client, version, date et heure, objet concerné (souscription ou réservation), adresse IP, navigateur, **empreinte SHA-256 du texte accepté** |
| `generated_documents` | Archive commune : contrats, relevés, comptes rendus. Pour chaque document : type, propriétaire, chemin privé, empreinte SHA-256, données figées qui ont servi à le produire. Une réédition renvoie **le même fichier** |
| `platform_settings` | Mode **`demo`/`live`** du module Investissement (§ 6), paramètres généraux |
| `job_runs` | Une ligne par exécution de tâche planifiée (`job` + `run_key` unique) : tâches idempotentes, échecs signalés |

### Phase 2 — CSC Consulting

| Table | Rôle |
|---|---|
| `consulting_offers` | Titre, description, catégorie, durée, prix en FCFA, mode (visio, téléphone, présentiel), statut, conditions |
| `consulting_availability_rules`, `consulting_unavailabilities` | Créneaux habituels par conseiller (jour de la semaine et horaires, fuseau Africa/Douala) et exceptions |
| `consulting_bookings` | Offre (prix et durée figés à la réservation), conseiller, client, plage horaire (`tstzrange`), statut (6 états du cahier), `hold_expires_at`. Une **contrainte `EXCLUDE USING gist`** rend tout chevauchement impossible pour un même conseiller (extension `btree_gist`, disponible sur Supabase et dans PGlite) |
| `consulting_payments` | Référence (unique), montant, devise, date, mode, statut, justificatif, fournisseur, saisi par, vérifié par |
| `consulting_booking_events` | Historique des changements d'état : créé, payé, expiré, annulé, déplacé, remboursé |
| `consulting_reminders` | Rappels J-1 et H-1, avec une clé unique qui empêche les doublons |
| `consulting_reports`, `consulting_report_files` | Comptes rendus et pièces jointes. Chaque consultation est journalisée |

### Phase 3 — Investissement : souscriptions et contrats

| Table | Rôle |
|---|---|
| `investor_profiles` | Personne physique ou entreprise : identité, adresse, pays, nationalité, dénomination, RCCM, représentant |
| `kyc_documents` | Type, fichier privé, statut, vérifié par, motif |
| `investment_formulas`, `formula_versions` | La formule et ses **conditions versionnées** : montants min/max, durées autorisées, devise, frais (2 % et 30 % par défaut, configurables), fréquence de cristallisation, HWM oui/non, modalités de sortie. Une souscription pointe vers **une version figée** |
| `formula_return_disclosures` | Rendements affichés, avec un type obligatoire : historique, moyen observé, objectif, estimation, contractuel. Pour chacun : période, méthode, brut ou net, frais inclus ou non, avertissement, version |
| `receiving_channels` | Comptes ou canaux autorisés pour recevoir des fonds |
| `subscriptions`, `subscription_events` | Numéro unique, investisseur, version de formule, montant, durée, dates, **12 statuts** et historique commenté |
| `contracts` | Référence unique, souscription, version des CG, document généré (empreinte), preuves d'acceptation et de signature |
| `fund_receipts` | Montant attendu ou reçu, date, référence, canal, devise, justificatif, saisi par, vérifié par, statut (6 états). **Seul un encaissement « vérifié » finance une souscription** |

### Phase 4 — Moteur financier

| Table | Rôle |
|---|---|
| `vehicles` | Véhicule d'investissement : devise de référence, valeur initiale de la part, mode, statut |
| `ledger_accounts`, `ledger_entries`, `ledger_lines` | **Journal en partie double** : chaque écriture est équilibrée par devise (vérifié par un trigger). Les comptes séparent les actifs du véhicule, les sommes dues aux investisseurs et les revenus propres de CSC (§ 19) |
| `instruments`, `price_quotes`, `fx_rates` | Actifs (actions, ETF, crypto…), cours et taux de change avec **source, date et heure**. Un prix trop ancien est signalé périmé ; une donnée manquante n'est jamais inventée |
| `investment_operations` | Achat, vente, dividende, coupon, frais, ajustement… Statut `saisie → à valider → validée` ; une opération validée ne peut **plus être modifiée ni supprimée** (trigger) ; une correction passe par une écriture d'annulation `reverses_id` avec un motif. Au-delà d'un seuil, la validation par une **autre personne** (superviseur) est obligatoire |
| `valuations`, `valuation_lines` | Valeur nette datée : actifs, trésorerie, créances, dettes, charges à payer, anomalies, statut de validation |
| `unit_lots`, `unit_transactions` | Parts de chaque investisseur, par souscription. Les parts sont **calculées** à partir de la valeur de part validée (émission, rachat, cristallisation), jamais saisies à la main |
| `fee_accruals` | Frais de gestion courus par période : assiette, nombre de jours, taux. Clé unique (véhicule, période), donc pas de double calcul |
| `performance_fee_crystallizations` | Commission de performance par lot à la date de cristallisation : HWM avant et après, gain éligible, commission |
| `withdrawal_requests`, `repayments` | Demandes de retrait (6 statuts) et remboursements : capital, résultat, frais, retenues, net à payer, référence et justificatif **obligatoires pour passer à « payé »** |

### Phase 5 — Reporting

`statements` (relevés trimestriels, archivés dans `generated_documents`), `maturity_alerts` (alertes J-30, J-7, jour J et retard ; délais configurables), et des vues de pilotage calculées uniquement à partir de données validées.

---

## 5. Recommandations d'architecture

### 5.1 Les calculs financiers en SQL (`numeric`), testés sur PGlite
C'est le prolongement de la règle déjà en place (« les règles sont garanties par la base ») :

- Les calculs de valeur de part, de frais, de HWM et de remboursement sont des fonctions PostgreSQL en `numeric`, sans flottant binaire.
- Le serveur Next.js les appelle ; le frontend ne fait qu'afficher.
- Les jeux de test du § 34 deviennent des tests PGlite reproductibles.

**Précision des nombres :**
- montants en `numeric(24,6)`, arrondis à l'unité de la devise au règlement (FCFA = 0 décimale) ;
- quantités d'actifs en `numeric(38,18)` (crypto) ;
- parts en `numeric(24,8)`, valeur de part en `numeric(24,8)`, taux en `numeric(9,6)`.

**Règle d'arrondi :** au demi supérieur, documentée et testée.

### 5.2 Méthodes de calcul proposées (à valider par votre juriste ou expert-comptable)

- **Frais de gestion** : `Valeur nette avant frais × 2 % × jours / 365`, courus à chaque valorisation validée et prélevés à une date configurable. L'assiette est la valeur nette, pas les dépôts cumulés.
- **Commission de performance, ordre de calcul** :
  1. actifs ;
  2. revenus ;
  3. plus- ou moins-values réalisées ;
  4. plus- ou moins-values latentes ;
  5. charges ;
  6. frais de gestion ;
  7. puis seulement la commission, sur la **performance nette des frais**.
- **HWM par lot de souscription** : chaque souscription garde sa propre référence (sa valeur de part d'entrée, puis la plus haute valeur de part après une cristallisation).
  - La commission est égale à 30 % × (valeur de part − HWM du lot) × nombre de parts, si le résultat est positif.
  - Elle est payée par **annulation de parts** du lot.
  - Résultat : un nouvel entrant ne paie pas la performance des anciens, et une perte doit être rattrapée avant toute nouvelle commission.
  - Les apports et les retraits changent le nombre de parts, pas la valeur de part : ils ne sont donc jamais comptés comme un gain.

### 5.3 Contrats figés et réédition à l'identique
- À la génération, on enregistre :
  - le PDF dans le stockage privé ;
  - son empreinte SHA-256 ;
  - les données qui l'ont produit.
- « Rééditer » renvoie ce fichier, dont l'empreinte est vérifiée.
- Le recto présente les conditions particulières ; le verso les CG de la version acceptée, en petits caractères sur deux colonnes, 7 points.

### 5.4 Génération PDF
Je recommande de **généraliser le générateur maison**. Ses avantages :
- aucune dépendance ;
- il fonctionne déjà sur Vercel ;
- les accents sont pris en charge.

Il faut y ajouter le retour à la ligne, la pagination, les tableaux simples et les colonnes. Si la mise en page des relevés se révèle trop lourde, l'alternative est la bibliothèque `pdf-lib`, petite et sans binaire.

### 5.5 Signature électronique
La case à cocher reste une **acceptation**, présentée comme telle. Je propose d'y ajouter un **code à usage unique envoyé par e-mail**, enregistré avec l'heure, l'adresse IP et l'empreinte du document : c'est une signature électronique « simple », jamais présentée comme qualifiée. Une signature avancée ou qualifiée passerait par un prestataire (voir Q6).

### 5.6 Paiements
- Comme pour Academy, l'admin enregistre les paiements, avec la référence et le justificatif.
- Une saisie au-delà d'un seuil est vérifiée par une deuxième personne.
- Un retour de navigateur n'est **jamais** une preuve de paiement.
- Les fondations restent prêtes pour un fournisseur en ligne : webhook signé, confirmation côté serveur.

### 5.7 Contrôle d'accès
Tout passe par la RLS et des RPC qui vérifient le rôle. Un test vérifie, pour chaque table, qu'un client ne peut lire que ses propres lignes, même en changeant un identifiant. La séparation des tâches est garantie par la base : on ne peut pas valider sa propre saisie.

---

## 6. Mode démonstration (obligatoire avant toute validation juridique)

Le réglage `platform_settings.investment_mode` vaut **`demo` par défaut**. En mode démo :

- Un bandeau permanent s'affiche : « Environnement de démonstration — aucune collecte de fonds, aucune offre au public ».
- Aucun compte de réception de fonds n'est affiché aux clients.
- Les encaissements sont marqués `demo` et exclus de tout indicateur réel.
- Les contrats portent la mention filigrane « SPÉCIMEN — sans valeur contractuelle ».

**Passage en `live`** :
- uniquement par un admin **et** un superviseur (deux personnes distinctes) ;
- avec saisie de la référence de la validation juridique obtenue ;
- et journalisation.

**Aucun numéro d'agrément ni statut juridique n'est inventé** : ces champs restent vides tant que vous ne les renseignez pas.

---

## 7. Risques techniques

| # | Risque | Mesure proposée |
|---|---|---|
| R1 | **Réglementaire** : la collecte et la gestion collective de fonds sont réglementées (COSUMAF / CEMAC) | Mode démo par défaut (§ 6) ; phases 3 et 4 en test uniquement |
| R2 | **Vercel Hobby** est réservé à un usage non commercial, et Supabase gratuit n'a **pas de sauvegarde automatique** (la base se met aussi en pause après 7 jours d'inactivité) | Avant la mise en ligne réelle : Vercel Pro et Supabase Pro (sauvegardes quotidiennes, restauration à un instant donné). D'ici là, sauvegarde `pg_dump` planifiée et procédure de restauration testée (Phase 6) |
| R3 | Le cron Vercel Hobby tourne **une fois par jour** : trop peu pour le rappel à 1 h et l'expiration à 24 h | Utiliser **`pg_cron` + `pg_net`** de Supabase (disponibles en offre gratuite) pour appeler une route protégée toutes les 15 min. En attendant, l'expiration est aussi vérifiée à la lecture (comme Academy), donc un créneau expiré n'est jamais bloqué |
| R4 | L'équité entre investisseurs dans un véhicule mutualisé (HWM, entrées et sorties) | HWM par lot (§ 5.2), validé par un expert ; jeux de test du § 34 |
| R5 | Les données de marché : aucune source automatique n'est branchée | V1 : cours saisis avec leur source, et contrôle de péremption. Flux automatiques plus tard, source par source |
| R6 | La séparation des tâches suppose **au moins deux personnes** | Sinon, la validation à deux niveaux est impossible : voir Q2 |
| R7 | Le volume de la phase 4 (moteur financier) | La livrer en 3 lots testés : journal et opérations ; valorisation et parts ; frais, HWM et remboursements |
| R8 | Les données personnelles et KYC dans Supabase gratuit (stockage de 1 Go) | Buckets privés, liens de 5 min, durée de conservation à définir (Q9) |

---

## 8. Plan de développement et questions à valider

### 8.1 Plan par étapes (chacune livrée avec sa migration non exécutée, son script de retour arrière, ses tests et le livrable du § 37)

| Étape | Contenu | Environnement |
|---|---|---|
| **1a** | Rôles, audit enrichi, `job_runs`, cron toutes les 15 min, moteur PDF généralisé | Production possible |
| **1b** | Questionnaire de risque, CG et politique de confidentialité versionnées, acceptation | Production possible |
| **2a** | Consulting : offres, disponibilités, réservation (contrainte d'exclusion), paiement enregistré, expiration 24 h | Production possible |
| **2b** | Consulting : rappels J-1 et H-1, visio LiveKit, comptes rendus, accès journalisés | Production possible |
| **3** | Investissement : formules versionnées, dossier investisseur et KYC, souscription en 5 étapes, contrat PDF recto/verso, encaissements | **Démo uniquement** |
| **4a / 4b / 4c** | Journal et opérations à double validation / valorisation et parts / frais, HWM, retraits et remboursements | **Démo uniquement** |
| **5** | Tableau de bord investisseur, pilotage admin, relevés trimestriels, graphiques, exports, alertes | Démo, puis production après validation juridique |
| **6** | Recette complète (fonctionnelle, financière, sécurité), sauvegarde et restauration, documentation | — |

Consulting peut ouvrir au public dès l'étape 2 (sous réserve de Q1). Investissement reste en démo.

### 8.2 Questions à trancher

1. **Agrément Consulting** : CSC est-elle autorisée à faire du conseil en investissement ? Sinon, faut-il présenter l'offre comme de la « formation » ou de l'« accompagnement » ? Cela conditionne l'ouverture publique de l'étape 2.
2. **Équipe** : combien de personnes au départ, et qui aura quels rôles (admin, gestionnaire, conseiller, superviseur) ? La double validation demande **au moins 2 personnes**.
3. **Ordre** : commencer par 1a, 1b puis Consulting (2a, 2b), comme proposé ?
4. **Méthode HWM par lot de souscription**, avec cristallisation annuelle : d'accord pour la proposer à votre juriste ou expert-comptable ?
5. **Seuil de double validation** des opérations et des encaissements : à partir de quel montant ? Ou toujours ?
6. **Signature** : case à cocher + code par e-mail (« signature électronique simple ») pour commencer, ou un prestataire de signature dès le départ ?
7. **Devises** : le FCFA seulement pour les souscriptions, avec des actifs en USD, EUR ou USDT convertis ? Ou des souscriptions dans plusieurs devises ?
8. **Plan d'hébergement** : d'accord pour passer à Vercel Pro et Supabase Pro avant l'ouverture réelle (R2) ? En attendant, j'ajoute une sauvegarde planifiée.
9. **Conservation des données** : combien de temps garder les dossiers KYC refusés ou abandonnés ? Le délai légal pour les dossiers acceptés est à confirmer avec le juriste.
10. **Consulting** : les choix du brouillon v1 restent-ils valables ? Pour rappel : premier échange gratuit, annulation jusqu'à 24 h avant, pas d'enregistrement des séances, commission ambassadeur à préciser.
