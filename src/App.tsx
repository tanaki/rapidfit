import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoConfig, PaneSource, AnnotationElement } from './types';
import { useLayers } from './hooks/useLayers';
import type { LayersState } from './hooks/useLayers';
import { useDevices } from './hooks/useCamera';
import { useRecorder } from './hooks/useRecorder';
import { useSessions } from './hooks/useSessions';
import { useAppMedia } from './hooks/useAppMedia';
import { useAppSession } from './hooks/useAppSession';
import type { Tool } from './types';
import { Toolbar, COLORS } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { RecordingBar } from './components/RecordingBar';
import { MediaPanel } from './components/MediaPanel';
import { HelpModal } from './components/HelpModal';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { SessionSelector } from './components/SessionSelector';
import { NewSessionModal } from './components/NewSessionModal';
import { VideoPane, SourceSelector, type VideoPaneHandle } from './components/VideoPane';
import { PanePlayer } from './components/PanePlayer';
import { useStorage } from './hooks/useStorage';
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

  const sessions = useSessions();
  const { company, save: saveCompany } = useCompany();

  const { devices, refresh: refreshDevices } = useDevices();
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
  const [gridSize, setGridSize] = useState(50);

  // Pane refs + split source for pane B only
  const paneRef0 = useRef<VideoPaneHandle>(null);
  const paneRef1 = useRef<VideoPaneHandle>(null);
  const [paneBSource, setPaneBSourceRaw] = useState<PaneSource>({ type: 'none' });
  const [activePaneIndex, setActivePaneIndex] = useState<0 | 1>(0);

  // Playback state B — declared early so setPaneBSource can reference the setters
  const [playbackPausedB, setPlaybackPausedB] = useState(true);
  const [playbackTimeB, setPlaybackTimeB] = useState(0);
  const [playbackDurationB, setPlaybackDurationB] = useState(0);

  const setPaneBSource = useCallback((s: PaneSource) => {
    setPaneBSourceRaw(s);
    // Reset pane B player state when source changes
    setPlaybackTimeB(0);
    setPlaybackDurationB(0);
    setPlaybackPausedB(true);
  }, []);

  // Tools (shared across all canvases)
  const [tool, setTool] = useState<Tool>('angle');
  const [color, setColor] = useState('#ef4444');

  const advanceColor = useCallback(() => {
    setColor(prev => {
      const idx = COLORS.indexOf(prev);
      return COLORS[(idx + 1) % COLORS.length];
    });
  }, []);

  // Layer sets — pane A always uses singleLayers in both modes
  const singleLayers = useLayers(t('layers.initialA'));
  const paneLayers1  = useLayers(t('layers.initialB'));

  const activeLayers: LayersState = splitMode && activePaneIndex === 1
    ? paneLayers1
    : singleLayers;

  // En mode Electron, le disque est la source de vérité — on désactive IndexedDB.
  const isElectron = !!(window as unknown as { electronAPI?: unknown }).electronAPI;
  const { persistRecording, removeRecording } = useStorage({
    onLoad: isElectron ? () => {} : recs => media.setRecordings(recs),
  });

  const media = useAppMedia({
    splitMode, activePaneIndex, setPaneBSource, sessions, persistRecording, removeRecording,
  });

  const appSession = useAppSession({
    sessions, singleLayers, paneLayers1, paneRef0, paneRef1,
    isLiveMode, deviceId: config.deviceId,
    activeRecording: media.activeRecording,
    activeImage: media.activeImage,
    paneBSource, captureLabels: media.captureLabels, recordingLabels: media.recordingLabels,
    setCaptures: media.setCaptures, setRecordings: media.setRecordings,
    setActiveRecording: media.setActiveRecording, setActiveImage: media.setActiveImage,
    setIsLiveMode, setPaneBSource,
    setCaptureLabels: media.setCaptureLabels, setRecordingLabels: media.setRecordingLabels,
  });

  // Playback state — pane A
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const activePaneIsB = splitMode && activePaneIndex === 1;

  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Frame-by-frame ──────────────────────────────────────────────────────────
  const stepFrame = useCallback((dir: 1 | -1, frames = 1) => {
    const fps = config.frameRate || 30;
    if (activePaneIsB) paneRef1.current?.stepFrame(dir, fps, frames);
    else paneRef0.current?.stepFrame(dir, fps, frames);
    // Time update comes from the 'seeked' event in VideoPane → onTimeUpdate,
    // so we don't read currentTime here (would be before the frame is decoded).
  }, [activePaneIsB, config.frameRate]);

  const handlePlayPause = useCallback(() => {
    if (activePaneIsB) paneRef1.current?.togglePlay();
    else paneRef0.current?.togglePlay();
  }, [activePaneIsB]);


  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    recorder.start(stream, config.videoBitrate, config.audioBitrate);
  }, [recorder, config]);

  const handleStopRecording = useCallback(async () => {
    const rec = await recorder.stop();
    if (!rec) return;
    media.setRecordings(prev => [rec, ...prev]);
    media.setShowMediaPanel(true);
    if (sessions.activeSession) {
      sessions.saveRecording(sessions.activeSession, rec.blob!, rec.name, rec.duration);
    } else {
      persistRecording(rec);
    }
  }, [recorder, persistRecording, sessions, media]);

  const handleSingleSourceChange = useCallback((s: PaneSource) => {
    if (s.type === 'camera') {
      if (s.deviceId !== config.deviceId) setConfig(c => ({ ...c, deviceId: s.deviceId }));
      setIsLiveMode(true); media.setActiveRecording(null); media.setActiveImage(null);
    } else if (s.type === 'recording') {
      setIsLiveMode(false);
      media.handleSelectRecording(s.recording);
      media.setActiveImage(null);
    } else if (s.type === 'image') {
      setIsLiveMode(false); media.setActiveRecording(null); media.setActiveImage(s.capture);
    } else {
      setIsLiveMode(false); media.setActiveRecording(null); media.setActiveImage(null);
    }
  }, [config.deviceId, media]);

  // ── Source pane A ─────────────────────────────────────────────────────────
  const singleSource: PaneSource = useMemo(() => {
    if (isLiveMode) {
      // Si aucun device configuré, on prend le premier disponible pour que
      // le SourceSelector affiche la bonne caméra dans la liste.
      const deviceId = config.deviceId || devices[0]?.deviceId || '';
      return { type: 'camera', deviceId };
    }
    if (media.activeRecording) return { type: 'recording', recording: media.activeRecording };
    if (media.activeImage) return { type: 'image', capture: media.activeImage };
    return { type: 'none' };
  }, [isLiveMode, media.activeRecording, media.activeImage, config.deviceId, devices]);

  // ── Shared annotation props factory ───────────────────────────────────────
  function makeAnnotationProps(ls: LayersState) {
    return {
      layers: ls.layers,
      activeLayerId: ls.activeLayerId,
      tool, color, strokeWidth: 2, filled: false,
      onAddElement: (_: string, el: AnnotationElement) => {
        ls.addElementOnNewLayer(el);
        if (el.type === 'line' || el.type === 'arrow' || el.type === 'angle' || el.type === 'hv-angle' || el.type === 'skeleton' || el.type === 'path') {
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Refs to avoid stale closures — always reflect current values without
  // re-registering the listener on every render.
  const isLiveModeRef    = useRef(isLiveMode);
  const activePaneIsBRef = useRef(activePaneIsB);
  const paneBSourceRef   = useRef(paneBSource);
  isLiveModeRef.current    = isLiveMode;
  activePaneIsBRef.current = activePaneIsB;
  paneBSourceRef.current   = paneBSource;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key;
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') { e.preventDefault(); activeLayers.undo(); }
        if (k === 'y') { e.preventDefault(); activeLayers.redo(); }
        return;
      }
      // Use active-pane live state, not pane A only
      const activeIsLiveNow = activePaneIsBRef.current
        ? paneBSourceRef.current.type === 'camera'
        : isLiveModeRef.current;
      if (!activeIsLiveNow && k === 'Enter') { e.preventDefault(); handlePlayPause(); return; }
      if (!activeIsLiveNow && k === 'ArrowLeft')  { e.preventDefault(); stepFrame(-1, e.shiftKey ? 10 : 1); return; }
      if (!activeIsLiveNow && k === 'ArrowRight') { e.preventDefault(); stepFrame(1,  e.shiftKey ? 10 : 1); return; }
      const map: Partial<Record<string, Tool>> = { h: 'pan', v: 'select', l: 'line', g: 'angle' };
      if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeLayers, stepFrame, handlePlayPause]);

  // ── Space bar — temporary pan ──────────────────────────────────────────────
  const toolRef      = useRef<Tool>(tool);
  const preSpaceTool = useRef<Tool | null>(null);
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
      if (preSpaceTool.current !== null) { setTool(preSpaceTool.current); preSpaceTool.current = null; }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

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
            onSelect={appSession.applySession}
            onNewSession={() => appSession.setShowNewSession(true)}
            onEditClient={async updates => { await sessions.updateClient(updates); }}
            onDeleteSession={appSession.handleDeleteSession}
            onDeleteClient={appSession.handleDeleteClient}
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
          {showGrid && (
            <div className="flex items-center gap-1 bg-[#22223b] rounded-lg px-1.5 py-0.5 border border-[#3d3d5c]">
              <button onClick={() => setGridSize(s => Math.max(10, s - 10))} disabled={gridSize <= 10}
                className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold">−</button>
              <span className="text-xs text-slate-300 w-12 text-center tabular-nums">{gridSize} px</span>
              <button onClick={() => setGridSize(s => Math.min(200, s + 10))} disabled={gridSize >= 200}
                className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold">+</button>
            </div>
          )}
          <button
            onClick={() => {
              if (!splitMode && media.activeRecording) {
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
              if (!appSession.reportLoaded && sessions.activeSession?.folderPath) {
                const saved = await sessions.loadReport(sessions.activeSession.folderPath);
                appSession.setReportData(saved);
                appSession.setReportLoaded(true);
              }
              setShowReport(true);
            }}
            className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 font-medium transition-colors"
          >
            {t('header.report')}
          </button>
          <button onClick={() => setShowSettings(true)} title={t('header.settings')}
            className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button onClick={() => setShowHelp(true)} title={t('header.help')}
            className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 text-sm">?</button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          tool={tool} color={color}
          onTool={setTool} onColor={setColor}
          onUndo={activeLayers.undo} onRedo={activeLayers.redo}
          canUndo={activeLayers.history.length > 0}
          canRedo={activeLayers.future.length > 0}
        />

        <div className="flex-1 bg-black overflow-hidden flex flex-col">
          {/* Source selector bar */}
          <div className="flex shrink-0 bg-[#13131f] border-b border-[#22223b] z-20">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${splitMode ? 'flex-1 border-r border-[#22223b]' : 'w-full'}`}>
              <SourceSelector
                source={singleSource} devices={devices} recordings={media.recordings}
                captures={media.captures}
                label={splitMode ? 'A' : t('video.sourceLabel')}
                onChange={handleSingleSourceChange}
                onRefreshDevices={refreshDevices}
              />
            </div>
            {splitMode && (
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5">
                <SourceSelector
                  source={paneBSource} devices={devices} recordings={media.recordings}
                  captures={media.captures}
                  label="B" onChange={setPaneBSource}
                  onRefreshDevices={refreshDevices}
                />
              </div>
            )}
          </div>

          {/* Panes */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Pane A column */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <VideoPane
                ref={paneRef0}
                source={singleSource} devices={devices} recordings={media.recordings}
                active={splitMode && activePaneIndex === 0}
                label={splitMode ? 'A' : undefined}
                onFocus={splitMode ? () => setActivePaneIndex(0) : undefined}
                showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                onCapture={(blob, name) => media.handleCapture(blob, name, splitMode ? 'A' : undefined)}
                annotationProps={makeAnnotationProps(singleLayers)}
                onStreamChange={s => { cameraStreamRef.current = s; setCameraIsActive(!!s); }}
                onCameraError={setCameraError}
                onTimeUpdate={setPlaybackTime}
                onDurationChange={d => {
                  setPlaybackDuration(d);
                  if (isFinite(d) && d > 0) {
                    media.setRecordings(prev => prev.map(r =>
                      r.id === media.activeRecording?.id && r.duration === 0 ? { ...r, duration: d } : r,
                    ));
                  }
                }}
                onPlayStateChange={p => setPlaybackPaused(p)}
              />
              <PanePlayer
                label={splitMode ? 'A' : ''}
                isLiveMode={isLiveMode}
                isPaused={playbackPaused}
                time={playbackTime}
                duration={playbackDuration}
                onPlayPause={() => paneRef0.current?.togglePlay()}
                onSeek={t => { paneRef0.current?.seekTo(t); setPlaybackTime(t); }}
                onFramePrev={() => paneRef0.current?.stepFrame(-1, config.frameRate || 30)}
                onFrameNext={() => paneRef0.current?.stepFrame(1, config.frameRate || 30)}
              />
            </div>

            {splitMode && (
              <>
                <div className="w-px bg-[#22223b] shrink-0" />
                {/* Pane B column */}
                <div className="flex flex-col flex-1 overflow-hidden">
                  <VideoPane
                    ref={paneRef1}
                    source={paneBSource} devices={devices} recordings={media.recordings}
                    active={activePaneIndex === 1} label="B"
                    onFocus={() => setActivePaneIndex(1)}
                    showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                    onCapture={(blob, name) => media.handleCapture(blob, name, 'B')}
                    annotationProps={makeAnnotationProps(paneLayers1)}
                    onTimeUpdate={setPlaybackTimeB}
                    onDurationChange={d => {
                      setPlaybackDurationB(d);
                      if (isFinite(d) && d > 0 && paneBSource.type === 'recording') {
                        media.setRecordings(prev => prev.map(r =>
                          r.id === (paneBSource as { type: 'recording'; recording: { id: string } }).recording.id && r.duration === 0
                            ? { ...r, duration: d } : r,
                        ));
                      }
                    }}
                    onPlayStateChange={p => setPlaybackPausedB(p)}
                  />
                  <PanePlayer
                    label="B"
                    isLiveMode={paneBSource.type === 'camera'}
                    isPaused={playbackPausedB}
                    time={playbackTimeB}
                    duration={playbackDurationB}
                    onPlayPause={() => paneRef1.current?.togglePlay()}
                    onSeek={t => { paneRef1.current?.seekTo(t); setPlaybackTimeB(t); }}
                    onFramePrev={() => paneRef1.current?.stepFrame(-1, config.frameRate || 30)}
                    onFrameNext={() => paneRef1.current?.stepFrame(1, config.frameRate || 30)}
                  />
                </div>
              </>
            )}

            {recorder.isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full pointer-events-none" style={{ zIndex: 400 }}>
                <span className={`w-2 h-2 rounded-full ${recorder.isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-xs font-mono text-white font-semibold">{recorder.isPaused ? t('recording.pauseIndicator') : t('recording.rec')}</span>
              </div>
            )}
          </div>
        </div>

        <LayerPanel
          layers={activeLayers.layers}
          activeLayerId={activeLayers.activeLayerId}
          onSelect={activeLayers.setActiveLayerId}
          {...activeLayers.layerActions}
          cotesProps={sessions.activeSession ? {
            discipline: sessions.activeSession.discipline,
            layers: activeLayers.layers,
            activeLayerId: activeLayers.activeLayerId,
            onSelectCote: (key: string | null) => {
              const id = activeLayers.activeLayerId;
              if (!id) return;
              // Toggle : si déjà lié à cette cote → délier
              const already = activeLayers.layers.find(l => l.id === id)?.coteKey === key;
              const newKey = already ? null : key;
              activeLayers.layerActions.onLinkCote(id, newKey);
              if (newKey) activeLayers.layerActions.onRename(id, t(`guide.${newKey}`));
            },
          } : undefined}
        />
      </div>

      {/* ── Media panel ── */}
      {media.showMediaPanel && (
        <MediaPanel
          captures={media.captures}
          recordings={media.recordings}
          activeRecordingId={media.activeRecording?.id ?? null}
          captureLabels={media.captureLabels}
          recordingLabels={media.recordingLabels}
          onSelectCapture={media.handleSelectCapture}
          onSelectRecording={rec => {
            if (!splitMode || activePaneIndex === 0) setIsLiveMode(false);
            media.handleSelectRecording(rec);
          }}
          onDownloadCapture={media.handleDownloadCapture}
          onDeleteCapture={media.handleDeleteCapture}
          onDownloadRecording={media.handleDownloadRecording}
          onDeleteRecording={media.handleDeleteRecording}
          onRenameCapture={media.handleRenameCapture}
          onRenameRecording={media.handleRenameRecording}
        />
      )}

      {/* ── Bottom bar ── */}
      <RecordingBar
        isRecording={recorder.isRecording}
        isPaused={recorder.isPaused}
        elapsed={recorder.elapsed}
        isLiveMode={isLiveMode}
        onStartRecording={handleStartRecording}
        onPauseRecording={recorder.isPaused ? recorder.resume : recorder.pause}
        onStopRecording={handleStopRecording}
        onImportVideo={() => importInputRef.current?.click()}
        onLiveMode={() => { setIsLiveMode(true); media.setActiveRecording(null); media.setActiveImage(null); }}
        captureCount={media.captures.length}
        recordingCount={media.recordings.length}
        showMedia={media.showMediaPanel}
        onToggleMedia={() => media.setShowMediaPanel(v => !v)}
      />

      <input ref={importInputRef} type="file" accept="video/*,.png,.jpg,.jpeg,.webp" className="hidden" onChange={media.handleImportFile} />

      {appSession.showNewSession && (
        <NewSessionModal
          clients={sessions.clients}
          canClose={!!sessions.activeSession}
          onClose={() => appSession.setShowNewSession(false)}
          onCreateClientAndSession={appSession.handleCreateClientAndSession}
          onCreateSessionForClient={appSession.handleCreateSessionForClient}
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
          captures={media.captures}
          client={sessions.activeClient}
          session={sessions.activeSession}
          company={company}
          initialData={appSession.reportData}
          onClose={() => setShowReport(false)}
          onUpdateClient={appSession.handleReportUpdateClient}
          onSave={appSession.handleReportSave}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
