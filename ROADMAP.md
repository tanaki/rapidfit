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

## ✅ Phase 3 — Clients & Sessions (TERMINÉE)

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

### Ce qui est fait ✅ (complet)
- `Client` + `Session` + `Discipline` dans `src/types/index.ts`
- IPC Electron : list, create-client/session, save-capture/recording, get/set-last, list-captures/recordings, save/load-state, delete-session/client, get-file-server-port
- Hook `useSessions.ts` : état global, création, applySession, saveCapture/Recording, loadSessionAssets, saveSessionState/loadSessionState, deleteSession/Client
- `SessionSelector` : pill header, dropdown groupé par client, boutons ✏ et 🗑 au hover
- `NewSessionModal` + `EditClientModal`
- Serveur HTTP local 127.0.0.1 (port OS aléatoire) → sert captures + vidéos avec Range requests
- Persistance état par session (`session-state.json`) : annotations A/B, source A/B, position de lecture A/B
- Sidecar `.info.json` → durée correcte des recordings dans la bibliothèque
- Fix seekbar WebM (duration Infinity → seek-to-end fix)
- Fix prod Electron : `base: './'` dans vite.config (écran blanc résolu)
- DevTools accessibles en prod via Cmd+Option+I

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

## ✅ Phase 4 — Aides visuelles (tableau des cotes) — TERMINÉE

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

### Plan d'action Phase 4
1. **Données** : valeurs de référence par discipline à valider avec Nico (fournies demain matin)
2. **Types** : `ReferenceAngles` par discipline dans `src/types/index.ts`
3. **UI** : panneau latéral ou overlay escamotable "Guide des cotes" (bouton Guides déjà présent dans la toolbar)
4. **Comparaison** : mesure réelle vs valeur cible → indicateur vert/orange/rouge
5. **i18n** : labels FR/EN pour chaque mesure

### Ce qui est fait ✅
- `src/data/referenceAngles.ts` : données par discipline (route/gravel/clm/vtt), `findClosestRow`, `getStatus`
- `src/components/GuidePanel.tsx` : panneau latéral 256px, tableau cotes + section angles mesurés avec badge vert/orange/rouge
- `src/App.tsx` : extraction `AngleElement` des calques actifs, `<GuidePanel>` togglé par le bouton Guides existant
- i18n FR + EN : toutes les clés `guide.*`

### Fichiers créés/modifiés
```
src/data/referenceAngles.ts     données de référence + logique de statut
src/components/GuidePanel.tsx   composant panneau
src/locales/fr.json             clés guide.*
src/locales/en.json             clés guide.*
src/App.tsx                     intégration (import AngleElement + GuidePanel)
```

### Notes métier intégrées
- Gravel = valeurs route endurance
- Hanche / Tronc / Épaule : valeurs endurance affichées, note compétition en sous-label
- Cheville genou fléchi : `~110°` affiché comme plage 105–115° avec flag `approx`
- Alignement tubérosité tibiale : ligne "vérification visuelle" (non mesurable)
- Matching mesure réelle → par proximité de centre de plage sur la discipline active

---

## ✅ Phase 5 — Compte rendu amélioré (PDF) — TERMINÉE

### Objectif
Export PDF structuré + envoi mail direct depuis l'app + paramètres entreprise.

### Ce qui est fait ✅

**5.3 Paramètres entreprise**
- Nom, sous-titre, logo (upload → resize → base64) stockés dans `userData/company-settings.json`
- Éditable depuis ⚙ Paramètres (section Entreprise en bas)
- Logo affiché dans l'en-tête PDF, nom + "Étude posturale — date" répété sur chaque page

**5.1 PDF enrichi (7 sections en accordéon)**
- Section 1 : Informations client (pré-remplies depuis session)
- Section 2 : Profil de pratique (niveau, ancienneté, volume hebdo/annuel)
- Section 3 : Diagnostic (motif, douleurs, vélo, blessures, autres sports)
- Section 4 : Tests physiologiques (pieds, genoux, souplesse, squat, fente avant — boutons radio + commentaire)
- Section 5 : Bilan de l'étude (champ libre)
- Section 6 : Fiche de cotes (matériel + diagramme SVG vélo + tableaux A-M et 1-5 éditables)
- Section 7 : Captures (sélection)
- Persistance : `report.json` par session (auto-save débounced 800ms)
- Génération PDF jsPDF : 3 pages structurées + pages captures

