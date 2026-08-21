# AHS1 Player — Android

Application Kotlin/Jetpack Compose dans `apps/android/`. Package : `com.xploz.ahs1.player`.

## Statut (Phase 9)

Version basique : activation par code, synchronisation en ligne (`GET /api/player/sync`), lecture séquentielle de la playlist du magasin via ExoPlayer, heartbeat toutes les 30s, remontée de l'historique de lecture. **Pas encore de cache local ni de mode hors-ligne** (Phase 10-11) — coupe le réseau et la lecture s'arrête, c'est normal à ce stade.

## Ouvrir le projet

1. Installer [Android Studio](https://developer.android.com/studio) (gratuit).
2. **Open** → sélectionner le dossier `apps/android/`.
3. Laisser Android Studio télécharger Gradle et le SDK Android (première ouverture longue, plusieurs Go).
4. Si `./gradlew` réclame le wrapper : **File → Sync Project with Gradle Files** régénère `gradle-wrapper.jar` automatiquement.

## Tester sur le Xiaomi

1. Sur le téléphone : **Paramètres → À propos du téléphone** → taper 7 fois sur "Numéro de build" pour activer le **mode développeur**.
2. **Paramètres → Options pour les développeurs** → activer **Débogage USB**.
3. Brancher le téléphone en USB, autoriser le débogage sur la popup qui apparaît.
4. Dans Android Studio, sélectionner le device dans la barre d'outils, cliquer **Run ▶**.

Aucune installation Google Play nécessaire — l'app s'installe directement via USB, gratuitement.

## Configuration

`app/build.gradle.kts` définit `API_BASE_URL` = `https://playeur.xploz.re/` (le déploiement Netlify). À changer si l'URL du dashboard change.

## Activer un player pour le test

Créer un player dans le dashboard (`/players`), récupérer son code d'activation (`AHS1-XXXX-XXXX`), le saisir dans l'app au premier lancement.

## Prochaines étapes (Phase 10+)

- Cache local (Room + fichiers) pour survivre à une coupure réseau
- Fondus enchaînés à la lecture (actuellement seuls les points de coupe trim_start/trim_end sont appliqués, pas encore fade_in/fade_out)
- Écran de diagnostic (§35)
- WorkManager pour la synchronisation périodique en arrière-plan
