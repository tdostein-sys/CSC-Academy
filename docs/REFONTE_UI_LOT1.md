# Refonte UI — Lot 1 : fondations

*20 novembre 2026. Mission : `C:\ProjetAC\CSC\docs\PROMPT_REFONTE_UI_CSC.md`. Aucune modification du schéma Supabase.*

## 1. Thème « Premium FinTech »

| Élément | Fichier | Ce qui change |
|---|---|---|
| Couleurs | `src/@core/theme/tokens.ts` | Valeurs de la mission dans les deux thèmes : 3 niveaux de surface, statuts sur fonds teintés, menu marine (avec une bordure droite en sombre), or réservé aux distinctions. |
| Couleur d'action | `src/@core/theme/brand.ts` | **Une ligne** : `BRAND = 'emerald'`. Passer à `'blue'` bascule toute l'application (contrastes testés pour les deux). |
| Polices | `src/@core/theme/fonts.ts` | **Une ligne par police** : Plus Jakarta Sans pour les titres et les montants, Inter pour l'interface. Elles sont auto-hébergées par next/font. |
| Échelle de texte | `typography/index.ts` | h1 26 px / 700 ; h2 17 px / 600 ; corps 15/14 px ; légende 13 px ; étiquette 11 px en majuscules (seul usage autorisé). |
| Composants MUI | `overrides/csc.ts` (appliqué après Sneat) | Boutons en casse normale, sans ombre, 44 px de haut (40 px en petit). Cartes à plat avec bordure 1 px et rayon 16. Pastilles 24 px. Champs de rayon 10, avec une bordure d'erreur de 1,5 px. En-têtes de tableau en 12 px. Onglets et zones tactiles de 44 px. |
| Global | `theme-provider.tsx` | Chiffres tabulaires partout ; anneau de focus de 2 px ; icônes Lucide au trait 1,75 ; **animations désactivées** sous `prefers-reduced-motion`. |
| Couleurs en dur | — | Les 34 couleurs écrites en dur ont été retirées (visio, réactions, graphiques, accueil, notifications…). L'illustration de la page d'erreur est remplacée par une tuile d'icône. |
| Majuscules forcées | — | Retirées des pastilles, des en-têtes de tableau et des libellés de chiffres clés. |

Le test `tests/unit/theme-contrast.test.ts` vérifie **toutes les paires texte/fond en AA (4,5:1)** dans les deux thèmes, ainsi que les deux préréglages de couleur.

**À savoir.** L'émeraude de la maquette (`#0A7F5A`) sur sa teinte claire (`#E7F5EF`) donne 4,46:1. C'est suffisant pour une icône (seuil de 3:1), mais pas pour du texte. Les textes posés sur ce fond teinté utilisent donc la nuance foncée `#08694A` (6:1) ; les pastilles le font automatiquement.

## 2. Navigation

- **Source unique du menu** : `src/lib/navigation.ts`. Elle sert au menu latéral et au tiroir mobile, et servira à la barre basse du Lot 3.
- **Membre** : Vue d'ensemble · *Mes activités* (Academy, Ambassador, Consulting, Gestion d'actifs grisé avec le badge or « Bientôt », jamais tronqué) · *Compte* (Notifications avec le nombre de non lues, Profil & sécurité). Les administrateurs ont en plus leur groupe « Administration ». **Visiteur** : Accueil, Nos activités, Contact.
- **Entrée active** : elle le reste sur toutes les sous-pages du module, par exemple Academy sur `/academy/…` et `/student/…`.
- **Encart « Besoin d'aide ? »** en bas du menu : horaires lun–sam 8 h–18 h, lien WhatsApp (numéro saisi dans `/admin/contact`) et lien vers la page Contact.
- **Barre du haut** : pleine largeur, opaque, avec une bordure basse ; le contenu ne défile plus « dessous ». Le bouton « Mon espace » (doublon) est retiré. Sur ordinateur : langue, thème, cloche, avatar et prénom. Sur mobile : cloche et avatar ; la langue et le thème passent dans le menu de l'avatar.
- **Onglets internes**, sans aucune nouvelle adresse :
  - Academy : « Catalogue » (`/academy`) et « Mes formations » (`/student`) ;
  - Consulting : « Offres » et « Mes rendez-vous », plus « Consultations » pour les conseillers.
