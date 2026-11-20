# Refonte UI — Lot 0 : correctifs urgents

*20 novembre 2026. Mission : `C:\ProjetAC\CSC\docs\PROMPT_REFONTE_UI_CSC.md`. Aucune modification du schéma Supabase.*

## 1. Formulaires : la saisie n'est plus jamais effacée

**Cause.** Tous les formulaires étaient envoyés par `<form action={…}>`. Depuis React 19, un tel formulaire est **vidé automatiquement après chaque envoi**, même quand le serveur renvoie une erreur. C'est pourquoi l'inscription perdait nom, prénom et téléphone quand le mot de passe était refusé.

**Correction.** Elle est faite à un seul endroit, `src/components/forms/use-validated-action.ts`, avec un nouveau `useFormSubmit`. L'envoi passe maintenant par `onSubmit`, ce qui n'efface rien. Elle s'applique aux 17 formulaires de l'application, de la connexion aux formulaires d'administration, y compris les petits formulaires d'action (`ActionForm`).

En plus :
- la saisie est validée dans le navigateur avant l'envoi ; rien n'est envoyé si elle est invalide ;
- en cas d'erreur, le curseur va sur le premier champ fautif ;
- une deuxième soumission pendant l'envoi est ignorée ;
- chaque message d'erreur est relié à son champ (`aria-invalid` et `aria-describedby`).

Un test (`tests/unit/session-and-forms.test.ts`) **échoue** si un formulaire de saisie réutilise `<form action={…}>`.

**Champs** (`fields.tsx`)
- Le libellé est placé **au-dessus** du champ, avec une astérisque rouge si le champ est obligatoire. Cela corrige aussi le texte superposé de la liste « Formation concernée » sur Contact, et de toutes les autres listes.
- Les champs peuvent afficher une unité à droite (`suffix`), par exemple « FCFA ».

**Contact.** Un compteur « 7 / 10 caractères minimum » s'affiche pendant la saisie du message.

## 2. Mot de passe

Un nouveau composant, `PasswordField` (`components/forms/password-field.tsx`), est utilisé à l'inscription, à la réinitialisation et au changement de mot de passe :
- les règles s'affichent en direct (8 caractères, une lettre, un chiffre) et passent au vert avec une coche quand elles sont respectées ;
- une jauge indique la robustesse ;
- un bouton permet d'afficher ou de masquer le mot de passe ;
- la confirmation est vérifiée en direct ;
- le bouton de validation reste désactivé tant que les règles ne sont pas remplies.

Les règles sont les mêmes que celles vérifiées par le serveur, et un test le garantit.

## 3. Changement de mot de passe (`/auth/change-password`)

- Le champ **« Mot de passe actuel »** est obligatoire et vérifié par le serveur. S'il est incorrect, un message s'affiche sur ce champ et les autres champs sont conservés.
- Le nouveau mot de passe doit être différent de l'actuel.
- La page a un lien **« ← Retour à mon profil »** et un bouton **« Annuler »**. Ils sont masqués lors du changement imposé à la première connexion.
- Après le changement :
  - les **autres appareils sont déconnectés** ;
  - un message de confirmation s'affiche sur le profil ;
  - l'utilisateur reçoit la notification **« Votre mot de passe a été modifié »**, dans l'application et par e-mail ;
  - le changement est inscrit dans le journal d'audit.
- Le parcours « mot de passe oublié » est inchangé : l'ancien mot de passe n'est pas demandé.

## 4. Déconnexion après inactivité

Toutes les durées se règlent dans `src/lib/session-policy.ts` : 30 min d'inactivité, avertissement 2 min avant, 7 jours au maximum.

**Dans le navigateur** (`components/session/idle-timeout.tsx`)
- Comptent comme activité : les clics, les frappes, le défilement et les changements de page. L'écoute est limitée à un enregistrement toutes les 15 s.
- Deux minutes avant la déconnexion, une fenêtre « Toujours là ? » affiche un compte à rebours, avec les boutons « Rester connecté » et « Me déconnecter ».
- Les onglets sont synchronisés : l'activité dans un onglet garde les autres actifs, et une déconnexion (automatique ou volontaire) déconnecte tous les onglets.
- Pendant une visio, l'utilisateur reste connecté même sans toucher l'écran.

