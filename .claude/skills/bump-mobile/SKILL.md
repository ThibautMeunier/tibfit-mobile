# Skill: bump-mobile

Bumpe la version mobile dans `app.json` ET `ios/TibFit/Info.plist` de façon cohérente.

## Quand invoquer

Quand l'utilisateur tape `/bump-mobile`.

## Arguments

`/bump-mobile [patch|minor|major]` — type de bump. Défaut : **patch**.

## Règles de versioning mobile

| Type  | Version          | buildNumber       | runtimeVersion         |
|-------|------------------|-------------------|------------------------|
| patch | 2.0.1 → 2.0.2    | incrémenter (+1)  | inchangé               |
| minor | 2.0.x → 2.1.0    | reset à **1**     | bump = nouvelle version |
| major | 2.x.x → 3.0.0    | reset à **1**     | bump = nouvelle version |

Le `buildNumber` est présent à **trois endroits** qui doivent toujours être synchronisés :
- `app.json` → `expo.ios.buildNumber`
- `ios/TibFit/Info.plist` → `CFBundleVersion`
- `ios/TibFitWidget/Info.plist` → `CFBundleVersion`

La `runtimeVersion` est présente à **trois endroits** qui doivent toujours être synchronisés :
- `app.json` → `expo.runtimeVersion`
- `ios/TibFit/Supporting/Expo.plist` → `EXUpdatesRuntimeVersion`

## Protocole

### 1. Lire l'état actuel

Lis `app.json` (champs `expo.version`, `expo.ios.buildNumber`, `expo.runtimeVersion`),
`ios/TibFit/Info.plist` (`CFBundleShortVersionString`, `CFBundleVersion`),
`ios/TibFitWidget/Info.plist` (`CFBundleShortVersionString`, `CFBundleVersion`)
et `ios/TibFit/Supporting/Expo.plist` (`EXUpdatesRuntimeVersion`).

Affiche :
```
État actuel :
  app.json       version=X.Y.Z  buildNumber=N  runtimeVersion=A.B.C
  Info.plist     version=X.Y.Z  buildNumber=N
  Widget.plist   version=X.Y.Z  buildNumber=N
  Expo.plist     runtimeVersion=A.B.C
```

Si les fichiers sont désynchronisés, affiche un warning et utilise **app.json comme source de vérité** pour calculer le bump.

### 2. Calculer les nouvelles valeurs

- **patch** : PATCH+1, buildNumber+1, runtimeVersion inchangé
- **minor** : MINOR+1, PATCH=0, buildNumber=**1**, runtimeVersion = nouvelle version
- **major** : MAJOR+1, MINOR=0, PATCH=0, buildNumber=**1**, runtimeVersion = nouvelle version

### 3. Résumer les changements depuis la dernière version

Lance `git log --oneline` depuis le dernier commit de bump mobile (le plus récent commit dont le message commence par `chore(mobile): bump`) jusqu'à HEAD. Liste les sujets des commits (hors chore/docs) pour proposer un résumé.

Affiche les changements identifiés et demande confirmation :

```
Changements depuis X.Y.Z :
  - <résumé point 1>
  - <résumé point 2>
  ...

Bump mobile [TYPE] :
  version        : X.Y.Z → X'.Y'.Z'
  buildNumber    : N → N'  (app.json + Info.plist)
  runtimeVersion : A.B.C → A'.B'.C'  (ou "inchangé")

Appliquer ?
```

### 4. Modifier les fichiers

**`app.json`** :
- `expo.version` → nouvelle version
- `expo.ios.buildNumber` → nouveau buildNumber (string)
- `expo.runtimeVersion` → nouvelle runtimeVersion (uniquement si minor/major)

**`ios/TibFit/Info.plist`** :
- `CFBundleShortVersionString` → nouvelle version
- `CFBundleVersion` → nouveau buildNumber (string)

**`ios/TibFitWidget/Info.plist`** :
- `CFBundleShortVersionString` → nouvelle version (doit être identique à l'app principale, sinon Apple rejette avec ITMS-90473)
- `CFBundleVersion` → nouveau buildNumber (string)

**`ios/TibFit/Supporting/Expo.plist`** :
- `EXUpdatesRuntimeVersion` → nouvelle runtimeVersion (toujours, même pour patch — garder en sync avec app.json)

### 5. Committer dans le repo mobile

```bash
git add app.json ios/TibFit/Info.plist ios/TibFitWidget/Info.plist ios/TibFit/Supporting/Expo.plist
git commit -m "chore(mobile): bump version X'.Y'.Z' build N'"
```

### 6. Mettre à jour CHANGELOG.md dans le repo backend

Le CHANGELOG global vit dans le repo backend (`tibfit-backend`). Rappelle à l'utilisateur de l'ouvrir et d'y ajouter une entrée :

```markdown
## [Mobile X'.Y'.Z'] — YYYY-MM-DD

### Ajouté
- <feature 1>

### Modifié / Corrigé
- <changement 1>
```

### 7. Rappels post-bump

**Pour un bump patch :**
- Une OTA (`/ota`) est possible si les changements sont purement JS.
- Si des fichiers natifs ont changé, un build EAS complet est requis.

**Pour un bump minor ou major :**
- Un build EAS complet est **obligatoire** (runtimeVersion a changé — pas d'OTA applicable).
- Rappelle à l'utilisateur de créer le tag git manuellement après la soumission App Store réussie :
  ```
  git tag vX'.Y'.Z'
  git push origin vX'.Y'.Z'
  ```