- **Conteneur de page unique** (`PageContainer`) : largeur maximale de 1200 px, marges de 32 px sur ordinateur et 16 px sur mobile, pour toutes les pages.
- **Fil d'Ariane** (`PageHeader breadcrumbs`) sur les fiches formation, inscription, offre, rendez-vous et campagne. Il remplace les anciens boutons « ← Retour ».
- **Retour selon l'origine**. Depuis le catalogue, le bouton « Accéder à ma formation » ouvre `/student/[id]?from=catalogue&course=<id>`. Le fil d'Ariane ramène alors à la fiche de la formation ; sans origine, il mène à « Mes formations ».
  - Sécurité : seule la valeur `catalogue` est acceptée, et seulement si l'identifiant correspond bien à la formation de l'inscription. Le lien de retour est reconstruit par le serveur, jamais recopié depuis l'adresse.
  - Le bouton retour du navigateur fonctionne normalement.
- La pastille « Utilisateur » (rôle implicite) n'est plus affichée ; « Ambassadeur » reste.

## 3. Chargements

- **Squelettes** (`loading.tsx`) qui reprennent la forme de la page. Ils s'affichent dès le clic, sans attendre le serveur, sur : fiche formation, inscription, offre, rendez-vous, Ambassador, campagne, vue d'ensemble, notifications, et une forme générique pour toutes les autres pages.
- **Barre de progression** fine en haut de l'écran : elle démarre au clic sur un lien et s'arrête quand la page est affichée. Elle est faite maison, sans dépendance.

### Rapport sur la lenteur (3 à 7 s par page)

| Cause | Constat | Correction |
|---|---|---|
| **Serveur loin de la base** | Vercel exécutait le site aux **États-Unis** (`iad1`, valeur par défaut) alors que Supabase est à **Francfort** (`eu-central-1`). Chaque requête à la base faisait un aller-retour transatlantique (environ 90 à 100 ms), et une page en fait plusieurs. | `vercel.json` : `"regions": ["fra1"]` (Francfort). C'est probablement le gain le plus important. |
| Requêtes en cascade | `/student/[id]` : **5 allers-retours successifs** vers la base. | Ramenés à **2** (tout ce qui ne dépend que de l'inscription, puis ce qui dépend de la session). |
| | `/academy/[id]` : 3 allers-retours. | Ramenés à **1**. |
| | `/consulting/bookings/[id]` et la fiche campagne : 2 à 3. | Ramenés à 1 ou 2. |
| | Cadre de l'application : la lecture du numéro WhatsApp aurait ajouté un aller-retour. | Lancée en parallèle de la session. |
| Aucun retour visuel | L'ancienne page restait affichée pendant le chargement. | Squelettes et barre de progression (ci-dessus). |

Après la mise en ligne, Vercel › Settings › Functions doit afficher la région **Frankfurt (fra1)**. Sur l'offre Hobby, une seule région est possible, ce qui convient ici.

## 4. Contenus

- **Programme de formation** (`lib/academy/program.ts`, testé). Le texte saisi « Chapitre 1 Introduction… 1h Chapitre 2… 1.5h » devient une **liste numérotée** : numéro dans une pastille, titre, durée à droite (« 1 h 30 » et non « 1.5h »), avec en en-tête « 8 chapitres · 14 h ».
  - Formats reconnus : « Chapitre/Module/Partie/Séance N », listes « 1. », « 1) », « - ».
  - Durées reconnues : « 1h », « 1,5 h », « 1h30 », « 90 min », « 2 heures ».
  - Si le texte n'est pas reconnu, il s'affiche comme avant.
  - Le formulaire admin donne le format conseillé.