**Sur le serveur** (`src/proxy.ts`)
- Des cookies `httpOnly` enregistrent le début de la session et la dernière activité.
- Au-delà de 30 min d'inactivité, ou de 7 jours de session, l'utilisateur est déconnecté puis redirigé vers `/auth/login?raison=inactivite` (ou `raison=expiree`). Cela fonctionne même si l'ordinateur était en veille ou l'onglet fermé.
- Les préchargements de liens ne comptent pas comme une activité.
- Les sessions ouvertes avant cette mise à jour ne sont pas coupées : le décompte démarre à leur prochaine visite.

**À la connexion**
- Une nouvelle case **« Rester connecté sur cet appareil »**, cochée par défaut. Décochée, la session se termine aussi à la fermeture du navigateur.
- Après une déconnexion automatique, la page de connexion explique pourquoi.

**Réglages Supabase.** Les options « Time-box user sessions » et « Inactivity timeout » (Authentication › Sessions) sont à ma connaissance réservées aux offres payantes. Le contrôle ci-dessus fonctionne sans elles. Si vous passez un jour à l'offre Pro, réglez-les sur 7 jours et 30 minutes.

## 5. Plus de page sans issue

- **Pages de connexion** : lien « ← Retour à l'accueil » en haut à gauche, en plus du logo cliquable.
- **Changement de mot de passe** : « ← Retour à mon profil » et « Annuler ».
- **Page 404 et page d'erreur** : logo cliquable et lien de retour à l'accueil.

## 6. Vérifications

**Automatiques**
- `tsc`, `eslint` et `next build` passent sans erreur.
- **535 tests** passent, dont les nouveaux : règles du mot de passe, schéma de changement, politique de session, cookies de session, et le garde-fou sur les formulaires.

**À faire à la main** (aucun outil de navigateur de mon côté) :

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Inscription : remplir nom, prénom, e-mail, téléphone, puis un mot de passe « abc » | Les règles restent grises, le bouton reste désactivé. Corriger le mot de passe : tout le reste est toujours rempli. |
| 2 | Inscription avec un e-mail déjà utilisé (erreur serveur) | Message d'erreur ; tous les champs restent remplis. |
| 3 | Contact : message de 5 caractères | Compteur « 5 / 10 caractères minimum » ; à l'envoi, le message d'erreur s'affiche et rien n'est effacé. |
| 4 | Contact : liste « Formation concernée » | Le libellé est au-dessus ; plus de texte superposé. |
| 5 | Changer le mot de passe avec un mot de passe actuel faux | Message « Mot de passe actuel incorrect » ; les nouveaux mots de passe restent saisis. |
| 6 | Changer le mot de passe correctement, avec un deuxième appareil connecté | Retour au profil avec confirmation, notification et e-mail ; le deuxième appareil est déconnecté. |
| 7 | Rester 28 min sans rien faire | La fenêtre « Toujours là ? » apparaît avec le compte à rebours ; « Rester connecté » la ferme. |
| 8 | Deux onglets ouverts, se déconnecter dans l'un | L'autre onglet passe à la page de connexion. |
| 9 | Se connecter sans cocher « Rester connecté », fermer complètement le navigateur, le rouvrir | Il faut se reconnecter. |
| 10 | Pages de connexion, 404, `/auth/change-password` | Un lien de retour est visible sur chacune. |

Pour tester rapidement les scénarios 7 et 9, vous pouvez temporairement mettre `IDLE_MINUTES = 3` dans `session-policy.ts`. Pensez à remettre 30 ensuite.

## 7. Points d'attention

- **Libellés au-dessus des champs** : sur quelques formulaires d'administration en ligne, où les champs et le bouton sont côte à côte (disponibilités, objectifs), le bouton peut paraître un peu haut. L'alignement sera repris au Lot 1 avec le nouveau thème.
- **Tableau de bord admin** : il est commité en local à part (commit `Tableau de bord admin (lot D1)`). Si vous voulez pousser le Lot 0 en ligne, appliquez d'abord la migration `20261124000100_dashboard.sql`. Sinon, l'onglet Tableau de bord affichera une erreur jusqu'à ce qu'elle soit appliquée.
