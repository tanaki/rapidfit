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
import { PainGuideModal } from './components/PainGuideModal';
import { NewSessionModal } from './components/NewSessionModal';
import { VideoPane, SourceSelector, type VideoPaneHandle, type AnnotationProps } from './components/VideoPane';
import { PanePlayer } from './components/PanePlayer';
import { AppHeader } from './components/AppHeader';
import type { Recording } from './types';
import { useStorage } from './hooks/useStorage';
import { UpdateBanner } from './components/UpdateBanner';
import { useCompany } from './hooks/useCompany';

// ── PaneColumn ───────────────────────────────────────────────────────────────
// Wraps VideoPane + PanePlayer into a single column — defined at module level
// so React never unmounts it due to identity change between renders.
interface PaneColumnProps {
  paneRef: React.RefObject<VideoPaneHandle | null>;
  source: PaneSource;
  active: boolean;
  label?: string;
  onFocus?: () => void;
  annotationProps: AnnotationProps;
  onStreamChange?: (s: MediaStream | null) => void;
  onCameraError?: (e: string | null) => void;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  onPlayStateChange: (p: boolean) => void;
  onCapture: (blob: Blob, name: string) => void;
  playerLabel: string;
  playerIsLive: boolean;
  playerIsPaused: boolean;
  playerTime: number;
  playerDuration: number;
  frameRate: number;
  devices: MediaDeviceInfo[];
  recordings: Recording[];
  showGuide: boolean;
  showGrid: boolean;
  gridSize: number;
  onSeekToCue?: (t: number) => void;
}

