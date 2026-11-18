# CSC Academy — cahier des charges

*Version 4 — 18 novembre 2026. Toutes les questions ont reçu une réponse (§ 13) : le cahier des charges est validé. Les lots 1 et 2 sont livrés (voir § 12).*

---

## 1. Objectif

Permettre à CSC de **vendre et animer ses formations** (trading, investissement) directement dans la plateforme :

- un **catalogue** de formations, chacune proposée en **sessions** successives avec un **nombre de places limité** ;
- l'**inscription**, avec un **code de parrainage** facultatif ;
- le **paiement en une ou plusieurs tranches**, le nombre de tranches étant fixé par l'admin ;
- le **rappel puis le blocage automatique** de l'accès en cas de retard ;
- les **cours en visioconférence dans l'application**, **enregistrés automatiquement**, chaque enregistrement étant **supprimé au bout de 7 jours** ;
- des **documents PDF** et des **liens** de cours ;
- des **vidéos** (YouTube, TikTok…) publiées par lien et regardées dans l'application ;
- une **évaluation finale** et une **attestation** pour ceux qui la réussissent ;
- une **commission pour l'ambassadeur** qui a apporté l'inscription.

Aucun contenu vidéo n'est hébergé par CSC en dehors des enregistrements temporaires.

## 2. Les acteurs

| Acteur | Ce qu'il fait |
|---|---|
| **Utilisateur** | Consulte le catalogue, s'inscrit à une session. |
| **Étudiant** | Utilisateur inscrit à au moins une session : suit les séances, consulte documents, liens, vidéos et enregistrements, voit son échéancier. |
| **Ambassadeur** | Partage son code de parrainage (`CSC-AMB-0001`) ; touche une commission sur les inscriptions apportées. |
| **Administrateur** | **Gère tout** : formations, sessions, prix et tranches, inscrits, paiements, séances, documents, évaluations, commissions. C'est aussi lui (ou un autre compte administrateur) qui **anime les visios**. |

*Décision : pas de rôle « formateur » pour l'instant. Le nom de l'intervenant peut être affiché sur la session (simple texte). Un vrai rôle formateur pourra être ajouté plus tard sans tout refaire.*

## 3. Formations et sessions

Une **formation** (ex. « Trading crypto — niveau débutant ») est décrite une seule fois et peut être **proposée plusieurs fois** sous forme de **sessions** (ex. « Session de janvier 2027 »).

**Formation** : titre, résumé, programme (texte), niveau, image de couverture (facultative), statut *brouillon / publiée / archivée*. Saisie **dans une seule langue**, traduite automatiquement par DeepL (comme Ambassador).

**Session** :
- dates de début et de fin, nom de l'intervenant (facultatif) ;
- **nombre de places obligatoire** : quand il est atteint, la session affiche « Complet » et n'accepte plus d'inscription ;
- **prix total** (FCFA) et **échéancier** défini par l'admin : nombre de tranches, montant et date limite de chaque tranche (ex. 3 tranches : 40 % à l'inscription, 30 % à J+30, 30 % à J+60) ;
- inscriptions ouvertes / fermées ;
- une fois le premier paiement enregistré, **le prix et l'échéancier sont figés** (même principe que le montant d'une campagne Ambassador).

## 4. Inscription et paiement

**Décision : pas de paiement en ligne pour l'instant**, mais ses **fondations sont en place**. L'étudiant paie par les moyens habituels de CSC, et **l'administrateur enregistre chaque paiement** dans la plateforme. La base sait déjà distinguer un paiement en ligne « en cours », « confirmé » ou « échoué ». Brancher Notch Pay (ou un autre agrégateur) plus tard ne changera rien au reste.

