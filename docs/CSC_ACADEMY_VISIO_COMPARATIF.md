# CSC Academy — lot 3 : comparatif des services de visioconférence

*18 novembre 2026. Document de décision : aucun code ni abonnement n'est engagé avant votre choix.*

## Rappel du besoin

- ~15 séances par mois, 1 h maximum, 30 étudiants + 1 animateur.
- Seule la caméra de l'animateur ; il peut autoriser (et retirer) la caméra d'un étudiant. Micros coupés à l'entrée, « lever la main », chat écrit.
- Accès réservé aux inscrits à jour (non bloqués) : l'accès est délivré par notre serveur pour chaque séance.
- Enregistrement automatique, **réellement supprimé 7 jours après** la séance.
- Connexions mobiles au Cameroun : qualité adaptative, audio seul possible.

**Volume mensuel maximum** : 15 × 60 min × 31 personnes ≈ **28 000 minutes-participant** ; **900 minutes enregistrées** (15 h) ; environ 4 h d'enregistrements conservés en même temps.

## Comparatif (tarifs publics constatés en novembre 2026)

| | **LiveKit Cloud** (offre Ship) | **Daily** | **8x8 Jitsi as a Service** (offre Basic) |
|---|---|---|---|
| Principe de prix | Forfait 50 $/mois, quotas inclus | À la minute, 10 000 min gratuites/mois | Forfait par utilisateurs actifs du mois |
| Minutes de visio | 150 000 incluses (besoin ≈ 28 000) | 18 000 × 0,004 $ ≈ **72 $** | Incluses (300 utilisateurs actifs/mois) |
| Enregistrement | 5 000 min incluses (besoin 900) | 900 × 0,01349 $ ≈ **12 $** | 900 × 0,01 $ ≈ **9 $** |
| Bande passante | 250 Go inclus (besoin estimé 200–300 Go), puis 0,12 $/Go | Incluse | Incluse |
| **Estimation mensuelle** | **50 à 60 $** (≈ 30 000 à 36 000 FCFA) | **≈ 85 $** (≈ 51 000 FCFA) | **≈ 108 $** (≈ 65 000 FCFA) |
| Caméra réservée à l'animateur, autorisation au cas par cas | ✅ droits fixés dans le jeton d'accès par notre serveur, modifiables en direct | ✅ droits du jeton modifiables en direct | 🟡 « modération audio/vidéo » de Jitsi, moins fine |
| Lever la main, chat | ✅ (à intégrer dans notre interface) | ✅ (interface Daily fournie) | ✅ (interface Jitsi fournie) |
| Où sont les enregistrements | **Dans notre propre stockage** : suppression à 7 jours maîtrisée par nous | Chez Daily (ou notre stockage) : suppression par appel à leur service | Chez 8x8, à rapatrier : plus de manipulations |
| Apparence | Interface aux couleurs CSC, dans la plateforme | Fenêtre Daily intégrée (personnalisation limitée) | Fenêtre Jitsi intégrée |
| Travail d'intégration | Le plus important (on construit l'écran de visio) | Moyen | Le plus faible |
| Marge de croissance | ~5 fois le volume actuel sans surcoût | Coût proportionnel à l'usage | Limité à 300 étudiants actifs/mois |

*Conversion indicative : 1 $ ≈ 600 FCFA. Les tarifs LiveKit et 8x8 proviennent de comparatifs récents, ceux de Daily de sa page officielle : à reconfirmer sur la page de prix au moment de l'inscription.*

**Écarté** : héberger nous-mêmes Jitsi ou LiveKit sur un serveur (≈ 20–40 €/mois). C'est moins cher, mais il faut quelqu'un pour maintenir le serveur, les mises à jour et la sécurité.

## Recommandation : LiveKit Cloud

1. **Le moins cher à ce volume**, avec un prix fixe et prévisible, et une large marge avant de payer plus.
2. **La règle « caméra réservée à l'animateur » est imposée par le serveur**, pas seulement par l'écran : un étudiant ne peut pas activer sa caméra sans autorisation, même en bricolant.
3. **Les enregistrements restent chez nous** : la suppression à 7 jours est faite par notre tâche quotidienne, et le fichier est réellement effacé.
4. Écran de visio **aux couleurs de CSC**, en français et en anglais, dans la plateforme.
5. Démarrage possible sur l'offre **gratuite** (5 000 minutes/mois) pour les tests, puis passage à l'offre Ship à 50 $/mois au lancement réel.

Point à vérifier ensemble : l'**espace de stockage** des enregistrements (≈ 3 Go en permanence) et leur visionnage par les étudiants consomment du stockage et de la bande passante Supabase. Selon votre offre Supabase, cela peut être inclus ou justifier un petit stockage dédié.

## Ce qu'il faudra, une fois le choix validé

- Créer le compte chez le service choisi (vous-même) et placer ses clés dans `.env.local` et dans Vercel (je vous indiquerai les noms exacts des variables). **Ne m'envoyez jamais les clés.**
- Une nouvelle migration (non exécutée) : séances « en direct », journal des enregistrements avec leur date de suppression.

## Sources des tarifs

- LiveKit : [micdrop.dev](https://micdrop.dev/blog/livekit-pricing), [superdupr.com](https://superdupr.com/blog/livekit-pricing), [forasoft.com](https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/livekit-realtime-ai-meeting-assistant-news-pricing), [trtc.io](https://trtc.io/blog/details/livekit-pricing-2026)
- Daily : [daily.co/pricing](https://www.daily.co/pricing/video-sdk/), [daily.co/pricing/webrtc-infrastructure](https://www.daily.co/pricing/webrtc-infrastructure)
- 8x8 JaaS : [cpaas.8x8.com](https://cpaas.8x8.com/en/pricing/jitsi-as-a-service-pricing/), [8x8.com](https://www.8x8.com/products/apis/video)
