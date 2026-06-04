import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Recording, Capture, VideoConfig, PaneSource, Client, Session, Discipline, PersistedSessionState, Layer, AnnotationElement, AngleElement } from './types';
import { uid } from './utils/canvas';
import { useLayers } from './hooks/useLayers';
import type { LayersState } from './hooks/useLayers';
import { useDevices } from './hooks/useCamera';
import { useRecorder } from './hooks/useRecorder';
import { useSessions } from './hooks/useSessions';
import type { Tool } from './types';
import { Toolbar, COLORS } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { RecordingBar } from './components/RecordingBar';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { SessionSelector } from './components/SessionSelector';
import { NewSessionModal } from './components/NewSessionModal';
import { VideoPane, SourceSelector, type VideoPaneHandle } from './components/VideoPane';
import { useStorage } from './hooks/useStorage';
import { saveRecordingToFile } from './utils/saveFile';
import { UpdateBanner } from './components/UpdateBanner';
import { useCompany } from './hooks/useCompany';

const DEFAULT_CONFIG: VideoConfig = {
  deviceId: '',
  width: 1920, height: 1080,
  frameRate: 60,
  videoBitrate: 8000,
  audioBitrate: 128,
  audioEnabled: false,
};

export default function App() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VideoConfig>(DEFAULT_CONFIG);

  // ── Sessions ───────────────────────────────────────────────────────────────
  const sessions = useSessions();
  const { company, save: saveCompany } = useCompany();
  const [reportData, setReportData] = useState<import('./types').ReportData | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);

  // Ouvre automatiquement la modal si aucune session après chargement.
  // Si une session active est restaurée, charge ses assets depuis le disque.
  // Reset report data when active session changes
  useEffect(() => {
    setReportData(null);
    setReportLoaded(false);
  }, [sessions.activeSession?.id]);

  const sessionLoadedRef = useRef(false);
  useEffect(() => {
    if (sessions.isLoading) return;
    if (!sessions.activeSession) {
      setShowNewSession(true);
      return;
    }
    if (sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;
    const sess = sessions.activeSession;
    sessions.loadSessionAssets(sess).then(async ({ captures: loaded, recordings: loadedRecs }) => {
      setCaptures(loaded);
      setRecordings(loadedRecs);
      await restoreState(sess, loadedRecs);
    });
  }, [sessions.isLoading, sessions.activeSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateClientAndSession = useCallback(async (
    clientData: Pick<Client, 'nom' | 'prenom' | 'email' | 'phone' | 'birthDate'>,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => {
    const client = await sessions.createClient(clientData);
    const session = await sessions.createSession(client.id, sessionData);
    await sessions.setActiveSession(client, session);
    // Réinitialise la mémoire courante
    setCaptures([]);
    setRecordings([]);
    setActiveRecording(null);
    setShowNewSession(false);
  }, [sessions]);

  const handleCreateSessionForClient = useCallback(async (
    clientId: string,
    sessionData: { discipline: Discipline; bikeFitDate: string; notes?: string },
  ) => {
    const client = sessions.clients.find(c => c.id === clientId)!;
    const session = await sessions.createSession(clientId, sessionData);
    await sessions.setActiveSession(client, session);
    // Réinitialise la mémoire courante
    setCaptures([]);
    setRecordings([]);
    setActiveRecording(null);
    setShowNewSession(false);
  }, [sessions]);
  const { devices } = useDevices();
  const recorder = useRecorder();

  // Camera state — fed by VideoPane A callbacks
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraIsActive, setCameraIsActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // UI modes
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Overlay options
  const [showGuide, setShowGuide] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [activeCoteKey, setActiveCoteKey] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);

  // Captures (screenshots with annotations)
  const [captures, setCaptures] = useState<Capture[]>([]);

  const handleCapture = useCallback((blob: Blob, name: string, paneLabel?: string) => {
    const url = URL.createObjectURL(blob);
    const cap: Capture = { id: uid(), name, blob, url, createdAt: new Date(), paneLabel };
    setCaptures(prev => [cap, ...prev]);
    if (sessions.activeSession) {
      sessions.saveCapture(sessions.activeSession, blob, name);
    }
  }, [sessions]);

  const handleDeleteCapture = useCallback((id: string) => {
    setCaptures(prev => {
      const cap = prev.find(c => c.id === id);
      if (cap) URL.revokeObjectURL(cap.url);
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const handleDownloadCapture = useCallback((cap: Capture) => {
    const a = document.createElement('a');
    a.href = cap.url; a.download = cap.name; a.click();
  }, []);

  // Recordings
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeRecording, setActiveRecording] = useState<Recording | null>(null);

  // En mode Electron, le disque est la source de vérité — on désactive IndexedDB.
  // En mode web (dev sans Electron), on garde IndexedDB pour survivre aux rechargements.
  const isElectron = !!(window as unknown as { electronAPI?: unknown }).electronAPI;
  const { persistRecording, removeRecording } = useStorage({
    onLoad: isElectron ? () => {} : recs => setRecordings(recs),
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  // Playback state — fed by VideoPane A callbacks
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Pane refs + split source for pane B only
  const paneRef0 = useRef<VideoPaneHandle>(null);
  const paneRef1 = useRef<VideoPaneHandle>(null);
  const [paneBSource, setPaneBSource] = useState<PaneSource>({ type: 'none' });
  const [activePaneIndex, setActivePaneIndex] = useState<0 | 1>(0);

  // Tools (shared across all canvases)
  const [tool, setTool] = useState<Tool>('angle');
  const [color, setColor] = useState('#ef4444');

  const advanceColor = useCallback(() => {
    setColor(prev => {
      const idx = COLORS.indexOf(prev);
      return COLORS[(idx + 1) % COLORS.length];
    });
  }, []);

  // ── Layer sets — pane A always uses singleLayers in both modes ─────────────
  const singleLayers = useLayers(t('layers.initialA'));
  const paneLayers1  = useLayers(t('layers.initialB'));

  const activeLayers: LayersState = splitMode && activePaneIndex === 1
    ? paneLayers1
    : singleLayers;

  // ── Session state persistence ─────────────────────────────────────────────

  /** Couche vide par défaut */
  const makeDefaultLayer = useCallback((name: string): Layer => ({
    id: uid(), name, visible: true, opacity: 100, locked: false, elements: [],
  }), []);

  /** Sérialise et sauvegarde l'état courant (annotations + source + temps) */
  const saveCurrentState = useCallback(async () => {
    if (!sessions.activeSession?.folderPath) return;

    const paneASource: PersistedSessionState['paneA']['source'] = isLiveMode
      ? { type: 'camera', deviceId: config.deviceId }
      : activeRecording
        ? { type: 'recording', filename: activeRecording.name }
        : { type: 'none' };

    const paneBSrc: PersistedSessionState['paneB']['source'] =
      paneBSource.type === 'camera'    ? { type: 'camera',    deviceId: paneBSource.deviceId }
      : paneBSource.type === 'recording' ? { type: 'recording', filename: paneBSource.recording.name }
      : { type: 'none' };

    const state: PersistedSessionState = {
      paneA: {
        source:       paneASource,
        playbackTime: isLiveMode ? 0 : (paneRef0.current?.getTime() ?? 0),
        layers:       singleLayers.layers,
        activeLayerId: singleLayers.activeLayerId,
      },
      paneB: {
        source:       paneBSrc,
        playbackTime: paneRef1.current?.getTime() ?? 0,
        layers:       paneLayers1.layers,
        activeLayerId: paneLayers1.activeLayerId,
      },
    };

    await sessions.saveSessionState(sessions.activeSession.folderPath, state);
  }, [sessions, isLiveMode, config.deviceId, activeRecording, paneBSource,
      singleLayers, paneLayers1]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Restaure l'état d'une session depuis le disque (ou remet à zéro si aucun état) */
  const restoreState = useCallback(async (
    session: Session, recs: Recording[],
  ) => {
    const state = await sessions.loadSessionState(session.folderPath);

    // ── Layers ──────────────────────────────────────────────────────────────
    if (state?.paneA.layers.length) {
      singleLayers.importLayers(state.paneA.layers, state.paneA.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialA'));
      singleLayers.importLayers([l], l.id);
    }
    if (state?.paneB.layers.length) {
      paneLayers1.importLayers(state.paneB.layers, state.paneB.activeLayerId);
    } else {
      const l = makeDefaultLayer(t('layers.initialB'));
      paneLayers1.importLayers([l], l.id);
    }

    // ── Source pane A ────────────────────────────────────────────────────────
    const srcA = state?.paneA.source ?? { type: 'none' };
    if (srcA.type === 'camera') {
      setIsLiveMode(true);
      setActiveRecording(null);
    } else if (srcA.type === 'recording') {
      const rec = recs.find(r => r.name === srcA.filename) ?? null;
      setActiveRecording(rec);
      setIsLiveMode(false);
      if (rec && (state?.paneA.playbackTime ?? 0) > 0) {
        const t0 = state!.paneA.playbackTime;
        setTimeout(() => paneRef0.current?.seekTo(t0), 400);
      }
    } else {
      setIsLiveMode(false);
      setActiveRecording(null);
    }

    // ── Source pane B ────────────────────────────────────────────────────────
    const srcB = state?.paneB.source ?? { type: 'none' };
    if (srcB.type === 'camera') {
      setPaneBSource({ type: 'camera', deviceId: srcB.deviceId });
    } else if (srcB.type === 'recording') {
      const rec = recs.find(r => r.name === srcB.filename) ?? null;
      if (rec) {
        setPaneBSource({ type: 'recording', recording: rec });
        if ((state?.paneB.playbackTime ?? 0) > 0) {
          const t1 = state!.paneB.playbackTime;
          setTimeout(() => paneRef1.current?.seekTo(t1), 400);
        }
      } else {
        setPaneBSource({ type: 'none' });
      }
    } else {
      setPaneBSource({ type: 'none' });
    }
  }, [sessions, singleLayers, paneLayers1, makeDefaultLayer, t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Change de session : sauvegarde l'état courant → charge la nouvelle */
  const applySession = useCallback(async (client: Client, session: Session) => {
    await saveCurrentState();
    await sessions.setActiveSession(client, session);
    const { captures: loaded, recordings: loadedRecs } = await sessions.loadSessionAssets(session);
    setCaptures(loaded);
    setRecordings(loadedRecs);
    await restoreState(session, loadedRecs);
  }, [saveCurrentState, sessions, restoreState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame-by-frame ──────────────────────────────────────────────────────────
  const stepFrame = useCallback((dir: 1 | -1, frames = 1) => {
    const fps = config.frameRate || 30;
    const activeRef = splitMode && activePaneIndex === 1 ? paneRef1 : paneRef0;
    activeRef.current?.stepFrame(dir, fps, frames);
    // Force seekbar sync — 'seeked' event is not always reliable on first seek
    // (e.g. Firefox with certain codecs, or seek from t=0). We read currentTime
    // directly after one rAF to guarantee the UI updates.
    if (!splitMode || activePaneIndex === 0) {
      requestAnimationFrame(() => {
        const t = paneRef0.current?.getTime();
        if (t !== undefined) setPlaybackTime(t);
      });
    }
  }, [splitMode, activePaneIndex, config.frameRate]);

  const handlePlayPause = useCallback(() => paneRef0.current?.togglePlay(), []);

  const handleSeek = useCallback((t: number) => {
    paneRef0.current?.seekTo(t);
    setPlaybackTime(t);
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    recorder.start(stream, config.videoBitrate, config.audioBitrate);
  }, [recorder, config]);

  const handleStopRecording = useCallback(async () => {
    const rec = await recorder.stop();
    if (!rec) return;
    setRecordings(prev => [rec, ...prev]);
    if (sessions.activeSession) {
      sessions.saveRecording(sessions.activeSession, rec.blob!, rec.name, rec.duration);
    } else {
      // Pas de session active → fallback IndexedDB (mode web)
      persistRecording(rec);
    }
  }, [recorder, persistRecording, sessions]);

  const handleSelectRecording = useCallback((rec: Recording) => {
    setActiveRecording(rec);
    setIsLiveMode(false);
    // Reset seekbar so it doesn't show stale values while the new video loads
    setPlaybackTime(0);
    setPlaybackDuration(0);
  }, []);

  const handleDeleteRecording = useCallback((id: string) => {
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter(r => r.id !== id);
    });
    setActiveRecording(r => (r?.id === id ? null : r));
    removeRecording(id);
  }, [removeRecording]);

  const handleDownloadRecording = useCallback((rec: Recording) => {
    saveRecordingToFile(rec);
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const rec: Recording = { id: uid(), name: file.name, blob: file, url, createdAt: new Date(), duration: 0 };
    setRecordings(prev => [rec, ...prev]);
    persistRecording(rec);
    handleSelectRecording(rec);
    e.target.value = '';
  }, [handleSelectRecording, persistRecording]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key;
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') { e.preventDefault(); activeLayers.undo(); }
        if (k === 'y') { e.preventDefault(); activeLayers.redo(); }
        return;
      }
      if (!isLiveMode && k === 'Enter') { e.preventDefault(); handlePlayPause(); return; }
      if (!isLiveMode && k === 'ArrowLeft')  { e.preventDefault(); stepFrame(-1, e.shiftKey ? 10 : 1); return; }
      if (!isLiveMode && k === 'ArrowRight') { e.preventDefault(); stepFrame(1,  e.shiftKey ? 10 : 1); return; }
      const map: Partial<Record<string, Tool>> = {
        h: 'pan', v: 'select', l: 'line', g: 'angle',
      };
      if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeLayers, isLiveMode, stepFrame]);

  // ── Space bar — temporary pan (hold to pan, release to restore tool) ──────
  const toolRef        = useRef<Tool>(tool);
  const preSpaceTool   = useRef<Tool | null>(null);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (preSpaceTool.current === null && toolRef.current !== 'pan') {
        preSpaceTool.current = toolRef.current;
        setTool('pan');
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      if (preSpaceTool.current !== null) {
        setTool(preSpaceTool.current);
        preSpaceTool.current = null;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, []);

  // ── Shared annotation props factory ───────────────────────────────────────
  function makeAnnotationProps(ls: LayersState) {
    return {
      layers: ls.layers,
      activeLayerId: ls.activeLayerId,
      tool, color, strokeWidth: 2, filled: false,
      onAddElement: (_: string, el: AnnotationElement) => {
        ls.addElementOnNewLayer(el);
        if (el.type === 'line' || el.type === 'arrow' || el.type === 'angle' || el.type === 'path') {
          advanceColor();
        }
      },
      onEraseAt: ls.eraseAt,
      onUpdateElement: ls.updateElement,
      onDeleteElement: ls.deleteElement,
      onBeginDrag: ls.beginDrag,
      onRescaleElements: ls.rescaleElements,
    };
  }

  const activeLayerName = activeLayers.layers.find(l => l.id === activeLayers.activeLayerId)?.name ?? '—';

  const measuredAngles = activeLayers.layers
    .flatMap(l => l.elements)
    .filter((e): e is AngleElement => e.type === 'angle');

  // Stable callbacks for ReportModal — must not be inline or they recreate on every render,
  // which breaks the debounce in the auto-save useEffect inside ReportModal.
  const handleReportSave = useCallback(async (data: import('./types').ReportData) => {
    setReportData(data);
    if (sessions.activeSession?.folderPath) {
      await sessions.saveReport(sessions.activeSession.folderPath, data);
    }
  }, [sessions.activeSession?.folderPath, sessions.saveReport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReportUpdateClient = useCallback(async (
    updates: Partial<Pick<import('./types').Client, 'weight' | 'height'>>,
  ) => {
    if (sessions.activeClient) {
      await sessions.updateClient({ ...sessions.activeClient, ...updates });
    }
  }, [sessions.activeClient, sessions.updateClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Source pane A (single + split A) ─────────────────────────────────────
  // useMemo stabilises the object reference so VideoPane's useEffect([source])
  // only fires when the source actually changes — not on every re-render.
  const singleSource: PaneSource = useMemo(() => {
    if (!isLiveMode && activeRecording) return { type: 'recording', recording: activeRecording };
    if (isLiveMode) return { type: 'camera', deviceId: config.deviceId };
    return { type: 'none' };
  }, [isLiveMode, activeRecording, config.deviceId]);

  const handleDeleteSession = useCallback(async (session: Session) => {
    const wasActive = await sessions.deleteSession(session);
    if (wasActive) {
      setCaptures([]);
      setRecordings([]);
      setActiveRecording(null);
      setIsLiveMode(false);
      setPaneBSource({ type: 'none' });
      setShowNewSession(true);
    }
  }, [sessions]);

  const handleDeleteClient = useCallback(async (client: Client) => {
    const wasActive = await sessions.deleteClient(client);
    if (wasActive) {
      setCaptures([]);
      setRecordings([]);
      setActiveRecording(null);
      setIsLiveMode(false);
      setPaneBSource({ type: 'none' });
      setShowNewSession(true);
    }
  }, [sessions]);

  const handleSingleSourceChange = useCallback((s: PaneSource) => {
    if (s.type === 'camera') {
      if (s.deviceId !== config.deviceId) setConfig(c => ({ ...c, deviceId: s.deviceId }));
      setIsLiveMode(true);
      setActiveRecording(null);
    } else if (s.type === 'recording') {
      handleSelectRecording(s.recording);
    } else {
      setIsLiveMode(false);
      setActiveRecording(null);
    }
  }, [config.deviceId, handleSelectRecording]);

  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] text-slate-100 select-none overflow-hidden">
      <UpdateBanner />
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#13131f] border-b border-[#22223b] shrink-0 h-11">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="RapidFit" className="h-6 w-6" />
          <span className="text-sm font-bold tracking-wide text-white">RapidFit</span>
          <div className="w-px h-4 bg-[#3d3d5c] mx-1" />
          <SessionSelector
            clients={sessions.clients}
            sessionsByClient={sessions.sessionsByClient}
            activeClient={sessions.activeClient}
            activeSession={sessions.activeSession}
            onSelect={applySession}
            onNewSession={() => setShowNewSession(true)}
            onEditClient={async updates => { await sessions.updateClient(updates); }}
            onDeleteSession={handleDeleteSession}
            onDeleteClient={handleDeleteClient}
          />
          <div className="w-px h-4 bg-[#3d3d5c] mx-1" />
          <span className="text-xs text-slate-400 bg-[#22223b] px-2 py-0.5 rounded-md border border-[#3d3d5c]">
            {splitMode && (
              <span className="text-indigo-400 font-medium mr-1">
                {t('header.panel')} {activePaneIndex === 0 ? 'A' : 'B'} —
              </span>
            )}
            {t('header.layer')} : <span className="text-slate-200 font-medium">{activeLayerName}</span>
          </span>
        </div>

        {cameraError && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-1 rounded-lg">
            ⚠ {cameraError}
          </div>
        )}

        <div className="flex items-center gap-2">
          {isLiveMode && !cameraIsActive && !cameraError && (
            <span className="text-xs text-slate-500">{t('header.cameraWaiting')}</span>
          )}

          {/* Overlay toggles */}
          <button
            onClick={() => setShowGuide(g => !g)}
            title={t('header.guidesTitle')}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              showGuide ? 'bg-yellow-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            {t('header.guides')}
          </button>
          <button
            onClick={() => setShowGrid(g => !g)}
            title={t('header.gridTitle')}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            {t('header.grid')}
          </button>

          {/* Grid size controls — visible only when grid is on */}
          {showGrid && (
            <div className="flex items-center gap-1 bg-[#22223b] rounded-lg px-1.5 py-0.5 border border-[#3d3d5c]">
              <button
                onClick={() => setGridSize(s => Math.max(10, s - 10))}
                disabled={gridSize <= 10}
                className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold"
              >−</button>
              <span className="text-xs text-slate-300 w-12 text-center tabular-nums">{gridSize} px</span>
              <button
                onClick={() => setGridSize(s => Math.min(200, s + 10))}
                disabled={gridSize >= 200}
                className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold"
              >+</button>
            </div>
          )}

          <button
            onClick={() => {
              if (!splitMode && activeRecording) {
                const t = playbackTime;
                setTimeout(() => paneRef0.current?.seekTo(t), 50);
              }
              setSplitMode(s => !s);
            }}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              splitMode ? 'bg-indigo-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            {t('header.split')}
          </button>

          <div className="w-px h-4 bg-[#3d3d5c]" />

          <button
            onClick={async () => {
              if (!reportLoaded && sessions.activeSession?.folderPath) {
                const saved = await sessions.loadReport(sessions.activeSession.folderPath);
                setReportData(saved);
                setReportLoaded(true);
              }
              setShowReport(true);
            }}
            className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 font-medium transition-colors"
          >
            {t('header.report')}
          </button>
          <button onClick={() => setShowSettings(true)} title={t('header.settings')} className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 text-sm">
            ⚙
          </button>
          <button onClick={() => setShowHelp(true)} title={t('header.help')} className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 text-sm">
            ?
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          tool={tool} color={color}
          onTool={setTool} onColor={setColor}
          onUndo={activeLayers.undo} onRedo={activeLayers.redo}
          onClear={activeLayers.clearActiveLayer}
          canUndo={activeLayers.history.length > 0}
          canRedo={activeLayers.future.length > 0}
        />

        {/* ── Unified video area — pane A always mounted ── */}
        <div className="flex-1 bg-black overflow-hidden flex flex-col">

          {/* Source selector bar */}
          <div className="flex shrink-0 bg-[#13131f] border-b border-[#22223b] z-20">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${splitMode ? 'flex-1 border-r border-[#22223b]' : 'w-full'}`}>
              <SourceSelector
                source={singleSource} devices={devices} recordings={recordings}
                label={splitMode ? 'A' : t('video.sourceLabel')}
                onChange={handleSingleSourceChange}
              />
            </div>
            {splitMode && (
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5">
                <SourceSelector
                  source={paneBSource} devices={devices} recordings={recordings}
                  label="B" onChange={setPaneBSource}
                />
              </div>
            )}
          </div>

          {/* Panes — pane A always rendered, pane B conditional */}
          <div className="flex flex-1 overflow-hidden relative">
            <VideoPane
              ref={paneRef0}
              source={singleSource} devices={devices} recordings={recordings}
              active={splitMode && activePaneIndex === 0}
              label={splitMode ? 'A' : undefined}
              onFocus={splitMode ? () => setActivePaneIndex(0) : undefined}
              showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
              onCapture={(blob, name) => handleCapture(blob, name, splitMode ? 'A' : undefined)}
              annotationProps={makeAnnotationProps(singleLayers)}
              onStreamChange={s => { cameraStreamRef.current = s; setCameraIsActive(!!s); }}
              onCameraError={setCameraError}
              onTimeUpdate={setPlaybackTime}
              onDurationChange={d => {
                setPlaybackDuration(d);
                // Persist finite duration into the recordings list (fixes 00:00 for
                // disk-backed recordings whose duration was unknown at load time).
                if (isFinite(d) && d > 0) {
                  setRecordings(prev => prev.map(r =>
                    r.id === activeRecording?.id && r.duration === 0 ? { ...r, duration: d } : r,
                  ));
                }
              }}
              onPlayStateChange={p => setPlaybackPaused(p)}
            />
            {splitMode && (
              <>
                <div className="w-px bg-[#22223b] shrink-0" />
                <VideoPane
                  ref={paneRef1}
                  source={paneBSource} devices={devices} recordings={recordings}
                  active={activePaneIndex === 1} label="B"
                  onFocus={() => setActivePaneIndex(1)}
                  showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                  onCapture={(blob, name) => handleCapture(blob, name, 'B')}
                  annotationProps={makeAnnotationProps(paneLayers1)}
                />
              </>
            )}

            {/* REC indicator */}
            {recorder.isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full pointer-events-none" style={{ zIndex: 400 }}>
                <span className={`w-2 h-2 rounded-full ${recorder.isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-xs font-mono text-white font-semibold">{recorder.isPaused ? t('recording.pauseIndicator') : t('recording.rec')}</span>
              </div>
            )}
          </div>

        </div>

        {/* Layer panel shows active pane's layers, with optional cotes section */}
        <LayerPanel
          layers={activeLayers.layers}
          activeLayerId={activeLayers.activeLayerId}
          onSelect={activeLayers.setActiveLayerId}
          {...activeLayers.layerActions}
          cotesProps={sessions.activeSession ? {
            discipline: sessions.activeSession.discipline,
            activeCoteKey,
            measuredAngles,
            onSelectCote: setActiveCoteKey,
          } : undefined}
        />
      </div>

      {/* ── Bottom bar ── */}
      <RecordingBar
        isRecording={recorder.isRecording}
        isPaused={recorder.isPaused}
        elapsed={recorder.elapsed}
        recordings={recordings}
        activeRecordingId={activeRecording?.id ?? null}
        isLiveMode={isLiveMode}
        isPlaybackPaused={playbackPaused}
        playbackTime={playbackTime}
        playbackDuration={playbackDuration}
        onStartRecording={handleStartRecording}
        onPauseRecording={recorder.isPaused ? recorder.resume : recorder.pause}
        onStopRecording={handleStopRecording}
        onSelectRecording={handleSelectRecording}
        onDeleteRecording={handleDeleteRecording}
        onDownloadRecording={handleDownloadRecording}
        onImportVideo={() => importInputRef.current?.click()}
        onLiveMode={() => { setIsLiveMode(true); setActiveRecording(null); }}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onFramePrev={() => stepFrame(-1)}
        onFrameNext={() => stepFrame(1)}
        captures={captures}
        onDownloadCapture={handleDownloadCapture}
        onDeleteCapture={handleDeleteCapture}
      />

      <input ref={importInputRef} type="file" accept="video/*" className="hidden" onChange={handleImportFile} />

      {showNewSession && (
        <NewSessionModal
          clients={sessions.clients}
          canClose={!!sessions.activeSession}
          onClose={() => setShowNewSession(false)}
          onCreateClientAndSession={handleCreateClientAndSession}
          onCreateSessionForClient={handleCreateSessionForClient}
        />
      )}

      {showSettings && (
        <SettingsModal
          config={config}
          onChange={c => { setConfig(c); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
          devices={devices}
          company={company}
          onCompany={saveCompany}
        />
      )}

      {showReport && (
        <ReportModal
          captures={captures}
          client={sessions.activeClient}
          session={sessions.activeSession}
          company={company}
          initialData={reportData}
          onClose={() => setShowReport(false)}
          onUpdateClient={handleReportUpdateClient}
          onSave={handleReportSave}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
          onClick={e => { if (e.target === e.currentTarget) setShowHelp(false); }}
        >
          <div className="bg-[#13131f] border border-[#22223b] rounded-xl p-6 w-[700px] max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-100">{t('help.title')}</h2>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Outils */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.tools')}</h3>
              <div className="flex flex-col gap-1.5">
                {[
                  ['H', '✋', t('help.tool_pan'),    t('help.tool_pan_desc')],
                  ['V', '⊙', t('help.tool_select'), t('help.tool_select_desc')],
                  ['L', '╱', t('help.tool_line'),   t('help.tool_line_desc')],
                  ['G', '∠', t('help.tool_angle'),  t('help.tool_angle_desc')],
                ].map(([key, icon, name, desc]) => (
                  <div key={key} className="flex items-start gap-3 bg-[#22223b] rounded-lg px-3 py-2">
                    <kbd className="shrink-0 w-6 h-6 bg-[#3d3d5c] rounded text-xs font-mono text-slate-300 flex items-center justify-center">{key}</kbd>
                    <span className="text-base w-5 shrink-0">{icon}</span>
                    <div>
                      <span className="text-sm font-medium text-slate-200">{name}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Raccourcis clavier */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.shortcuts')}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  ['H',                          t('help.shortcut_pan')],
                  ['V',                          t('help.shortcut_select')],
                  ['L',                          t('help.shortcut_line')],
                  ['G',                          t('help.shortcut_angle')],
                  [t('help.shortcut_space_key'), t('help.shortcut_space')],
                  [t('help.shortcut_undo_key'),  t('help.shortcut_undo')],
                  [t('help.shortcut_redo_key'),  t('help.shortcut_redo')],
                  [t('help.shortcut_delete_key'),t('help.shortcut_delete')],
                  [t('help.shortcut_enter_key'), t('help.shortcut_enter')],
                  [t('help.shortcut_arrows_key'),t('help.shortcut_arrows')],
                  [t('help.shortcut_shift_key'), t('help.shortcut_shift')],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 min-w-0">
                    <kbd className="shrink-0 bg-[#3d3d5c] rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300 whitespace-nowrap">{key}</kbd>
                    <span className="text-slate-400 text-xs truncate">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Souris & molette */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.mouse')}</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                {[
                  [t('help.mouse_zoom_key'),         t('help.mouse_zoom')],
                  [t('help.mouse_pan_middle_key'),   t('help.mouse_pan_middle')],
                  [t('help.mouse_pan_space_key'),    t('help.mouse_pan_space')],
                  [t('help.mouse_wheel_key'),        t('help.mouse_wheel')],
                  [t('help.mouse_seekbar_key'),      t('help.mouse_seekbar')],
                  [t('help.mouse_seekbar_drag_key'), t('help.mouse_seekbar_drag')],
                  [t('help.mouse_handle_key'),       t('help.mouse_handle')],
                  [t('help.mouse_element_key'),      t('help.mouse_element')],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-start gap-2">
                    <span className="shrink-0 text-slate-500 text-[10px] font-mono bg-[#22223b] rounded px-1.5 py-0.5 whitespace-nowrap">{key}</span>
                    <span className="text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Split screen */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.split')}</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• {t('help.split_desc1')}</p>
                <p>• {t('help.split_desc2')}</p>
                <p>• {t('help.split_desc3')}</p>
              </div>
            </section>

            {/* Calques */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.layers')}</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• <span className="text-slate-300">{t('help.layers_desc1_create')}</span> {t('help.layers_desc1_text').split(' · ')[0]} · <span className="text-slate-300">{t('help.layers_desc1_hide')}</span> {t('help.layers_desc1_text').split(' · ')[1]} · <span className="text-slate-300">{t('help.layers_desc1_lock')}</span> {t('help.layers_desc1_text').split(' · ')[2]} · <span className="text-slate-300">{t('help.layers_desc1_reorder')}</span> {t('help.layers_desc1_text').split(' · ')[3]}</p>
                <p>• {t('help.layers_desc2')}</p>
              </div>
            </section>

            <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">
              {t('help.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
