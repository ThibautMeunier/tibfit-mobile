# TibFit Mobile — Instructions Claude Code

## Projet

App mobile **React Native / Expo** (TypeScript, iOS) de coaching sportif IA. Consomme le backend FastAPI via `src/services/api.ts`. Distribuée sur l'App Store via EAS Build.

Stack : React Native · Expo SDK 52 · TypeScript · EAS Build · RevenueCat (IAP) · HealthKit · WorkoutKit.

Backend : repo séparé (`tibfit-backend`). Les docs partagés (TODO.md, DECISIONS.md, CHANGELOG.md, DEPLOY.md) vivent dans le repo backend.

## Début de chaque session

1. Lire **TODO.md dans le repo backend** (`../TODO.md` si accessible) pour l'état global du projet.
2. Ne lire les autres docs que si la tâche le nécessite explicitement.

## Règle de commit

Committer immédiatement après chaque ensemble de modifications de fichiers, sans attendre que l'utilisateur le demande.

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app.json` | Version de l'app (`expo.version`, `expo.ios.buildNumber`, `expo.runtimeVersion`) |
| `ios/TibFit/Info.plist` | Version iOS native (`CFBundleShortVersionString`, `CFBundleVersion`) |
| `ios/TibFit/Supporting/Expo.plist` | Runtime Expo OTA (`EXUpdatesRuntimeVersion`) |
| `src/services/api.ts` | Client HTTP vers le backend |
| `src/constants/tokens.ts` | Design tokens (couleurs, spacing, typographie) |
| `src/components/ui/` | Design system — composants réutilisables |
| `src/navigation/AppNavigator.tsx` | Arbre de navigation React Navigation |
| `src/i18n/fr.json` / `en.json` | Traductions (react-i18next) |

## Skills disponibles

- **`/release-prep`** — checklist complète avant soumission App Store (version, build, TODO, OTA vs build complet, ordre de déploiement). Quand l'utilisateur tape `/release-prep`, invoquer `Skill("release-prep")` avant toute autre action.
- **`/ota`** — checklist + publication d'une mise à jour OTA Expo vers production. Vérifie que les changements sont purement JS (pas natifs) avant de publier. Quand l'utilisateur tape `/ota`, invoquer `Skill("ota")` avant toute autre action.
- **`/bump-mobile [patch|minor|major]`** — bumpe la version dans `app.json`, `Info.plist` ET `Expo.plist` simultanément, selon les règles buildNumber. Quand l'utilisateur tape `/bump-mobile`, invoquer `Skill("bump-mobile")` avant toute autre action.

## Règle de documentation

Les docs globaux (TODO.md, DECISIONS.md, CHANGELOG.md, DEPLOY.md) vivent dans le repo backend. Ne pas les dupliquer ici. Après toute implémentation significative (nouvelle fonctionnalité, décision technique), noter ce qui doit être mis à jour dans le repo backend et le faire dans la foulée.