**Fichiers créés/modifiés**
```
src/types/index.ts                     CompanySettings, ReportData, DEFAULT_REPORT
electron/main.ts                       IPC company:get/save, sessions:save/load-report
electron/preload.ts                    exposition des 4 nouveaux IPC
src/hooks/useCompany.ts                hook load/save paramètres entreprise
src/hooks/useSessions.ts               saveReport, loadReport
src/components/SettingsModal.tsx       section Entreprise (nom, sous-titre, logo)
src/components/BikeMeasurementDiagram.tsx  SVG vélo avec annotations A-M + insets cintre/potence
src/components/ReportModal.tsx         redesign complet (7 sections accordéon + PDF)
src/App.tsx                            branché useCompany + chargement report.json
```

**5.2 Envoi mail** — reporté à une version ultérieure

### Fixes post-livraison (tous mergés sur dev)
- Captures Avant/Après côte à côte dans le PDF
- Discipline dans le nom de fichier PDF
- Overlaps label/valeur dans le PDF (field() dynamique)
- Canvas tainted → CORS headers + crossOrigin sur video
- Perte de données compte rendu au changement de session (debounce + save-on-close)
- Email + téléphone entreprise dans le header PDF
- Header PDF redesigné (3 colonnes : logo | infos | date)
- Hauteur image bike-diagram calculée sur les dimensions réelles du PNG
- Image bike-diagram.png intégrée dans le PDF
- `public/bike-diagram.png` à fournir par l'utilisateur (slot prêt, SVG en fallback)

### Dernière version taguée : v1.5.6 — version courante sur dev : v1.5.6

### Plan d'action original (archivé)

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

## ✅ Post-Phase 5 — Stabilisation & polissage (v1.4.0, non tagué)

### Corrections de bugs

- **Promise non résolue** : `useRecorder.stop()` ne résolvait jamais si `recorderRef` était null → retourne `null` proprement
- **Chaîne FR codée en dur** : `useLayers.layerActions.onAdd` utilisait `"Calque X"` au lieu de `i18n.t('layers.default')` → corrigé
- **Dead code** : `renderCaptureGroup` (32 lignes) supprimée de `ReportModal` — remplacée par `renderCol` mais jamais retirée ; props `captures`/`otherLabel` inutilisées dans `CaptureSlot`
- **Erreurs TypeScript** : les 3 erreurs `TS6133` (unused) ci-dessus, maintenant zéro erreur
- **`bike-diagram.png` absent du PDF packagé** : `window.location.origin = "null"` en `file://` → URL invalide. Fix : IPC `app:get-asset-path` + `getAppAssetUrl()` utilise le file server local en production
- **Caméra non détectée sur autre ordinateur** (USB / iPhone Continuity Camera) :
  - `{ exact: deviceId }` → `{ ideal: deviceId }` dans `useCamera.ts` (fallback si deviceId inconnu)
  - `useDevices` : `enumerateDevices()` en premier (fonctionne en Electron sans probe), probe seulement si labels vides — l'ancienne probe `getUserMedia` comme seule stratégie échouait silencieusement
  - `setPermissionCheckHandler` / `RequestHandler` élargis à `'camera'` et `'microphone'` (Electron 42 / Chromium 130)

### Nouvelles fonctionnalités

- **Source image dans les panes** : clic sur une miniature de capture → affichée dans la pane active (ou splitview B) ; import PNG/JPG/WebP → crée une Capture ; `SourceSelector` liste les captures comme source ; `VideoPane` rend `<img>` avec `object-contain` + canvas d'annotations au-dessus ; persistance dans `session-state.json`
- **Zoom trackpad moins sensible** : détection trackpad (`deltaMode=0 && |deltaY|<40`) → delta proportionnel `×0.008` au lieu de saut fixe `±0.25` par event
- **Renommage calque au clic sur cote** : clic sur une ligne du guide des cotes → `findBestAngleForRow` identifie l'angle le plus proche → calque renommé avec le libellé i18n de la cote (annulable Ctrl+Z)
- **Bouton ↺ Actualiser les caméras** : dans chaque SourceSelector, permet de re-scanner sans redémarrer l'app (utile si caméra branchée après démarrage ou TCC accordé mid-session)

