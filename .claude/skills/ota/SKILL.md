# Skill: ota

Publie une mise à jour OTA (Expo Updates) vers la branche production.

## Quand invoquer

Quand l'utilisateur tape `/ota`.

## Protocole

### 1. Lire le contexte

Lis `app.json` et récupère :
- `version`
- `ios.buildNumber`
- `runtimeVersion`

### 2. Vérifier que l'OTA est applicable

Vérifie si les changements récents touchent des fichiers natifs — si oui, une OTA ne suffit pas :

```bash
git diff HEAD~1 --name-only
```

Si la liste contient l'un de ces éléments, **stoppe et informe** que c'est un build EAS complet qui est requis :
- `ios/` (pods, entitlements, Info.plist)
- `app.json` sur les champs `runtimeVersion`, `splash`, `icon`, `plugins`
- tout fichier natif (`.m`, `.swift`, `.h`)

### 3. Demander le message de description

Si l'OTA est applicable, demande :
> Quel est le message de description pour cette mise à jour ? (ex: "Fix décalage horaire calendrier")

### 4. Confirmer avant de publier

Affiche un récap et demande confirmation :

```
Version    : <version> (build <buildNumber>)
Runtime    : <runtimeVersion>
Branche    : production
Message    : "<message>"

Lancer l'OTA ?
```

### 5. Publier

Une fois confirmé, exécute depuis la racine du repo mobile :

```bash
eas update --branch production --message "<message>"
```

### 6. Résumé

Affiche le résultat de la commande. Rappelle que :
- le bundle JS est téléchargé en arrière-plan à la prochaine ouverture de l'app
- si la mise à jour ne s'applique pas, vérifier que `runtimeVersion` correspond bien au build en production