- **Fiche formation, utilisateur inscrit** : encadré vert avec un vrai bouton **« Accéder à ma formation »**.
- **Campagne** : le résumé et le mode opératoire ne sont plus affichés s'ils répètent le titre (cas « Organisation Master class Binance » ×3).
- **Titres** : aucun texte n'est mis en majuscules par le code. Le formulaire de formation affiche une aide « majuscule au début seulement ».

## 5. À corriger dans l'administration (données, pas du code)

| Où | Quoi |
|---|---|
| Admin › Academy › Formations | « ECOSYSTEME CRYPTO & UTILISATION DE BINANCE » → « Écosystème crypto & utilisation de Binance ». « Formation en Trading et investissement dans les Marchés Financier. » → « Trading et investissement sur les marchés financiers ». |
| Admin › Academy › Formations › Programme | Réécrire si besoin un chapitre par ligne, avec sa durée, pour profiter de la liste numérotée (sinon le texte reste affiché tel quel). |
| Admin › Academy › Session › Instructions de paiement | Supprimer « Veuillez contacter l'admin par mail via l'onglet "contact" pour effectuer un paiement » : elle contredit le bouton WhatsApp. Le parcours de paiement unifié arrive au Lot 2. |
| Admin › Consulting › Offres | Coquille : « Vous avez de l'argent et vous avez de quelqu'un… » → « …et besoin de quelqu'un pour vous accompagner… ». |
| Admin › Ambassador › Campagne « Master class Binance » | La vidéo affiche « Revolut — Domination silencieuse » : vérifier l'URL. Le PDF « Mode opératoire » est un fichier de test (un CV) : le remplacer. |
| Admin › Contact | Renseigner le numéro WhatsApp : l'encart « Besoin d'aide ? » l'utilise. |

## 6. Vérifications

**Automatiques**
- `tsc`, `eslint` et `next build` passent sans erreur.
- Les 28 fichiers de tests passent. Les nouveaux portent sur : les contrastes AA des deux thèmes et des deux couleurs, le menu (entrées, entrée active sur les sous-pages), le retour selon l'origine (y compris le refus des adresses arbitraires), le parseur de programme et les textes répétés.

**À vérifier par vous** (1440, 768 et 390 px ; clair et sombre) :
1. Menu : 7 entrées, encart d'aide, badge or « Bientôt » non tronqué, entrée active sur les sous-pages ; tiroir sur mobile.
2. Barre du haut opaque ; sur mobile, cloche et avatar seulement, avec la langue et le thème dans le menu de l'avatar.
3. Boutons et pastilles en casse normale ; cartes à plat ; polices Plus Jakarta Sans (titres) et Inter (texte).
4. Academy et Consulting : onglets internes sur les listes, fil d'Ariane sur les fiches.
5. Catalogue → fiche → « Accéder à ma formation » : le fil d'Ariane revient à la fiche. Depuis « Mes formations », il revient à « Mes formations ».
6. Clic sur une formation, une offre ou une inscription : la barre verte en haut et le squelette apparaissent immédiatement.
7. Programme de la formation « Écosystème crypto » affiché en liste numérotée avec la durée totale.
8. Mode sombre : fond `#070E1A`, cartes `#0F1A2C`, menu séparé par une bordure, bouton émeraude clair avec texte foncé.

## 7. Reste pour les lots suivants

- **Lot 2** : tableau de bord `/dashboard` (données réelles), page d'inscription (paiement unifié `PayInstallmentButton`, tranches en cartes), Ambassador (lien à copier, partage WhatsApp, onglets de campagnes, déclaration à côté de la fiche).
- **Lot 3** : barre basse mobile, menu en icônes sur tablette, tableaux en cartes sur mobile, absence de flash de thème au chargement, toasts.
- **Lot 4** : notifications, Consulting (avertissement ambre + case à cocher), Contact, vitrine (activités avec images), photo de profil (migration à valider).