1. L'utilisateur choisit une session et clique sur **« S'inscrire »** (compte obligatoire, profil complet).
2. Il saisit éventuellement un **code de parrainage**, ou arrive par un lien d'ambassadeur qui le pré-remplit (`…/academy/…?ref=CSC-AMB-0001`).
3. L'inscription est **« en attente de paiement »**. L'étudiant voit le montant de la première tranche et les instructions de paiement (texte saisi par l'admin).
4. L'admin **enregistre le paiement** (montant, date, moyen, référence) : l'inscription devient **active**, et l'étudiant reçoit un e-mail et une notification.
5. Les tranches suivantes sont enregistrées de la même façon. L'étudiant voit en permanence ce qui est payé, ce qui reste et les dates limites.

**Places** : une inscription en attente **réserve une place pendant 3 jours**. Sans premier paiement dans ce délai, elle est **annulée automatiquement** et la place est libérée.

**Pas de remboursement ni de désistement** : une inscription active est définitive. L'étudiant ne peut pas l'annuler. Seule une inscription encore en attente (aucun paiement) peut être annulée, par l'étudiant ou l'admin.

Règles :
- Les montants viennent **toujours de la base**, jamais du navigateur.
- L'admin peut **accorder un délai** pour une tranche.
- Chaque paiement enregistré et chaque délai accordé sont **journalisés** dans l'audit (qui, quand, combien).

## 5. Retards de paiement : rappels puis blocage

Calendrier **validé** pour chaque tranche :

| Moment | Ce qui se passe |
|---|---|
| **J-3** (3 jours avant la date limite) | **Rappel préventif** (e-mail + notification). |
| **Jour J** (date limite dépassée, tranche impayée) | **Rappel** : « votre tranche est en retard, accès bloqué dans 3 jours ». |
| **J+3** | **Blocage** : plus d'accès aux séances, aux documents, aux liens, aux vidéos ni aux enregistrements de cette formation. L'étudiant voit uniquement son échéancier. |
| Dès le paiement enregistré | **Déblocage automatique** immédiat. |

Le blocage est appliqué **par la base** (pas seulement masqué à l'écran) : un étudiant bloqué ne peut obtenir ni lien de document, ni accès à la visio, ni enregistrement. La tâche planifiée quotidienne existante envoie les rappels.

## 6. Évaluation finale et attestation

- Chaque session a une **évaluation finale** (la dernière évaluation de la formation).
- L'**attestation** (PDF) est délivrée **seulement à ceux qui réussissent cette évaluation**.
- **Décision : l'admin crée un questionnaire en ligne** (formulaire) que les apprenants remplissent dans l'application. Les questions à choix sont corrigées automatiquement ; un seuil de réussite est fixé par l'admin.
- **Décision : l'attestation n'est téléchargeable que si toutes les tranches sont payées.**
- L'attestation porte le nom de l'étudiant, la formation, la session, la date et un **numéro unique**. Une page publique permet de **vérifier qu'une attestation est authentique** à partir de ce numéro (utile pour un employeur). **Validé.**

## 7. Commission des ambassadeurs

- Le **code de parrainage** est le numéro d'ambassadeur existant (`CSC-AMB-0001`). Il est **fixé à l'inscription** et ne peut plus changer.
- **Décision : la commission est due une seule fois, quand la formation est entièrement payée.** Tant qu'il reste une tranche à payer, rien n'est dû. Comme il n'y a pas de remboursement, une commission due est définitive.
- **Décision : un pourcentage du prix de la session, fixé par l'admin pour chaque session** (0 % = pas de commission). Le taux est figé sur l'inscription au moment où l'étudiant s'inscrit.
- Pas de commission si l'ambassadeur est suspendu au moment de l'inscription, ni sur sa propre inscription.
- Les commissions s'ajoutent au **solde de l'ambassadeur** et sont payées avec le **circuit déjà en place** dans Ambassador : « Payer » côté admin, **confirmation de réception** côté ambassadeur, exports CSV.
- L'ambassadeur voit dans son espace les inscriptions apportées (prénom + initiale du nom, formation, avancement du paiement) et ses commissions.

## 8. Les cours en visioconférence dans l'application

- L'admin **planifie les séances** d'une session (date, heure, durée, titre). **Durée maximale : 1 heure.**
- À l'heure dite, l'admin **lance la séance**. Les étudiants à jour cliquent sur **« Rejoindre »** et la visio s'ouvre **dans la plateforme** (pas de lien Zoom à partager).
- **Caméras** : seul l'animateur a sa caméra. Les étudiants entrent **caméra coupée** et ne peuvent pas l'allumer eux-mêmes. **L'animateur peut autoriser la caméra d'un étudiant** (et la lui retirer).
- **Micros** : les étudiants entrent **micro coupé**, peuvent **lever la main**, et l'animateur leur donne la parole. Le chat écrit est ouvert à tous.
- Seuls les **étudiants inscrits et non bloqués** de la session (et les administrateurs) peuvent entrer. L'accès est délivré par le serveur pour chaque séance.
- La séance est **enregistrée automatiquement**. L'enregistrement apparaît ensuite dans l'espace étudiant avec la mention « disponible jusqu'au … ».
- **Chaque enregistrement est supprimé automatiquement 7 jours après la séance.** Le fichier est réellement supprimé, pas seulement masqué.
- Pensé pour le Cameroun : qualité vidéo adaptée aux connexions mobiles, et possibilité de rester en audio seul.

**Volumes annoncés** : environ **15 séances par mois**, **1 heure maximum**, **30 étudiants** et 1 animateur, **une seule caméra** la plupart du temps.

| Indicateur | Estimation mensuelle maximale |
|---|---|
| Minutes-participant (15 × 60 min × 31 personnes) | ≈ 28 000 |
| Heures enregistrées | ≈ 15 h |
| Enregistrements conservés en même temps (7 jours) | ≈ 4 h |

Avec une seule caméra, la consommation est faible, ce qui garde le coût bas. **Choix technique** : on intègre un **service de visioconférence spécialisé**, par exemple LiveKit Cloud, Daily ou Jitsi as a Service. Le service doit savoir **interdire la caméra aux étudiants tant que l'animateur ne l'autorise pas**. **Le comparatif chiffré, aux tarifs du moment, sera fourni au démarrage du lot 3, avant tout engagement.**

## 9. Documents, liens et vidéos

- **PDF** : déposés par l'admin et stockés dans un espace **privé**. Les étudiants à jour les ouvrent par des liens temporaires, comme les modes opératoires d'Ambassador. Taille maximale : 10 Mo par fichier.
- **Liens de cours** : adresse + libellé (ex. support en ligne, exercice).
- **Vidéos** : l'admin colle un lien **YouTube, TikTok, Google Drive…**. La vidéo se regarde dans l'application et n'est chargée qu'au clic, pour économiser les données mobiles.

## 10. L'espace étudiant (`/student`)

- **Mes formations** : chaque session avec son état (*en attente de paiement*, *active*, *en retard*, *bloquée*, *terminée*).
- **Prochaines séances** avec le bouton **« Rejoindre »**, actif quelques minutes avant le début.
- **Documents, liens, vidéos**, **enregistrements** (avec leur date de suppression).
- **Échéancier** : tranches payées, à venir, en retard, et instructions de paiement.
- **Résultat de l'évaluation finale** et **attestation** à télécharger.

## 11. L'administration (`/admin/academy`)

- **Vue d'ensemble** : inscriptions, encaissements, montants en retard, étudiants bloqués, places restantes, prochaines séances.
- **Formations et sessions** : création, publication, places, échéancier, taux de commission, séances, documents, liens, vidéos.
- **Inscrits** : recherche, état de paiement, **enregistrement d'un paiement**, délai accordé, résultat de l'évaluation, export CSV.
- **Paiements** : historique de tous les paiements enregistrés.
- **Commissions** : par ambassadeur, intégrées au circuit de paiement existant.
- Toutes les actions sensibles sont **journalisées** dans l'audit.

## 12. Découpage en lots

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **1 — livré** | Catalogue, formations et sessions (places, échéancier), inscription avec code de parrainage, **enregistrement des paiements par l'admin**, espace étudiant, documents / liens / vidéos (YouTube, TikTok, Vimeo, Google Drive), administration, fondations du paiement en ligne | Permet de vendre et suivre des formations tout de suite. En attendant le lot 3, une séance porte un lien de visio externe. |
| **2 — livré** | **Rappels J-3 / J et blocage J+3** automatiques, **commissions des ambassadeurs**, **questionnaire d'évaluation finale** (questions à choix unique ou multiple, corrigées par la base) et **attestation PDF** avec page publique de vérification (`/academy/verify`) | S'appuie sur les inscriptions et paiements du lot 1. Migration `20261119000100_academy_lot2.sql`. |
| **3 — livré** | **Visioconférence intégrée LiveKit** (caméra et partage d'écran de l'animateur, parole et caméra des étudiants sur autorisation, main levée, discussion, mode audio seul), présences, enregistrement automatique dans Cloudflare R2, replay 7 jours puis **suppression du fichier** | Migration `20261120000100_academy_lot3.sql`. Comparatif : [CSC_ACADEMY_VISIO_COMPARATIF.md](CSC_ACADEMY_VISIO_COMPARATIF.md). |
| *Plus tard* | Paiement en ligne Mobile Money (Notch Pay ou autre) | Quand vous le déciderez. Il s'ajoutera à côté de l'enregistrement manuel. |

Chaque lot suit la même méthode qu'Ambassador :
- règles sensibles dans la base (fonctions SQL + RLS) ;
- tests automatiques des règles (places, blocage, commissions) ;
- interface FR/EN ;
- thèmes clair et sombre ;
- mobile d'abord.

**Base de données** : le module nécessite de **nouvelles tables**. Elles seront livrées sous forme d'un **fichier de migration non exécuté**, que vous appliquerez vous-même dans Supabase (SQL Editor) après relecture. Comme convenu, rien n'est lancé automatiquement sur la base en ligne.

## 13. Décisions du 18 novembre 2026

| Question | Décision |
|---|---|
| Paiement en ligne | Pas pour l'instant ; l'admin enregistre les paiements. Les fondations du paiement en ligne sont posées. |
| Commission | Pourcentage du prix, fixé par session, versé une fois la formation entièrement payée. |
| Évaluation finale | Questionnaire en ligne créé par l'admin, rempli par les apprenants. |
| Attestation | Réussite de l'évaluation finale **et** tout payé ; page de vérification par numéro. |
| Places | Une inscription non payée garde la place 3 jours. |
| Micros des étudiants | Coupés au départ, avec « lever la main ». |

---

## Annexe technique (pour les développeurs)

*Indicatif : le modèle exact sera fixé dans la migration du lot concerné.*

- **Rôles** : aucun nouveau rôle. Les actions de gestion sont réservées à `is_admin()`.
- **Tables** (préfixe `academy_`) :
  - `courses`, `sessions` (`seats`, `commission_rate`, `payment_instructions`), `installments` (rang, montant, échéance) ;
  - `enrollments` (étudiant, session, code de parrainage figé, statut, `hold_expires_at`, délai accordé) ;
  - `payments` (tranche, montant, date, moyen, référence, saisi par) ;
  - `meetings` (séances, lien externe facultatif au lot 1), `recordings` (`expires_at = séance + 7 jours`) ;
  - `documents`, `links`, `videos` ;
  - lot 2 (livré) : `evaluations` (une par session), `questions` (propositions et bonnes réponses, lisibles par l'admin seul), `evaluation_attempts` (réponses et note), `certificates` (numéro unique, copie figée), `commission_payouts`, `reminders` (rappels déjà envoyés) ; vue `commissions`.
- **Vues calculées** (aucun solde stocké, comme Ambassador) :
  - état de paiement par inscription ;
  - places restantes ;
  - montants dus et en retard ;
  - commissions dues (inscriptions entièrement payées), intégrées aux soldes ambassadeur.
- **Fonctions `SECURITY DEFINER`** :
  - `enroll` (contrôle des places sous verrou, code de parrainage) ;
  - `cancel_pending_enrollment`, `record_payment`, `grant_extension`, `set_evaluation_result`, `issue_certificate` ;
  - `can_access_session(user, session)`, utilisée par la RLS des documents, liens, vidéos et enregistrements, et par la délivrance des accès visio.
- **Tâche planifiée** : extension de `/api/cron/notifications`, avec :
  - les rappels J-3 et J, et le blocage J+3 ;
  - l'expiration des réservations non payées ;
  - la suppression des enregistrements expirés.
- **Stockage** : bucket privé `academy-files` (PDF), liens signés courts.
- **Visio (lot 3)** : jetons d'accès émis par le serveur, par séance, avec droits « publier la caméra » réservés à l'animateur et modifiables en direct. Les clés du service sont placées dans les variables d'environnement, jamais dans le code.
- **Vidéos par lien** : étendre `lib/video.ts` (YouTube et Google Drive déjà gérés) à TikTok et aux autres plateformes intégrables.
