# Tableau de bord — plan et lot D1

*20 novembre 2026. Plan validé le 20 novembre 2026. Lot D1 : code livré **non poussé**, migration livrée **non exécutée**.*

---

## 1. Décisions validées

| Question | Décision |
|---|---|
| Qui voit les tableaux de bord ? | Les **administrateurs** seulement. Un tableau de bord personnel pour les conseillers est possible au lot D2. |
| Définition du chiffre d'affaires | L'argent réellement **encaissé** : paiements confirmés, à leur date de paiement, remboursements déduits à leur date. |
| Objectifs | **Oui**, un objectif par mois, saisi par l'admin. |
| Liste des indicateurs | Mise en place d'abord ; ajouts ou retraits ensuite, à l'usage. |

## 2. Organisation

Un nouvel onglet **« Tableau de bord »** (`/admin/dashboard`) apparaît en tête du menu Administration. Il contient six sous-onglets :

**Global · Academy · Consulting · Ambassador · Contact · Objectifs**

| Page | Rôle |
|---|---|
| **Vue d'ensemble d'un module** (existe déjà) | Le travail du jour : « que dois-je faire maintenant ? » |
| **Tableau de bord** (nouveau) | Les résultats sur une période, leur évolution, la comparaison : « comment va l'activité ? » |

**Sur chaque onglet :**
- **Période** : 7 jours, 30 jours (par défaut), 90 jours, 12 mois, ou dates libres. Elle est en heure du Cameroun et reste la même quand on change d'onglet.
- **Comparaison** : chaque chiffre de la période est comparé à la période précédente de même durée, par exemple « ↗ +18 % ». Le vert ou le rouge dépend du sens de l'indicateur : une hausse des remboursements est affichée en rouge. Une flèche accompagne toujours la couleur.
- **Indicateurs du jour** : ceux qui décrivent la situation actuelle (reste à encaisser, retards…) portent la mention « Aujourd'hui » et n'ont pas de comparaison.
- **Graphique** des 12 derniers mois. Au survol, une info-bulle donne le détail. Le tableau des valeurs exactes s'ouvre via « Voir les valeurs mois par mois ».
- **Export CSV** (Excel), avec la période et la période précédente.

L'onglet **Investissement** sera ajouté avec le module (lot D3). Ses chiffres seront marqués **DÉMO** et exclus des totaux tant que le mode démo est actif.

## 3. Indicateurs du lot D1

### Global
| Thème | Indicateurs |
|---|---|
| Argent | Encaissé net total, encaissé Academy (et sa part du total), encaissé Consulting net (et le montant remboursé), commissions versées, reste à encaisser, commissions dues |
| Graphique | Encaissements mensuels par module (Academy et Consulting empilés) |
| À traiter | Inscriptions en attente de paiement, élèves en retard, rendez-vous non payés, soumissions à vérifier, messages sans réponse, e-mails en échec ou bloqués, tâches automatiques en erreur ou en retard |
| Clients | Nouveaux comptes, clients payants, comptes devenus payants, part des inscriptions par parrainage, clients présents à la fois dans Academy et Consulting |
| Santé | E-mails en échec, tâches en erreur sur les dernières 24 h, messages sans réponse |

### Academy
| Thème | Indicateurs |
|---|---|
| Inscriptions | Nouvelles, activées, annulées ; réservations payées ; remplissage des sessions ; élèves actifs ; inscriptions en attente |
| Paiements | Encaissé ; taux de recouvrement (reçu sur échu) ; reste à encaisser ; élèves en retard et montant ; accès bloqués ; commissions versées et dues |
| Pédagogie | Présence aux visios, réussite à l'évaluation, note moyenne, attestations délivrées, replays visionnés |
| Classement | 5 meilleures formations (encaissé, inscriptions) |

### Consulting
| Thème | Indicateurs |
|---|---|
| Rendez-vous | Réservés, réalisés ; taux de confirmation ; taux d'annulation ; réservations expirées ; délai moyen de réservation ; présence en visio |
| Argent | Encaissé net et brut, remboursé, panier moyen, rendez-vous non payés en cours |
| Conseillers | Occupation (heures réservées sur heures ouvertes), délai de remise du compte rendu, comptes rendus en retard (plus de 48 h) |
| Fidélité | Clients revenus ; passage du premier échange gratuit à une offre payante |
| Classement | 5 offres les plus demandées |

### Ambassador
| Thème | Indicateurs |
|---|---|
| Activité | Ambassadeurs actifs et nouveaux ; campagnes en cours ; soumissions reçues, à vérifier ; taux de validation ; délai de traitement |
| Résultats | Inscriptions parrainées et part du total, encaissé via parrainage, gains acquis, versé et reste à verser (campagnes et commissions Academy) |
| Classement | 5 meilleurs ambassadeurs |

### Contact
- Messages reçus, sans réponse, en cours, traités.
- Délai moyen de réponse.
- Répartition par sujet.
- Graphique mensuel.

### Objectifs
L'admin fixe, pour un mois donné (le mois précédent, le mois en cours ou l'un des 3 suivants), un objectif pour chacun des indicateurs suivants :
- encaissé total ;
- encaissé Academy ;
- encaissé Consulting ;
- nouveaux comptes ;
- inscriptions Academy ;
- rendez-vous Consulting réalisés.

Chaque tableau de bord affiche une jauge par objectif du mois en cours. Un repère sur la jauge montre où l'on devrait en être à cette date. Exemple : le 15 d'un mois de 30 jours, 50 % de l'objectif est attendu. L'état est écrit en toutes lettres : « Objectif atteint », « Dans les temps » ou « En retard sur le rythme ». Chaque modification est inscrite dans le journal d'audit.

