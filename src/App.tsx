import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoConfig, PaneSource, AnnotationElement, AngleElement } from './types';
import { findBestAngleForRow } from './data/referenceAngles';
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
  const [activeCoteKey, setActiveCoteKey] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);

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

  // Playback state — fed by VideoPane A callbacks
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Frame-by-frame ──────────────────────────────────────────────────────────
  const stepFrame = useCallback((dir: 1 | -1, frames = 1) => {
    const fps = config.frameRate || 30;
    const activeRef = splitMode && activePaneIndex === 1 ? paneRef1 : paneRef0;
    activeRef.current?.stepFrame(dir, fps, frames);
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
    if (isLiveMode) return { type: 'camera', deviceId: config.deviceId };
    if (media.activeRecording) return { type: 'recording', recording: media.activeRecording };
    if (media.activeImage) return { type: 'image', capture: media.activeImage };
    return { type: 'none' };
  }, [isLiveMode, media.activeRecording, media.activeImage, config.deviceId]);

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
      const map: Partial<Record<string, Tool>> = { h: 'pan', v: 'select', l: 'line', g: 'angle' };
      if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeLayers, isLiveMode, stepFrame, handlePlayPause]);

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
            className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 text-sm">⚙</button>
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
          onClear={activeLayers.clearActiveLayer}
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
            {splitMode && (
              <>
                <div className="w-px bg-[#22223b] shrink-0" />
                <VideoPane
                  ref={paneRef1}
                  source={paneBSource} devices={devices} recordings={media.recordings}
                  active={activePaneIndex === 1} label="B"
                  onFocus={() => setActivePaneIndex(1)}
                  showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                  onCapture={(blob, name) => media.handleCapture(blob, name, 'B')}
                  annotationProps={makeAnnotationProps(paneLayers1)}
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
          cotesProps={sessions.activeSession ? {
            discipline: sessions.activeSession.discipline,
            activeCoteKey,
            measuredAngles,
            onSelectCote: (key: string | null) => {
              setActiveCoteKey(key);
              if (!key || !sessions.activeSession) return;
              const best = findBestAngleForRow(key, sessions.activeSession.discipline, measuredAngles);
              if (!best) return;
              const layer = activeLayers.layers.find(l => l.elements.some(e => e.id === best.id));
              if (!layer) return;
              activeLayers.layerActions.onRename(layer.id, t(`guide.${key}`));
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
          onSelectRecording={media.handleSelectRecording}
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
        activeRecordingId={media.activeRecording?.id ?? null}
        isLiveMode={splitMode && activePaneIndex === 1 ? paneBSource.type === 'camera' : isLiveMode}
        isPlaybackPaused={playbackPaused}
        playbackTime={playbackTime}
        playbackDuration={playbackDuration}
        onStartRecording={handleStartRecording}
        onPauseRecording={recorder.isPaused ? recorder.resume : recorder.pause}
        onStopRecording={handleStopRecording}
        onImportVideo={() => importInputRef.current?.click()}
        onLiveMode={() => {
          if (splitMode && activePaneIndex === 1) {
            setPaneBSource({ type: 'camera', deviceId: config.deviceId });
          } else {
            setIsLiveMode(true); media.setActiveRecording(null); media.setActiveImage(null);
          }
        }}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onFramePrev={() => stepFrame(-1)}
        onFrameNext={() => stepFrame(1)}
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
