# Skill: release-prep (mobile)

Checklist mobile avant une soumission App Store pour TibFit.

## Quand invoquer

Quand l'utilisateur tape `/release-prep`.

## Protocole

Exécute chaque étape dans l'ordre. Pour chaque point, indique ✅ OK / ⚠️ À corriger / ❌ Bloquant.

### 1. Version & build

Lis `app.json` et vérifie :
- `version` correspond à la version cible (ex. 2.3.0)
- `ios.buildNumber` est incrémenté par rapport au build précédent en production
- `runtimeVersion` est cohérent avec `version` (change uniquement si dépendances natives changées)

Lis aussi `ios/TibFit/Info.plist` et vérifie que `CFBundleShortVersionString` et `CFBundleVersion` sont synchronisés avec `app.json`.

### 2. TODO.md — items bloquants

TODO.md vit dans le repo backend (`tibfit-backend`). Ouvre `../TODO.md` si accessible, sinon demande à l'utilisateur de vérifier manuellement.

Liste les items non cochés `[ ]` liés à la version en cours. Signale chaque item bloquant clairement.

### 3. OTA ou build complet ?

Vérifie les changements depuis le dernier build App Store :

```bash
git log --oneline $(git tag --sort=-version:refname | head -1)..HEAD
```

Si des fichiers natifs ont changé (`ios/`, `app.json` sur `runtimeVersion`/`splash`/`icon`/`plugins`), c'est un **build EAS complet** obligatoire. Sinon, une OTA est possible.

Affiche clairement :
- **OTA possible** : `eas update --branch production`
- **Build complet requis** : `eas build --platform ios --profile production`

### 4. Git status

Vérifie que le repo mobile est propre (`git status --short`). Tout fichier non commité = ⚠️.

### 5. Ordre de déploiement

Rappelle la règle critique : **lancer `/release-prep` dans le repo backend en premier**, puis déployer le backend, puis soumettre le mobile.

```
1. [repo backend] /release-prep  → vérifier tests + légal
2. [repo backend] git push       → déployer le backend
3. eas build --platform ios --profile production
4. eas submit  (ou Transporter)
5. App Store Connect → "Release" (après validation Apple)
```

### 6. Récap final

| Étape | Statut | Action requise |
|-------|--------|----------------|
| Version & build | … | … |
| TODO bloquants | … | … |
| OTA ou build | … | … |
| Git status | … | … |

Si tout est ✅ : "Mobile prêt pour la soumission."
Si un ❌ est présent : "Soumission bloquée — corriger avant de builder."