### Définitions précises
- **Encaissé** : paiements confirmés, comptés à leur date de paiement. Un paiement Consulting remboursé reste compté à sa date de paiement, puis le remboursement est déduit à sa propre date.
- **Taux de recouvrement Academy** : montant payé sur les tranches arrivées à échéance, divisé par le montant de ces tranches. Seuls les élèves actifs sont comptés.
- **Présence aux visios Academy** : présences d'élèves actifs, divisées par le nombre d'élèves actifs attendus à chaque séance passée de la période.
- **Rendez-vous réalisé** : rendez-vous confirmé dont l'heure de fin est passée.
- **Occupation des conseillers** : minutes réservées (rendez-vous confirmés), divisées par les minutes ouvertes (créneaux habituels des conseillers actifs, indisponibilités déduites).
- **Comptes devenus payants** : comptes créés sur la période ayant payé au moins une fois depuis, dans Academy ou Consulting.

## 4. Fichiers

**Base de données**
- `supabase/migrations/20261124000100_dashboard.sql` : fonctions de calcul, table `dashboard_goals`, 7 index.
- `supabase/rollbacks/20261124000100_dashboard.down.sql` : retour arrière.

**Code**
- `src/lib/dashboard/` : périodes (`period.ts`), calculs d'affichage et objectifs (`metrics.ts`), chargement des données (`data.ts`).
- `src/components/dashboard/` : graphique mensuel, cartes d'indicateurs, jauge d'objectif, choix de période, alertes, classements.
- `src/app/(app)/admin/dashboard/**` : les 6 onglets, l'enregistrement des objectifs et l'export CSV.

**Fichiers existants modifiés (ajouts uniquement)**
- `app-shell.tsx` : entrée « Tableau de bord » dans le menu Administration.
- `sub-nav.tsx` : option facultative `keepParams`, pour conserver la période d'un onglet à l'autre. Les autres onglets ne changent pas.
- `fr.json` / `en.json` : nouvelles clés seulement. Les libellés de l'export CSV restent en français dans les deux langues, sauf les en-têtes.

## 5. Base de données

**Aucune table existante n'est modifiée.** La migration ajoute :

| Élément | Rôle |
|---|---|
| `dashboard_global`, `dashboard_academy`, `dashboard_consulting`, `dashboard_ambassador`, `dashboard_contact` (date début, date fin) | Totaux d'une période, renvoyés en un seul objet. Réservées aux administrateurs ; période de 800 jours au plus. |
| `dashboard_monthly(mois)` | Évolution mois par mois (12 par défaut, 36 au plus). |
| `dashboard_set_goal(mois, indicateur, objectif)` | Saisie d'un objectif ; 0 le supprime. Journalisé. |
| Table `dashboard_goals` | Objectifs mensuels. Lecture réservée aux admins ; écriture uniquement par la fonction ci-dessus. |
| 7 index | Accélèrent les recherches par date (paiements, inscriptions, rendez-vous, comptes, soumissions, messages). |

Les calculs sont faits **dans la base** : la page ne reçoit que des totaux, jamais les lignes détaillées. Les montants restent des entiers en FCFA. Les taux sont calculés à l'affichage, à partir d'un numérateur et d'un dénominateur entiers.

## 6. Tests

| Suite | Résultat |
|---|---|
| `tests/db/dashboard.test.ts` (10 tests sur les vraies migrations, jeu de données connu) : droits (refus pour un non-admin, un visiteur ou une saisie d'objectif par un non-admin) ; contrôle des périodes ; chiffres exacts Academy, Consulting (dont heures ouvertes), Ambassador, Contact et Global ; évolution mensuelle ; objectifs (saisie, remplacement, suppression, audit, refus des valeurs invalides) ; retour arrière puis réapplication | ✅ |
| `tests/unit/dashboard.test.ts` : périodes (heure du Cameroun, raccourcis, dates libres invalides), taux, évolutions, objectifs | ✅ |
| `tests/unit/dashboard-render.test.ts` : rendu du graphique et de la jauge, thèmes clair et sombre | ✅ |
| Suite complète : 25 fichiers, **526 tests** | ✅ |
| `tsc`, `eslint`, `next build` | ✅ |

La palette du graphique (bleu `#2a78d6` / orange `#eb6834`, et leurs variantes sombres) a été vérifiée automatiquement sur les fonds blanc et bleu nuit (`#182644`) : contraste et lisibilité pour les daltoniens.

**Pas encore testé : l'affichage réel dans le navigateur.** Il faut d'abord appliquer la migration sur Supabase.

## 7. Mise en ligne

1. Dans Supabase › **SQL Editor**, collez puis exécutez `supabase/migrations/20261124000100_dashboard.sql`.
2. Répondez « c'est appliqué » : le code sera alors poussé et Vercel déploiera.
3. Ouvrez **Administration › Tableau de bord**, puis **Objectifs** pour fixer ceux du mois.

## 8. Retour arrière

- **Code** : `git revert`, puis redéploiement.
- **Base** : exécutez `supabase/rollbacks/20261124000100_dashboard.down.sql`. Seuls les objectifs saisis sont perdus ; aucune donnée métier n'est touchée.

## 9. Suite prévue

| Lot | Contenu |
|---|---|
| **D2** | Tableau de bord personnel des conseillers ; délai moyen de paiement d'une tranche Academy ; ajouts ou retraits d'indicateurs selon vos retours |
| **D3** | Onglet Investissement (marqué DÉMO), avec le module |
| Si les volumes augmentent | Totaux pré-calculés chaque nuit (pg_cron) |
