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

## ✅ Phase 2 — Internationalisation FR/EN (TERMINÉE)

### Objectif
Toute l'interface en français ET anglais, sélecteur de langue dans les paramètres, persisté.

### Ce qui est fait
- `i18next` + `react-i18next` installés
- `src/i18n.ts` : initialisation, langue persistée dans `localStorage` (clé `lang`, défaut `fr`)
- `src/locales/fr.json` + `src/locales/en.json` : toutes les strings extraites
- Sélecteur de langue dans `SettingsModal.tsx` (🇫🇷 Français / 🇬🇧 English), switch live
- Tous les composants migrés : App, Toolbar, RecordingBar, LayerPanel, VideoPane, SettingsModal, ReportModal, UpdateBanner
- `useLayers.ts` utilise `i18n.t()` directement pour les noms de calques auto-générés
- PDF (`ReportModal`) traduit via import direct de `i18n`

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

## 🔄 Phase 3 — Clients & Sessions (EN COURS)

### Objectif
Hiérarchie Client → Session persistée sur disque. Un client peut avoir plusieurs sessions (vélos différents ou suivis dans le temps).

### Structure disque
```
Documents/RapidFit/
  clients.json                      ← index de tous les clients
  last-session.json                 ← { clientId, sessionId } dernière session ouverte
  clients/
    <client-id>/
      client.json                   ← infos permanentes du client
      sessions/
        <session-id>/
          session.json              ← discipline, date, notes
          captures/
          videos/
          reports/
```

### Types
```typescript
interface Client {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  weight?: number;
  height?: number;
  createdAt: string;
  folderPath: string;
}

interface Session {
  id: string;
  clientId: string;
  discipline: 'route' | 'gravel' | 'clm' | 'vtt';
  bikeFitDate: string;
  notes?: string;
  createdAt: string;
  folderPath: string;
}
```

### Ce qui est fait ✅
- `Client` + `Session` + `Discipline` dans `src/types/index.ts`
- IPC Electron : `sessions:list/create-client/create-session/save-capture/save-recording/get-last/set-last` dans `electron/main.ts` + `electron/preload.ts`
- Hook `src/hooks/useSessions.ts` : état global clients/sessions, création, setActiveSession, saveCapture (fallback mémoire en mode web)
- `SessionSelector` dans le header : pill session active + dropdown groupé par client + bouton "+ Nouvelle session"
- `NewSessionModal` : création nouveau client + session (ou session pour client existant), validation, discipline obligatoire
- Démarrage : modal auto si aucune session ; fermeture impossible tant qu'aucune session n'existe
- Changement de session : reset captures + enregistrements en mémoire
- Strings i18n FR/EN ajoutées (`session.*`)

### Reste à faire ⏳
1. ~~**Auto-save captures sur disque**~~ ✅ : `handleCapture` appelle `sessions.saveCapture()`
2. ~~**Auto-save enregistrements**~~ ✅ : `handleStopRecording` appelle `sessions.saveRecording()`
3. **Rechargement captures/enregistrements au changement de session** : IPC `sessions:list-captures` + `sessions:list-recordings` → reconstruire Capture[]/Recording[] depuis `file://` URLs
4. **useStorage (IndexedDB) à rendre session-aware** ou supprimer au profit du filesystem
5. **Reset source vidéo au changement de session**
6. **Suppression session/client** : IPC + UI

### Plan d'action (suite)
1. **Types** : `Client` + `Session` dans `src/types/index.ts`
2. **IPC Electron** (`electron/main.ts` + `electron/preload.ts`) :
   - `sessions:list` → lit `clients.json` + toutes les sessions de chaque client
   - `sessions:create-client` → crée dossier + `client.json` + entrée dans `clients.json`
   - `sessions:create-session` → crée sous-dossier + `session.json`
   - `sessions:save-capture` → écrit blob dans `<session>/captures/`
   - `sessions:save-recording` → écrit blob dans `<session>/videos/`
   - `sessions:set-last` / `sessions:get-last` → lit/écrit `last-session.json`
3. **Hook `useSessions`** : état global clients + session active, appels IPC
4. **Header** : sélecteur de session (dropdown groupé par client) + bouton "Nouvelle session"
5. **Modal `NewSessionModal`** :
   - Nouveau client : nom, prénom, discipline (obligatoire) → crée client + première session
   - Session existante : sélectionner client dans liste → discipline + date → crée session
6. **Démarrage** : charger dernière session via `sessions:get-last` ; si aucune → ouvrir `NewSessionModal`
7. **Changement de session** : vider captures + enregistrements en mémoire, charger nouvelle session

### UI header
```
[ Dupont J. — Route — 03/06/2026  ▾ ]  [ + Nouvelle session ]
```

### Fichiers à créer/modifier
```
src/types/index.ts                  ajouter Client, Session
electron/main.ts                    handlers IPC sessions
electron/preload.ts                 exposer API sessions
src/hooks/useSessions.ts            état global + appels IPC
src/components/SessionSelector.tsx  dropdown header
src/components/NewSessionModal.tsx  création client/session
src/App.tsx                         intégrer sélecteur + démarrage
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

## ✅ Bug caméra Electron (résolu)

### Cause
Problème externe (process macOS bloqué — `VDCAssistant` / `avconferenced`).

### Fix appliqué
- `systemPreferences.askForMediaAccess('camera')` appelé au démarrage Electron (macOS TCC)
- IPC `camera:request-access` + `camera:get-status` exposés dans le preload
- `useCamera.ts` : appelle `cameraRequestAccess` avant `getUserMedia` + affiche `ErrorName: message` pour distinguer `NotAllowedError` vs `NotFoundError`
- `setPermissionCheckHandler` + `setPermissionRequestHandler` déjà en place (couche Electron)

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

## État Git

```
Branche active : dev
Dernière version taguée : v1.0.5
Commits sur dev non mergés sur main :
  - feat: Phase 2 i18n FR/EN + Phase 3 clients & sessions (partiel)
  - feat: Phase 3 suite — édition client, fixes capture/seekbar, caméra Electron
  - feat: auto-save captures/recordings + fix caméra macOS (systemPreferences.askForMediaAccess)
Prochain tag prévu : v1.1.0 (fin Phase 3)
```
