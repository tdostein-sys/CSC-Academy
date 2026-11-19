# CSC Consulting et CSC Gestion d'actifs — cahier des charges

*Version 1 — 19 novembre 2026. Brouillon à valider : les propositions sont marquées **Proposé**, les questions à trancher sont regroupées au § 9. Aucun code ne sera écrit avant validation.*

---

## 1. Objectif

Ouvrir les deux modules aujourd'hui affichés « Bientôt » :

- **CSC Consulting** — conseil en investissement (marchés financiers, cryptomonnaies) : offres de conseil, **profil de risque** du client, **prise de rendez-vous**, séance en **visio intégrée**, **compte rendu** remis au client.
- **CSC Gestion d'actifs (GA)** — gestion de portefeuilles pour particuliers, professionnels et institutionnels : **demande de mandat**, **dossier client** (pièces justificatives), **suivi du portefeuille** et **relevés périodiques**.

Les deux modules réutilisent ce qui existe déjà : comptes, notifications et e-mails, traduction automatique, visio intégrée (LiveKit), paiements enregistrés par l'admin (comme Academy), page Contact.

### Point d'attention réglementaire

Le conseil en investissement et la gestion de portefeuille pour le compte de tiers sont des **activités réglementées** dans la zone CEMAC, sous l'autorité de la COSUMAF. Avant d'ouvrir ces modules au public, **vérifiez avec un juriste** que CSC dispose des agréments nécessaires, ou que l'offre est formulée dans le cadre autorisé.

La plateforme affichera dans tous les cas :
- des **avertissements sur les risques** ;
- **aucune promesse de rendement**.

**Elle ne reçoit jamais d'argent à investir** : les fonds circulent hors plateforme, et l'admin y enregistre seulement les mouvements.

---

## 2. Les acteurs

| Acteur | Ce qu'il fait |
|---|---|
| **Visiteur** | Consulte les offres de conseil et la présentation de la gestion d'actifs. |
| **Client Consulting** | Remplit son profil de risque, réserve un rendez-vous, assiste à la séance, lit ses comptes rendus. |
| **Client GA** | Dépose une demande de mandat et son dossier, puis suit son portefeuille et ses relevés. |
| **Administrateur** | Gère les offres, les disponibilités, les rendez-vous, les paiements, les comptes rendus, les mandats et les valeurs des portefeuilles. Il anime les séances. |

**Proposé** : pas de rôle « conseiller » distinct au départ, comme pour Academy (pas de rôle formateur). Le nom du conseiller pourra être affiché en simple texte.

---

## 3. Profil de risque (commun aux deux modules)

Un **questionnaire en ligne** est rempli une fois par le client, puis mis à jour quand il le souhaite. Il porte sur :
- les objectifs ;
- l'horizon de placement ;
- les connaissances et l'expérience ;
- la réaction face à une perte ;
- la part du patrimoine concernée ;
- les revenus.

- **Proposé** : un score calculé automatiquement donne un profil parmi **Prudent / Équilibré / Dynamique / Offensif**, avec une explication simple.
- **Proposé** : le profil est **obligatoire avant le premier rendez-vous** et avant toute demande de mandat. Il est **valable 12 mois**, puis le client est invité à le mettre à jour.
- L'admin voit le profil et les réponses ; le client voit son propre résultat.
- Les questions et les seuils sont modifiables par l'admin, avec traduction automatique.

---

## 4. CSC Consulting

### 4.1 Offres de conseil
Le catalogue est géré par l'admin. Chaque offre comprend :
- un titre, une description, une **durée** (30, 60 ou 90 min) et un **prix en FCFA**, qui peut être « gratuit » pour un premier échange ;
- un **format** : visio intégrée, téléphone ou présentiel (avec une adresse) ;
- un statut : brouillon, publiée ou archivée.

Exemples : « Premier échange (30 min, gratuit) », « Séance de conseil (1 h) », « Bilan patrimonial ».

**Proposé** : une offre « Accompagnement » regroupant plusieurs séances (par exemple 4 séances sur 3 mois) viendra dans un second temps.

