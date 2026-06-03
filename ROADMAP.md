# RapidFit — Roadmap & Contexte projet

## Qu'est-ce que RapidFit ?
Application de bike fitting : analyse vidéo avec annotation (angles, traits), capture d'écran, compte rendu PDF. Utilisée par des fitters professionnels sur leur ordinateur.

---

## Stack technique
- **Frontend** : React 19 + TypeScript + Vite 8 + Tailwind CSS
- **Desktop** : Electron 42 (wrapper autour de l'app web)
- **Tests** : Vitest + Testing Library
- **Distribution** : electron-builder → GitHub Releases (auto-update via electron-updater)
- **Node requis** : v23 (`nvm use 23`)
- **Repo** : GitHub privé `tanaki/rapidfit`
- **Branche de dev** : `dev` → merge sur `main` → tag `vX.Y.Z` pour release

## Commandes clés
```bash
nvm use 23
npm run dev              # web (vite)
npm run dev:electron     # app Electron locale
npm run build:icons      # régénère les icônes depuis public/logo.svg
npm run build:electron:mac   # build DMG local (sans publish)
npm run build:electron:win   # build EXE local (sans publish)
npm test                 # Vitest
git tag vX.Y.Z && git push origin vX.Y.Z  # déclenche GitHub Actions → release
```

---

## ✅ Phase 1 — Electron + Distribution (TERMINÉE — v1.0.5)

### Ce qui est fait
- Wrapper Electron avec `vite-plugin-electron`
- Preload en CJS (sandbox Electron)
- `electron-updater` + `UpdateBanner` in-app (notification de mise à jour)
- GitHub Actions : build Mac (dmg x64+arm64) + Windows (nsis x64) sur tag `vX.Y.Z`
- Token : `GITHUB_TOKEN` built-in avec `permissions: contents: write` (pas de PAT)
- Logo SVG (`public/logo.svg`) + icônes générées (`build/icon.icns`, `build/icon.ico`, `build/icon.png`)
- Scripts : `scripts/build-icons.mjs` + `scripts/build-ico.mjs`
- Tests Vitest : régression split mode (3 tests)
- Fix annotatins : rescale basé sur `videoRect` (object-contain letterbox) au lieu du canvas brut

### Fichiers clés
```
electron/main.ts          process principal (fenêtre, IPC, updater, icône Dock)
electron/preload.ts       bridge IPC (CJS)
public/logo.svg           logo SVG source
build/icon.icns/.ico/.png icônes Electron
src/components/UpdateBanner.tsx  notification mise à jour in-app
src/hooks/useVideoRect.ts  calcul du rect vidéo (letterbox)
.github/workflows/release.yml  CI GitHub Actions
```

---

## ⏳ Phase 2 — Internationalisation FR/EN (PROCHAINE)

### Objectif
Toute l'interface en français ET anglais, sélecteur de langue dans les paramètres, persisté.

### Plan d'action
1. Installer `i18next` + `react-i18next`
2. Créer `src/locales/fr.json` + `src/locales/en.json`
3. Extraire toutes les strings de l'app
4. Ajouter un sélecteur de langue dans `SettingsModal.tsx`
5. Persister le choix (localStorage ou electron-store)

### Fichiers à traiter
- `src/App.tsx` (header, boutons, modales)
- `src/components/Toolbar.tsx`
- `src/components/RecordingBar.tsx`
- `src/components/LayerPanel.tsx`
- `src/components/VideoPane.tsx` (labels source, placeholder)
- `src/components/SettingsModal.tsx`
- `src/components/ReportModal.tsx`
- `src/components/UpdateBanner.tsx`
- La modale "Aide" dans App.tsx

### Strings FR déjà présentes (exemples)
```
"Calque 1", "Calque B-1", "Panneau A/B", "Compte rendu", "Split",
"Paramètres", "Aide", "En attente de la caméra…", "Aucune source",
"Capturer", "Caméras", "Enregistrements", "Source",
"Afficher/masquer les guides", "Afficher/masquer la grille",
"Guide d'utilisation", "Raccourcis clavier", etc.
```

---

## ⏳ Phase 3 — Gestion de profils clients

### Objectif
Enregistrement des clients sur le disque de l'utilisateur, avec dossiers dédiés pour vidéos et captures.

### Plan d'action
1. Nouveau type `ClientProfile` dans `src/types/index.ts`
2. IPC Electron pour accès au filesystem (`electron/main.ts`)
3. Stockage : `Documents/RapidFit/Clients/<nom>/` avec `profile.json`, `captures/`, `videos/`, `reports/`
4. Écran liste clients (création / édition / suppression)
5. Lier la session en cours à un client → auto-save captures + enregistrements dans son dossier
6. Historique des sessions par client

### Type à créer
```typescript
interface ClientProfile {
  id: string;
  name: string;
  birthDate?: string;
  weight?: number;
  height?: number;
  discipline: 'route' | 'gravel' | 'clm' | 'vtt';
  notes?: string;
  bikeFitDate: string;
  createdAt: string;
  folderPath: string;
}
```

---

## ⏳ Phase 4 — Aides visuelles (tableau des cotes)

### Objectif
Tableau de référence des angles/cotes à mesurer selon la discipline du client actif.

### Plan d'action
1. Données de référence par discipline (Route / Gravel / CLM / VTT)
2. Panel latéral ou overlay escamotable "Guide des cotes"
3. Comparaison mesure réelle vs valeur cible (indicateur vert/orange/rouge)

### Exemple de données
| Mesure | Route | Gravel | CLM | VTT |
|--------|-------|--------|-----|-----|
| Angle genou extension | 140–150° | 140–150° | 145–155° | 135–145° |
| Angle tronc | 40–50° | 45–55° | 20–35° | 55–65° |
| … | … | … | … | … |

> **Action requise** : valider les valeurs de référence métier avant implémentation

---

## ⏳ Phase 5 — Compte rendu amélioré (PDF + mail)

### Objectif
Export PDF structuré + envoi mail direct depuis l'app + paramètres entreprise.

### Plan d'action

**5.1 PDF enrichi**
- Template : infos client, date, discipline, tableau des mesures, captures avec légendes
- Logo + coordonnées de l'entreprise
- `jspdf` + `html2canvas` déjà installés

**5.2 Envoi mail**
- `nodemailer` dans le process main Electron (IPC)
- UI : destinataire + sujet + corps + pièce jointe PDF
- Config SMTP dans les paramètres (ou OAuth Gmail/Outlook)

**5.3 Paramètres entreprise**
- Logo (upload, stocké dans userData Electron)
- Nom, adresse, téléphone, site web
- Alimentent l'en-tête du PDF

---

## ⏳ Phase 6 — Features avancées

À prioriser selon les retours utilisateurs :

- **Double caméra simultanée** : 2 flux live côte à côte avec enregistrement synchronisé (mode Split existe déjà, mais enregistrements séparés)
- **Mesure de distance** : outil px ou étalonnage réel (cm)
- **Timecode synchronisé** : entre les deux panneaux en split
- **Comparaison avant/après** : session N vs session N-1 pour un même client
- **Export vidéo annotée** : rendu vidéo avec annotations incrustées

---

## Dépendances entre phases
```
Phase 2 (i18n)          ← peut commencer maintenant
    └── Phase 3 (Clients)     ← nécessite Electron filesystem IPC
            ├── Phase 4 (Cotes)      ← nécessite le profil discipline
            └── Phase 5 (PDF/mail)   ← nécessite le profil client
                        └── Phase 6 (features avancées)
```

---

## Décisions techniques prises

| Sujet | Décision |
|-------|----------|
| Distribution updates | GitHub Releases + `GITHUB_TOKEN` built-in (pas de PAT) |
| Build CI | GitHub Actions, Node 22, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`, `windows-2022` |
| Coordonnées annotations | Espace vidéo (`useVideoRect`) — corrigé pour letterbox `object-contain` |
| Icônes Electron | `@resvg/resvg-js` → PNG → `iconutil` (icns) + `png-to-ico` (ico) |
| Tests | Vitest + Testing Library, setup dans `src/test/setup.ts` |
| Versions Node | `.nvmrc` = 23, CI = 22 |

---

## Problèmes ESLint connus (préexistants, non bloquants)

Ces erreurs existaient avant la Phase 1 et ne bloquent pas le build ni les tests :
- `react-hooks/refs` dans `useLayers.ts`, `RecordingBar.tsx`, `ZoomPane.tsx`
- `react-hooks/set-state-in-effect` dans `AnnotationCanvas.tsx`, `useCamera.ts`
- `no-unused-expressions` dans `ReportModal.tsx`, `VideoPane.tsx`
- `react-refresh/only-export-components` dans `Toolbar.tsx`

---

## État Git au moment de cet export

```
Branche active : dev
Dernière version : v1.0.5
Tags : v0.0.1 → v0.0.3, v1.0.0 → v1.0.5
```
