# TibFit Mobile — Instructions Claude Code

## Projet

App mobile **React Native / Expo** (TypeScript, iOS) de coaching sportif IA. Consomme le backend FastAPI via `src/services/api.ts`. Distribuée sur l'App Store via EAS Build.

Stack : React Native · Expo · TypeScript · EAS Build · RevenueCat (IAP) · HealthKit · WorkoutKit.

Backend : repo séparé (`tibfit-backend`), docs partagés (TODO.md, DECISIONS.md, CHANGELOG.md) s'y trouvent.

## Début de chaque session

1. Lire **TODO.md dans le repo backend** pour l'état global du projet.
2. Ne lire les autres docs que si la tâche le nécessite explicitement.

## Règle de commit

Committer immédiatement après chaque ensemble de modifications de fichiers, sans attendre que l'utilisateur le demande.

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app.json` | Version de l'app (versionName + buildNumber) |
| `ios/TibFit/Info.plist` | Version iOS native (CFBundleShortVersionString + CFBundleVersion) |
| `src/services/api.ts` | Client HTTP vers le backend |
| `src/constants/tokens.ts` | Design tokens (couleurs, spacing, typographie) |
| `src/components/ui/` | Design system — composants réutilisables |
| `src/navigation/AppNavigator.tsx` | Arbre de navigation React Navigation |

## Skills disponibles

- **`/release-prep`** — checklist complète avant soumission App Store.
- **`/ota`** — checklist + publication OTA Expo vers production.
- **`/bump-mobile [patch|minor|major]`** — bumpe la version dans `app.json` ET `Info.plist`.

## Règle de documentation

Les docs globaux (TODO.md, DECISIONS.md, CHANGELOG.md, DEPLOY.md) vivent dans le repo backend. Ne pas les dupliquer ici.