### Fichiers principaux touchés
```
package.json                       version 1.1.0 → 1.4.0
electron/main.ts                   IPC app:get-asset-path, permissions caméra élargies
electron/preload.ts                expose appGetAssetPath
src/hooks/useCamera.ts             exact→ideal, useDevices robuste
src/hooks/useRecorder.ts           stop() résout null au lieu de pendre
src/hooks/useLayers.ts             layerActions.onAdd i18n
src/hooks/useZoomPan.ts            zoom trackpad proportionnel
src/components/ReportModal.tsx     getAppAssetUrl(), dead code supprimé
src/components/VideoPane.tsx       source image, SourceSelector + bouton ↺ + onRefreshDevices
src/components/RecordingBar.tsx    onSelectCapture + bouton 👁
src/types/index.ts                 PaneSource + SavedPaneSource + type image
src/App.tsx                        activeImage state, handleSelectCapture, handleSelectCote renommage
src/locales/fr.json + en.json      clé video.refreshCameras
```

---

## ⏳ Phase 6 — Double caméra synchronisée

### Objectif
Deux flux caméra live côte à côte, enregistrement **synchronisé** (même timestamp de départ), lecture synchronisée (scrubbing des deux panes en même temps).

Le mode Split existe déjà mais les deux enregistrements sont indépendants — un fitter ne peut pas comparer avant/après pédalage si les vidéos ne sont pas calées.

### Plan d'action
1. **Sync démarrage** : un seul bouton "Enregistrer" démarre les deux `MediaRecorder` avec le même timestamp `t0` — stocker `t0` dans le sidecar `.info.json`
2. **Sync lecture** : en mode Split, le scrubbing de la pane A pilote la pane B (même `currentTime`) — opt-in via un bouton "🔗 Sync"
3. **Sync pause/lecture** : espace / Enter agit sur les deux panes quand le lien est actif
4. **UI** : indicateur visuel "SYNC" dans la barre quand le lien est actif ; désactivable pour lecture indépendante
5. **Persistance** : `session-state.json` mémorise si le sync était actif

### Fichiers à créer/modifier
```
src/App.tsx                  état syncEnabled, handler scrubbing pane A → pane B
src/components/RecordingBar.tsx   bouton 🔗 Sync + indicateur
src/hooks/useRecorder.ts     start() retourne le timestamp t0
electron/main.ts             sessions:save-recording → stocker syncT0 dans .info.json
src/types/index.ts           Recording.syncT0?: number
```

---

## 🚧 Phase 7 — Suivi de points (tracking) — EN COURS (v1.5.26)

### Objectif
Suivre le déplacement d'un point anatomique frame par frame sur une vidéo pour visualiser la trajectoire du mouvement — ex. pied/cheville sur un tour de pédalage complet, pour détecter si le pédalage est rond/ovale, régulier ou avec des compensations.

### Ce que ça apporte au fitter
- Tracé de la trajectoire réelle du pied en ellipse (ou pas)
- Détection d'asymétrie gauche/droite (Split mode)
- Visualisation de la régularité du pédalage tour par tour
- Exportable en PNG dans le compte rendu PDF

### Ce qui est fait ✅

**Outil Trajectoire (Phase C)**
- Lucas-Kanade sparse optical flow — pure TypeScript, Web Worker, Transferable ArrayBuffer
- Outil `trajectory` dans la Toolbar (icône courbe pointillée) — indépendant du squelette
- Clic sur la vidéo → crée un calque nommé ("Trajectoire 1"…) et démarre le tracking du point
- `TrajectoryCanvas` : canvas offscreen **par trajectoire** en coordonnées vidéo (imgW × imgH)
  - Segments accumulés de façon incrémentale, jamais effacés
  - Hide / delete du calque → composite skip, pixels intacts (pas de redraw depuis les points)
  - Zoom / pan → `drawImage` repositionne sans redraw
  - Drift couleur : `segmentColor(base, globalIdx)` — s'éclaircit sur 1800 frames (~60 s), stable