### 4.2 Disponibilités et rendez-vous
- L'admin définit ses **créneaux habituels** (par exemple lundi à vendredi, 9 h à 17 h) et des **exceptions** (congés, indisponibilités), à l'heure du Cameroun.
- Le client choisit une offre, puis un **créneau libre** : il ne voit que les créneaux réellement disponibles. Il peut ajouter un message (ce qu'il veut aborder).
- **Le même créneau ne peut jamais être réservé deux fois**. C'est la base de données qui le garantit, même en cas de clics simultanés.
- **Offre payante** (même principe qu'Academy) :
  - le rendez-vous reste **« en attente de paiement »** et le créneau est **réservé 24 h** (**Proposé**) ;
  - l'admin enregistre le paiement et le rendez-vous devient **confirmé** ;
  - sans paiement dans le délai, le créneau est libéré automatiquement.
- **Offre gratuite** : le rendez-vous est confirmé directement. **Proposé** : 1 premier échange gratuit par client.
- **Rappels** par notification et e-mail : **la veille** et **1 h avant**.
- **Annulation ou report par le client** : possible **jusqu'à 24 h avant** (**Proposé**). Au-delà, la séance est due. L'admin peut toujours annuler ou déplacer un rendez-vous ; le client est alors prévenu.
- **Séance** : en visio intégrée, comme les séances Academy (salle ouverte par l'admin, le client entre à l'heure prévue). **Proposé** : pas d'enregistrement des séances de conseil, pour la confidentialité.

### 4.3 Après la séance
- L'admin rédige un **compte rendu** (texte avec mise en forme, plus des documents PDF facultatifs), visible du client seul.
- Le client retrouve l'historique de ses rendez-vous et de ses comptes rendus dans « Mon espace ».

### 4.4 Parrainage
**Question** : un ambassadeur touche-t-il une commission sur une séance de conseil payante, comme pour Academy ? Si oui, quel pourcentage ?

---

## 5. CSC Gestion d'actifs

### 5.1 Présentation et demande de mandat
- La page publique présente la gestion d'actifs, les profils de gestion, les frais et les avertissements sur les risques. Le texte est éditable par l'admin.
- Le client (connecté, avec un profil de risque à jour) dépose une **demande de mandat** :
  - le type de client : particulier, professionnel ou institutionnel ;
  - le montant envisagé ;
  - les objectifs ;
  - le profil de gestion souhaité (proposé d'après son profil de risque).
- **Dossier client** : envoi des **pièces justificatives** dans un espace de stockage privé, que seuls le client et l'admin peuvent voir.
  - Particulier : pièce d'identité et justificatif de domicile.
  - Entreprise ou institution : RCCM, statuts et pièce du représentant.
- L'admin étudie la demande et peut **demander un complément**, **refuser** (avec un motif) ou **accepter**.
- **Contrat** : **Proposé** — l'admin dépose le contrat de mandat en PDF. Le client l'accepte en ligne (case à cocher, avec date et heure enregistrées), ou dépose la version signée. Le mandat devient alors **actif**.

### 5.2 Suivi du portefeuille
**Proposé, version 1** : l'admin saisit les informations ; il n'y a **pas de connexion automatique** aux comptes de courtage ou aux plateformes crypto. Une connexion automatique pourra venir plus tard, plateforme par plateforme.

- **Mouvements** : apports et retraits (date, montant, référence), enregistrés par l'admin.
- **Valorisation** : à chaque date choisie (par exemple fin de mois), l'admin saisit la **valeur totale** et la **répartition** par classe d'actifs (cryptomonnaies, actions, obligations, liquidités…).
- **Le client voit** :
  - la valeur actuelle et le total des apports et des retraits ;
  - la **performance**, calculée automatiquement en tenant compte des apports et des retraits ;
  - un **graphique** de l'évolution et la **répartition** actuelle.
- **Demande de retrait** : le client fait une demande, l'admin la traite (statuts : demandé, en cours, effectué, refusé). Le versement se fait hors plateforme.

### 5.3 Relevés et frais
- **Relevé périodique en PDF** (**Proposé** : trimestriel), généré automatiquement à partir des données saisies. Le client est prévenu à chaque nouveau relevé.
- **Frais** (**Question** : lesquels pratiquez-vous ?) :
  - frais de gestion annuels en % ;
  - frais de performance en % au-delà d'un seuil ;
  - frais d'entrée.

  **Proposé** : pour la version 1, les frais sont **affichés et saisis** par l'admin comme des mouvements ; ils ne sont pas calculés automatiquement.

---

## 6. Sécurité et confidentialité

- Toutes les règles (créneau unique, délais, accès aux documents, qui voit quoi) sont **garanties par la base de données**, comme pour Academy.
- Les pièces justificatives, contrats, comptes rendus et relevés sont dans un **stockage privé**, ouvert par des liens temporaires.
- Chaque action de l'admin (validation de mandat, saisie de valeur, retrait) est **tracée dans le journal**.
- **Proposé** : les dossiers refusés ou abandonnés sont supprimés après une durée à définir (**Question**).

---

## 7. Notifications

**Client** :
- rendez-vous réservé, confirmé, rappelé, annulé ou déplacé ;
- nouveau compte rendu ;
- demande de mandat reçue, complément demandé, mandat accepté ou refusé ;
- nouveau relevé ;
- retrait traité.

**Admin** :
- nouvelle réservation ;
- annulation par un client ;
- nouvelle demande de mandat ;
- pièce ajoutée ;
- demande de retrait.

---

## 8. Découpage proposé (comme pour Academy)

| Lot | Contenu |
|---|---|
| **C1** | Profil de risque ; offres de conseil ; disponibilités ; réservation avec paiement enregistré par l'admin ; rappels ; visio ; comptes rendus. |
| **G1** | Page Gestion d'actifs ; demande de mandat ; dossier et pièces ; contrat ; mandats actifs. |
| **G2** | Mouvements, valorisations, performance et graphiques ; demandes de retrait ; relevés PDF. |

Chaque lot comprend une nouvelle migration (non exécutée, appliquée par vous), des tests, et un livrable vérifié avant de passer au lot suivant.

---

## 9. Questions à trancher

1. **Agrément** : CSC est-elle autorisée à faire du conseil et de la gestion pour le compte de clients, ou faut-il adapter la présentation (par exemple « accompagnement » plutôt que « gestion sous mandat ») ?
2. **Par quel module commencer** : Consulting (C1) d'abord, comme proposé ?
3. **Offres de conseil** : quelles offres, durées et prix au départ ? Un premier échange gratuit ?
4. **Rendez-vous** : réservation bloquée 24 h en attente de paiement, annulation jusqu'à 24 h avant : d'accord ?
5. **Séances de conseil** : sans enregistrement, d'accord ?
6. **Parrainage** : commission ambassadeur sur le conseil et/ou la gestion ? Quel pourcentage ?
7. **Gestion d'actifs** : montant minimum d'un mandat ? Quels types de clients au départ (particuliers seulement, ou aussi professionnels et institutionnels) ?
8. **Frais de gestion** : lesquels (gestion, performance, entrée) et quels taux ?
9. **Valorisation** : à quelle fréquence l'admin saisira-t-il les valeurs (mensuelle, trimestrielle) ? Relevé trimestriel, d'accord ?
10. **Conservation** : combien de temps garder les dossiers refusés ou abandonnés ?
