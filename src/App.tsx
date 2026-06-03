import { useState, useEffect, useRef, useCallback } from 'react';
import type { Recording, Capture, VideoConfig, PaneSource } from './types';
import { uid } from './utils/canvas';
import { useLayers } from './hooks/useLayers';
import type { LayersState } from './hooks/useLayers';
import { useCamera, useDevices } from './hooks/useCamera';
import { useRecorder } from './hooks/useRecorder';
import type { Tool } from './types';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { RecordingBar } from './components/RecordingBar';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { VideoPane, SourceSelector, type VideoPaneHandle } from './components/VideoPane';
import { ZoomPane } from './components/ZoomPane';
import { useStorage } from './hooks/useStorage';
import { saveRecordingToFile } from './utils/saveFile';

const DEFAULT_CONFIG: VideoConfig = {
  deviceId: '',
  width: 1920, height: 1080,
  frameRate: 60,
  videoBitrate: 8000,
  audioBitrate: 128,
  audioEnabled: false,
};

export default function App() {
  const [config, setConfig] = useState<VideoConfig>(DEFAULT_CONFIG);
  const { devices } = useDevices();
  const camera = useCamera(config);
  const recorder = useRecorder();

  // UI modes
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [splitMode, setSplitMode] = useState(false);
  const [canvasInteractive, setCanvasInteractive] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Overlay options
  const [showGuide, setShowGuide] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);

  // Captures (screenshots with annotations)
  const [captures, setCaptures] = useState<Capture[]>([]);

  const handleCapture = useCallback((blob: Blob, name: string, paneLabel?: string) => {
    const url = URL.createObjectURL(blob);
    const cap: Capture = { id: uid(), name, blob, url, createdAt: new Date(), paneLabel };
    setCaptures(prev => [cap, ...prev]);
  }, []);

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

  // Persistent storage (IndexedDB)
  const { persistRecording, removeRecording } = useStorage({
    onLoad: recs => setRecordings(recs),
  });
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Playback state (frame-by-frame bar)
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Split screen
  const [splitSources, setSplitSources] = useState<[PaneSource, PaneSource]>([
    { type: 'none' },
    { type: 'none' },
  ]);
  const [activePaneIndex, setActivePaneIndex] = useState<0 | 1>(0);
  const paneRef0 = useRef<VideoPaneHandle>(null);
  const paneRef1 = useRef<VideoPaneHandle>(null);

  // Tools (shared across all canvases)
  const [tool, setTool] = useState<Tool>('angle');
  const [color, setColor] = useState('#ef4444');

  // ── Layer sets — one for single mode, one per pane for split mode ──────────
  const singleLayers = useLayers('Calque 1');     // used in single mode
  const paneLayers0  = useLayers('Calque A-1');   // pane A in split mode
  const paneLayers1  = useLayers('Calque B-1');   // pane B in split mode

  // Active layer set depends on mode + active pane
  const activeLayers: LayersState = splitMode
    ? (activePaneIndex === 0 ? paneLayers0 : paneLayers1)
    : singleLayers;

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  useEffect(() => { camera.start(); }, []); // eslint-disable-line
  useEffect(() => {
    if (isLiveMode) camera.start(); else camera.stop();
  }, [isLiveMode]); // eslint-disable-line
  useEffect(() => { if (isLiveMode) camera.start(); }, [config]); // eslint-disable-line

  // ── Playback video event sync ──────────────────────────────────────────────
  useEffect(() => {
    const v = playbackVideoRef.current;
    if (!v) return;
    const onPause  = () => setPlaybackPaused(true);
    const onPlay   = () => setPlaybackPaused(false);
    const onTime   = () => setPlaybackTime(v.currentTime);
    const onLoaded = () => { setPlaybackDuration(v.duration); setPlaybackPaused(v.paused); };
    v.addEventListener('pause', onPause);
    v.addEventListener('play', onPlay);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    return () => {
      v.removeEventListener('pause', onPause);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  // ── Frame-by-frame ──────────────────────────────────────────────────────────
  const stepFrame = useCallback((dir: 1 | -1, frames = 1) => {
    const fps = config.frameRate || 30;
    if (splitMode) {
      const ref = activePaneIndex === 0 ? paneRef0 : paneRef1;
      ref.current?.stepFrame(dir, fps, frames);
    } else {
      const v = playbackVideoRef.current;
      if (v && v.paused) {
        v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir * frames / fps));
      }
    }
  }, [splitMode, activePaneIndex, config.frameRate]);

  const handlePlayPause = useCallback(() => {
    const v = playbackVideoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    const stream = camera.streamRef.current;
    if (!stream) return;
    recorder.start(stream, config.videoBitrate, config.audioBitrate);
  }, [camera.streamRef, recorder, config]);

  const handleStopRecording = useCallback(async () => {
    const rec = await recorder.stop();
    setRecordings(prev => [rec, ...prev]);
    persistRecording(rec);
  }, [recorder, persistRecording]);

  const handleSelectRecording = useCallback((rec: Recording) => {
    setActiveRecording(rec);
    setIsLiveMode(false);
    setTimeout(() => {
      if (playbackVideoRef.current) {
        playbackVideoRef.current.src = rec.url;
        playbackVideoRef.current.load();
      }
    }, 50);
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
      if (k === 'Escape') { setCanvasInteractive(v => !v); return; }
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
      canvasInteractive,
      onAddElement: (_: string, el: import('./types').AnnotationElement) => ls.addElementOnNewLayer(el),
      onEraseAt: ls.eraseAt,
      onUpdateElement: ls.updateElement,
      onDeleteElement: ls.deleteElement,
      onBeginDrag: ls.beginDrag,
    };
  }

  const activeLayerName = activeLayers.layers.find(l => l.id === activeLayers.activeLayerId)?.name ?? '—';

  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] text-slate-100 select-none overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#13131f] border-b border-[#22223b] shrink-0 h-11">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-xl font-bold">⚡</span>
          <span className="text-sm font-bold tracking-wide text-white">RapidFit</span>
          <div className="w-px h-4 bg-[#3d3d5c] mx-1" />
          <span className="text-xs text-slate-400 bg-[#22223b] px-2 py-0.5 rounded-md border border-[#3d3d5c]">
            {splitMode && (
              <span className="text-indigo-400 font-medium mr-1">
                Panneau {activePaneIndex === 0 ? 'A' : 'B'} —
              </span>
            )}
            Calque : <span className="text-slate-200 font-medium">{activeLayerName}</span>
          </span>
        </div>

        {camera.error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-1 rounded-lg">
            ⚠ {camera.error}
          </div>
        )}

        <div className="flex items-center gap-2">
          {isLiveMode && !camera.isActive && !camera.error && (
            <button onClick={camera.start} className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium">
              Activer la caméra
            </button>
          )}

          {/* Overlay toggles */}
          <button
            onClick={() => setShowGuide(g => !g)}
            title="Afficher/masquer les guides (rectangle 80% + centre)"
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              showGuide ? 'bg-yellow-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            ✛ Guides
          </button>
          <button
            onClick={() => setShowGrid(g => !g)}
            title="Afficher/masquer la grille"
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            ⊟ Grille
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

          <div className="w-px h-4 bg-[#3d3d5c]" />

          <button
            onClick={() => setShowReport(true)}
            className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 font-medium transition-colors"
          >
            📋 Compte rendu
          </button>

          <button
            onClick={() => setSplitMode(s => !s)}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              splitMode ? 'bg-indigo-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
            }`}
          >
            ⊞ Split
          </button>
          <button onClick={() => setShowSettings(true)} className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300">
            ⚙ Paramètres
          </button>
          <button onClick={() => setShowHelp(true)} className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300">
            ? Aide
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

        {/* ── Video area ── */}
        <div className="flex-1 relative bg-black overflow-hidden">

          {/* ── SINGLE MODE ── */}
          {!splitMode && (() => {
            // Derive current source from existing state
            const singleSource: PaneSource = !isLiveMode && activeRecording
              ? { type: 'recording', recording: activeRecording }
              : { type: 'camera', deviceId: config.deviceId };

            const handleSingleSourceChange = (s: PaneSource) => {
              if (s.type === 'camera') {
                if (s.deviceId !== config.deviceId) setConfig(c => ({ ...c, deviceId: s.deviceId }));
                setIsLiveMode(true);
                setActiveRecording(null);
              } else if (s.type === 'recording') {
                handleSelectRecording(s.recording);
              } else {
                setIsLiveMode(true);
                setActiveRecording(null);
              }
            };

            return (
              <div className="flex flex-col h-full">
                {/* Source selector bar */}
                <div className="flex shrink-0 bg-[#13131f] border-b border-[#22223b] z-20 relative px-3 py-1.5">
                  <SourceSelector
                    source={singleSource}
                    devices={devices}
                    recordings={recordings}
                    label="Source"
                    onChange={handleSingleSourceChange}
                  />
                </div>

                {/* Video + annotations */}
                <div className="flex-1 relative overflow-hidden">
                  <ZoomPane showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                    isPanMode={tool === 'pan'}
                    onScroll={!isLiveMode ? (dir) => stepFrame(dir) : undefined}
                    onCapture={(blob, name) => handleCapture(blob, name)}
                    annotationLayer={(zoom, pan) => (
                      <AnnotationCanvas
                        {...makeAnnotationProps(singleLayers)}
                        zoom={zoom}
                        pan={pan}
                        style={(canvasInteractive && tool !== 'pan') ? undefined : { pointerEvents: 'none' }}
                      />
                    )}
                  >
                    <video
                      ref={camera.videoRef}
                      autoPlay muted playsInline
                      style={{ pointerEvents: tool === 'pan' ? 'none' : undefined }}
                      className={`absolute inset-0 w-full h-full object-contain ${!isLiveMode ? 'hidden' : ''}`}
                    />
                    <video
                      ref={playbackVideoRef}
                      style={{ pointerEvents: tool === 'pan' ? 'none' : undefined }}
                      className={`absolute inset-0 w-full h-full object-contain ${isLiveMode ? 'hidden' : ''}`}
                    />
                    {isLiveMode && !camera.isActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600 pointer-events-none">
                        <span className="text-5xl">📷</span>
                        <span className="text-sm">En attente de la caméra…</span>
                      </div>
                    )}
                  </ZoomPane>
                </div>
              </div>
            );
          })()}

          {/* ── SPLIT MODE — each pane owns its canvas ── */}
          {splitMode && (
            <div className="flex flex-col h-full">
              {/* Source selectors — above canvases, always clickable */}
              <div className="flex shrink-0 bg-[#13131f] border-b border-[#22223b] z-20 relative">
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 border-r border-[#22223b]">
                  <SourceSelector
                    source={splitSources[0]} devices={devices} recordings={recordings}
                    label="A" onChange={s => setSplitSources(([, b]) => [s, b])}
                  />
                </div>
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5">
                  <SourceSelector
                    source={splitSources[1]} devices={devices} recordings={recordings}
                    label="B" onChange={s => setSplitSources(([a]) => [a, s])}
                  />
                </div>
              </div>

              {/* Video panes — each with its own annotation canvas */}
              <div className="flex flex-1 overflow-hidden">
                <VideoPane
                  ref={paneRef0}
                  source={splitSources[0]} devices={devices} recordings={recordings}
                  active={activePaneIndex === 0} label="A"
                  onFocus={() => setActivePaneIndex(0)}
                  showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                  onCapture={(blob, name) => handleCapture(blob, name, 'A')}
                  annotationProps={makeAnnotationProps(paneLayers0)}
                />
                <div className="w-px bg-[#22223b] shrink-0" />
                <VideoPane
                  ref={paneRef1}
                  source={splitSources[1]} devices={devices} recordings={recordings}
                  active={activePaneIndex === 1} label="B"
                  onFocus={() => setActivePaneIndex(1)}
                  showGuide={showGuide} showGrid={showGrid} gridSize={gridSize}
                  onCapture={(blob, name) => handleCapture(blob, name, 'B')}
                  annotationProps={makeAnnotationProps(paneLayers1)}
                />
              </div>
            </div>
          )}

          {/* REC indicator */}
          {recorder.isRecording && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full pointer-events-none">
              <span className={`w-2 h-2 rounded-full ${recorder.isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-xs font-mono text-white font-semibold">{recorder.isPaused ? 'PAUSE' : 'REC'}</span>
            </div>
          )}

        </div>

        {/* Layer panel shows active pane's layers */}
        <LayerPanel
          layers={activeLayers.layers}
          activeLayerId={activeLayers.activeLayerId}
          onSelect={activeLayers.setActiveLayerId}
          {...activeLayers.layerActions}
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
        onFramePrev={() => stepFrame(-1)}
        onFrameNext={() => stepFrame(1)}
        captures={captures}
        onDownloadCapture={handleDownloadCapture}
        onDeleteCapture={handleDeleteCapture}
      />

      <input ref={importInputRef} type="file" accept="video/*" className="hidden" onChange={handleImportFile} />

      {showSettings && (
        <SettingsModal
          config={config}
          onChange={c => { setConfig(c); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
          devices={devices}
        />
      )}

      {showReport && (
        <ReportModal
          captures={captures}
          onClose={() => setShowReport(false)}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
          onClick={e => { if (e.target === e.currentTarget) setShowHelp(false); }}
        >
          <div className="bg-[#13131f] border border-[#22223b] rounded-xl p-6 w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-100">Guide d'utilisation</h2>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Outils de dessin</h3>
              <div className="flex flex-col gap-2">
                {[
                  ['V', '↖', 'Sélection', 'Cliquer sur un élément pour le sélectionner, puis glisser ses handles. Suppr/⌫ pour supprimer.'],
                  ['P', '✏️', 'Crayon', 'Dessin libre à main levée.'],
                  ['L', '╱', 'Ligne', 'Tracer une ligne droite entre deux points.'],
                  ['A', '→', 'Flèche', 'Ligne avec tête de flèche à l\'extrémité.'],
                  ['R', '▭', 'Rectangle', 'Glisser pour définir le rectangle.'],
                  ['E', '○', 'Ellipse', 'Glisser pour définir l\'ellipse/cercle.'],
                  ['T', 'T', 'Texte', 'Cliquer pour placer un champ de texte.'],
                  ['G', '∠', 'Angle', '3 clics : point 1 → sommet → point 3.'],
                  ['X', '⌫', 'Gomme', 'Effacer les tracés au crayon.'],
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

            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Raccourcis clavier</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['Ctrl+Z', 'Annuler'], ['Ctrl+Y', 'Rétablir'],
                  ['Échap', 'Basculer annotation ↔ visualisation'],
                  ['Suppr / ⌫', 'Supprimer l\'élément sélectionné'],
                  ['← →', 'Image précédente / suivante (lecture pausée)'],
                  ['V','Sélection'], ['P','Crayon'], ['L','Ligne'],
                  ['A','Flèche'], ['R','Rectangle'], ['E','Ellipse'],
                  ['T','Texte'], ['G','Angle'], ['X','Gomme'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="bg-[#3d3d5c] rounded px-1.5 py-0.5 text-xs font-mono text-slate-300 shrink-0">{key}</kbd>
                    <span className="text-slate-400 text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Split screen (⊞ Split)</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• Chaque panneau A / B a ses <span className="text-slate-300">propres calques indépendants</span></p>
                <p>• Cliquer sur un panneau pour l'activer — le panneau de calques et les outils s'y appliquent</p>
                <p>• Sources : caméras USB + enregistrements disponibles dans le menu déroulant</p>
                <p>• Image par image : ← → appliqué au panneau actif</p>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Calques</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• <span className="text-slate-300">+</span> Créer • <span className="text-slate-300">👁</span> Masquer • <span className="text-slate-300">🔒</span> Verrouiller</p>
                <p>• <span className="text-slate-300">▲ ▼</span> Réordonner • slider opacité 0–100 %</p>
              </div>
            </section>

            <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