- Crosshair dynamique (cercle + 4 ticks) au dernier point tracké
- Buffer tournant `MAX_HISTORY = 64` (suffisant pour dessin incrémental — pas de stockage de toute l'historique)
- `TrackingState.source: 'skeleton' | 'trajectory' | null` — découplage complet :
  - Bandeau "Stop tracking" et bouton crosshair n'apparaissent que pour `source === 'skeleton'`
- Touche Espace → play/pause vidéo (plus de pan temporaire)
- Tests : 17 tests Vitest (`segmentColor`, `useTracking` complet)

### Ce qui reste à faire — outil squelette nécessite du travail

L'outil de **suivi squelette** (tracking LK sur les joints anatomiques) est fonctionnel au niveau worker mais l'UX et la robustesse sont encore insuffisantes :

- **Initialisation** : les points de départ sont extraits du squelette dessiné manuellement — si la pose initiale est imprécise, le tracking dérive vite
- **Perte de point** : quand un joint sort du cadre ou est occulté, le tracking ne récupère pas (flag `lost` ignoré côté UI)
- **Feedback visuel** : pas d'indicateur de confiance par joint (quel point est bien tracké vs perdu)
- **Correction manuelle** : pas de moyen de repositionner un point tracké à la volée
- **Performance** : le worker tourne en RAF même quand la vidéo est en pause
- **Reset sélectif** : impossible de réinitialiser un seul joint sans tout arrêter

### Plan d'action initial (archivé)
1. Outil "tracking" dans la Toolbar ✅
2. Pose d'un point sur la vidéo ✅ (outil trajectoire)
3. Propagation semi-auto (tracking LK) ✅
4. Visualisation trajectoire ✅
5. Analyse ellipse / régularité — non commencé
6. Export PNG → PDF — non commencé

---

## ⏳ Phase 8 — Comparaison avant/après

### Objectif
Comparer deux sessions d'un même client côte à côte — session N (fitting du jour) vs session N-1 (fitting précédent) — pour montrer la progression ou valider les ajustements.

### Plan d'action
1. Sélecteur "Comparer avec…" dans le `SessionSelector` → charge une session archivée en pane B
2. Chargement des captures/vidéos de la session historique via le file server existant
3. Les annotations de la session historique sont en lecture seule (calques grisés)
4. Export PDF : page de comparaison avec captures des deux sessions côte à côte

---

## ⏳ Phase 9 — Export vidéo annotée

### Objectif
Exporter une vidéo MP4 avec les annotations incrustées (calques dessinés frame par frame sur la vidéo).

### Complexité
Élevée — nécessite un rendu off-screen canvas frame par frame + encodage vidéo côté main process (ffmpeg via `@ffmpeg/ffmpeg` WASM ou binaire natif). À faire après les phases de tracking et comparaison qui auront stabilisé le modèle de calques.

---

## Dépendances entre phases
```
Phase 1 (Electron)
  └── Phase 2 (i18n)
        └── Phase 3 (Clients/Sessions)
              ├── Phase 4 (Cotes)
              └── Phase 5 (PDF)
                    └── Phase 6 (Double caméra sync)   ← PROCHAINE
                          └── Phase 7 (Tracking points)
                                └── Phase 8 (Comparaison avant/après)
                                      └── Phase 9 (Export vidéo annotée)
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

## ✅ Post-Phase 5 — Session bugfix & polish (v1.5.16+, non tagué)

### Fixes split view / player
- **PanePlayer** : nouveau composant player indépendant par pane (seekbar + play/pause + frame step). En mode normal et split, chaque pane a son propre player sous la vidéo. La RecordingBar ne contient plus de player.
- **États player séparés** : `playbackTime/Duration/Paused` (pane A) + `playbackTimeB/DurationB/PausedB` (pane B). `setPaneBSource` réinitialise les états B.
- **Flèches clavier** : handler clavier utilise des refs pour `isLiveMode`/`activePaneIsB`/`paneBSource` → plus de closures périmées. Vérifie le live mode de la pane **active** (pas toujours pane A).
- **Auto-pause sur step** : `VideoPane.stepFrame` fait `v.pause()` si nécessaire avant de changer `currentTime`.
- **Frame non mise à jour** : workaround bug Chromium — `v.play().then(() => v.pause())` après `currentTime = X` force le rendu de la frame.
- **Seekbar vs frame** : suppression des `requestAnimationFrame` prématurés dans `stepFrame` App + handlers PanePlayer. La seekbar se met à jour via l'event `seeked` → `onTimeUpdate`, en même temps que la frame.

### Fix captures
- **Résolution native** : `capturePane` génère maintenant au format natif de la source (`video.videoWidth × videoHeight` ou `img.naturalWidth × naturalHeight`) au lieu de la taille CSS du conteneur.
- **Annotations alignées** : re-rendu des calques à zoom=1 sur un canvas intermédiaire `videoRect.w × videoRect.h`, puis scaling vers la résolution native. Aucun décalage quel que soit le zoom courant.

### Compte rendu
- **Lightbox captures** : dans CaptureSlot, cliquer sur une miniature ouvre un aperçu plein écran (overlay). Bouton ✕ séparé pour retirer.
- **Exclusion mutuelle** : prop `excluded` sur CaptureSlot — une capture déjà dans "Avant" disparaît de la liste disponible de "Après" et vice versa.
- **Dates** : utilitaire `src/utils/formatDate.ts` → `formatDateFR(iso)`. Appliqué dans `reportPdf.ts` (birthDate, bikeFitDate) et `ReportModal.tsx`.

### Suppression fichiers disque
- `Capture.filePath` et `Recording.filePath` ajoutés au type, populés depuis `list-captures` / `list-recordings`.
- IPC `sessions:delete-capture` + `sessions:delete-recording` (unlink + sidecar `.info.json`).
- Confirmation inline dans `CaptureCard` et `RecordingRow` avant suppression effective.

### Mises à jour manuelles
- IPC `updater:check-now` → déclenche `checkForUpdatesMac` ou `autoUpdater.checkForUpdates()`.
- Event `update-not-available` ajouté (Mac + Windows).
- Section "Mises à jour" dans `HelpModal` : états `idle / checking / up-to-date / downloading / ready / error`, bouton "Installer et redémarrer" quand prêt.

### Nouvel outil : Angle H/V
- Type `HVAngleElement` (`type: 'hv-angle'`, `p1`, `p2`, `angle`).
- Interaction : clic-glisser (identique à `line`).
- Rendu : ligne pleine + ligne de référence pointillée (H si angle ≤ 45°, V sinon) + arc + label en degrés.
- Intégré dans `hitTestElement`, `getHandles`, `applyHandleDrag`, `moveElement`, `drawElement`.
- Bouton ⊾ dans la Toolbar, clés i18n FR/EN.

---

## État Git

```
Branche active : dev
Dernière version taguée : v1.5.16
Version courante sur dev : v1.5.26 (non tagué — Phase 7 en cours)
Pour publier : bump version dans package.json → git tag vX.Y.Z && git push origin vX.Y.Z
```

## Décisions techniques Phase 3 (ajouts)

| Sujet | Décision |
|-------|----------|
| Servir fichiers locaux | Serveur HTTP Node.js 127.0.0.1 port aléatoire (plus fiable que custom protocol Electron) |
| Durée recordings | Sidecar `<filename>.info.json` écrit à l'enregistrement, lu au listing |
| Seekbar WebM | Seek à `1e101` au `loadedmetadata` si `duration = Infinity`, retour position après `durationchange` |
| Persistance état session | `session-state.json` par session (layers A/B, source A/B, playbackTime A/B) |
| Build prod Electron | `base: './'` dans vite.config (pas `/`) pour que les assets se résolvent correctement en `file://` |
| Distribution sans compte Apple | Build local `npm run build:electron:mac` → pas de quarantaine Gatekeeper |