function PaneColumn({
  paneRef, source, active, label, onFocus,
  annotationProps, onStreamChange, onCameraError,
  onTimeUpdate, onDurationChange, onPlayStateChange, onCapture,
  playerLabel, playerIsLive, playerIsPaused, playerTime, playerDuration, frameRate,
  devices, recordings, showGuide, showGrid, gridSize, onSeekToCue,
}: PaneColumnProps) {
  const cuePoints = annotationProps.layers
    .filter(l => l.cueTime !== undefined)
    .map(l => ({
      time:  l.cueTime!,
      color: l.elements[0]?.color ?? '#6366f1',
      label: l.name,
    }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <VideoPane
        ref={paneRef}
        source={source} devices={devices} recordings={recordings}
        active={active} label={label} onFocus={onFocus}
        showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
        annotationProps={annotationProps}
        onStreamChange={onStreamChange}
        onCameraError={onCameraError}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onPlayStateChange={onPlayStateChange}
        onCapture={onCapture}
      />
      <PanePlayer
        label={playerLabel}
        isLiveMode={playerIsLive}
        isPaused={playerIsPaused}
        time={playerTime}
        duration={playerDuration}
        onPlayPause={() => paneRef.current?.togglePlay()}
        onSeek={t => { paneRef.current?.seekTo(t); onTimeUpdate(t); }}
        onFramePrev={() => paneRef.current?.stepFrame(-1, frameRate)}
        onFrameNext={() => paneRef.current?.stepFrame(1, frameRate)}
        cuePoints={cuePoints}
        onSeekToCue={onSeekToCue}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: VideoConfig = {
  deviceId: '',
  width: 1920, height: 1080,
  frameRate: 60,
  videoBitrate: 8000,
  audioBitrate: 128,
  audioEnabled: false,
};

const CONFIG_KEY = 'rapidfit:config';

function loadConfig(): VideoConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export default function App() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VideoConfig>(loadConfig);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const sessions = useSessions();
  const { company, save: saveCompany } = useCompany();

  const { devices, refresh: refreshDevices } = useDevices();
  const recorder = useRecorder();

  // Camera state — fed by VideoPane A/B callbacks
  const cameraStreamRef  = useRef<MediaStream | null>(null);
  const cameraStreamBRef = useRef<MediaStream | null>(null);
  const [cameraIsActive, setCameraIsActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // UI modes
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPainGuide, setShowPainGuide] = useState(false);

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
  const [tool, setTool] = useState<Tool>('pan');
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
    const stream = activePaneIsB ? cameraStreamBRef.current : cameraStreamRef.current;
    if (!stream) return;
    recorder.start(stream, config.videoBitrate, config.audioBitrate);
  }, [recorder, config, activePaneIsB]);

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
  function makeAnnotationProps(ls: LayersState, currentTime: number) {
    return {
      layers: ls.layers,
      activeLayerId: ls.activeLayerId,
      tool, color, strokeWidth: 2, filled: false,
      onAddElement: (_: string, el: AnnotationElement) => {
        const cue = isLiveMode ? undefined : currentTime;
        ls.addElementOnNewLayer(el, cue);
        if (el.type === 'line' || el.type === 'arrow' || el.type === 'angle' || el.type === 'hv-angle' || el.type === 'skeleton' || el.type === 'path') {
          advanceColor();
        }
      },
      onEraseAt: ls.eraseAt,
      onUpdateElement: ls.updateElement,
      onDeleteElement: ls.deleteElement,
      onBeginDrag: ls.beginDrag,
      onRescaleElements: ls.rescaleElements,
      onAddNamedLayer: ls.addNamedLayer,
      discipline: sessions.activeSession?.discipline ?? 'route',
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

  // ── Space bar — play / pause ──────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      handlePlayPause();
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [handlePlayPause]);

  const handleToggleSplit = useCallback(() => {
    if (!splitMode && media.activeRecording) {
      const time = playbackTime;
      setTimeout(() => paneRef0.current?.seekTo(time), 50);
    }
    setSplitMode(s => !s);
  }, [splitMode, media.activeRecording, playbackTime]);

  const handleOpenReport = useCallback(async () => {
    if (!appSession.reportLoaded && sessions.activeSession?.folderPath) {
      const saved = await sessions.loadReport(sessions.activeSession.folderPath);
      appSession.setReportData(saved);
      appSession.setReportLoaded(true);
    }
    setShowReport(true);
  }, [appSession, sessions]);

  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] text-slate-100 select-none overflow-hidden">
      <UpdateBanner />

      <AppHeader
        sessionProps={{
          clients: sessions.clients,
          sessionsByClient: sessions.sessionsByClient,
          activeClient: sessions.activeClient,
          activeSession: sessions.activeSession,
          onSelect: appSession.applySession,
          onNewSession: () => appSession.setShowNewSession(true),
          onEditClient: async updates => { await sessions.updateClient(updates); },
          onDeleteSession: appSession.handleDeleteSession,
          onDeleteClient: appSession.handleDeleteClient,
        }}
        splitMode={splitMode}
        activePaneIndex={activePaneIndex}
        activeLayerName={activeLayerName}
        isLiveMode={isLiveMode}
        cameraIsActive={cameraIsActive}
        cameraError={cameraError}
        showGuide={showGuide} onToggleGuide={() => setShowGuide(g => !g)}
        showGrid={showGrid}   onToggleGrid={() => setShowGrid(g => !g)}
        gridSize={gridSize}   onGridSizeChange={setGridSize}
        onToggleSplit={handleToggleSplit}
        onOpenReport={handleOpenReport}
        onOpenPainGuide={() => setShowPainGuide(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

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
            <PaneColumn
              paneRef={paneRef0}
              source={singleSource}
              active={splitMode && activePaneIndex === 0}
              label={splitMode ? 'A' : undefined}
              onFocus={splitMode ? () => setActivePaneIndex(0) : undefined}
              annotationProps={makeAnnotationProps(singleLayers, playbackTime)}
              onStreamChange={s => { cameraStreamRef.current = s; setCameraIsActive(!!s); }}
              onCameraError={setCameraError}
              onTimeUpdate={setPlaybackTime}
              onDurationChange={d => {
                setPlaybackDuration(d);
                if (isFinite(d) && d > 0)
                  media.setRecordings(prev => prev.map(r =>
                    r.id === media.activeRecording?.id && r.duration === 0 ? { ...r, duration: d } : r,
                  ));
              }}
              onPlayStateChange={setPlaybackPaused}
              onCapture={(blob, name) => media.handleCapture(blob, name, splitMode ? 'A' : undefined)}
              playerLabel={splitMode ? 'A' : ''}
              playerIsLive={isLiveMode}
              playerIsPaused={playbackPaused}
              playerTime={playbackTime}
              playerDuration={playbackDuration}
              frameRate={config.frameRate || 30}
              devices={devices} recordings={media.recordings}
              showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
              onSeekToCue={t => { paneRef0.current?.seekTo(t); setPlaybackTime(t); }}
            />

            {splitMode && (
              <>
                <div className="w-px bg-[#22223b] shrink-0" />
                <PaneColumn
                  paneRef={paneRef1}
                  source={paneBSource}
                  active={activePaneIndex === 1}
                  label="B"
                  onFocus={() => setActivePaneIndex(1)}
                  annotationProps={makeAnnotationProps(paneLayers1, playbackTimeB)}
                  onTimeUpdate={setPlaybackTimeB}
                  onDurationChange={d => {
                    setPlaybackDurationB(d);
                    if (isFinite(d) && d > 0 && paneBSource.type === 'recording')
                      media.setRecordings(prev => prev.map(r =>
                        r.id === (paneBSource as { type: 'recording'; recording: { id: string } }).recording.id && r.duration === 0
                          ? { ...r, duration: d } : r,
                      ));
                  }}
                  onStreamChange={s => { cameraStreamBRef.current = s; }}
                  onPlayStateChange={setPlaybackPausedB}
                  onCapture={(blob, name) => media.handleCapture(blob, name, 'B')}
                  playerLabel="B"
                  playerIsLive={paneBSource.type === 'camera'}
                  playerIsPaused={playbackPausedB}
                  playerTime={playbackTimeB}
                  playerDuration={playbackDurationB}
                  frameRate={config.frameRate || 30}
                  devices={devices} recordings={media.recordings}
                  showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                  onSeekToCue={t => { paneRef1.current?.seekTo(t); setPlaybackTimeB(t); }}
                />
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
          currentTime={activePaneIsB ? playbackTimeB : playbackTime}
          onSetCueTime={(id, time) => activeLayers.setCueTime(id, time)}
          onSeekToCue={t => {
            if (activePaneIsB) { paneRef1.current?.seekTo(t); setPlaybackTimeB(t); }
            else               { paneRef0.current?.seekTo(t); setPlaybackTime(t);  }
          }}
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
        canRecord={isLiveMode || (splitMode && activePaneIsB && paneBSource.type === 'camera')}
        onStartRecording={handleStartRecording}
        onPauseRecording={recorder.isPaused ? recorder.resume : recorder.pause}
        onStopRecording={handleStopRecording}
        onImportVideo={() => importInputRef.current?.click()}
        onLiveMode={() => {
          const deviceId = config.deviceId || devices[0]?.deviceId || '';
          if (splitMode && activePaneIsB) {
            setPaneBSource({ type: 'camera', deviceId });
          } else {
            setIsLiveMode(true); media.setActiveRecording(null); media.setActiveImage(null);
          }
        }}
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
      {showPainGuide && <PainGuideModal onClose={() => setShowPainGuide(false)} />}
    </div>
  );
}
