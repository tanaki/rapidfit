import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Recording, Capture, VideoConfig, PaneSource } from './types';
import { uid } from './utils/canvas';
import { useLayers } from './hooks/useLayers';
import type { LayersState } from './hooks/useLayers';
import { useDevices } from './hooks/useCamera';
import { useRecorder } from './hooks/useRecorder';
import type { Tool } from './types';
import { Toolbar, COLORS } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { RecordingBar } from './components/RecordingBar';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { VideoPane, SourceSelector, type VideoPaneHandle } from './components/VideoPane';
import { useStorage } from './hooks/useStorage';
import { saveRecordingToFile } from './utils/saveFile';
import { UpdateBanner } from './components/UpdateBanner';

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
  const singleLayers = useLayers('Calque 1');
  const paneLayers1  = useLayers('Calque B-1');

  const activeLayers: LayersState = splitMode && activePaneIndex === 1
    ? paneLayers1
    : singleLayers;

  // ── Frame-by-frame ──────────────────────────────────────────────────────────
  const stepFrame = useCallback((dir: 1 | -1, frames = 1) => {
    const fps = config.frameRate || 30;
    const activeRef = splitMode && activePaneIndex === 1 ? paneRef1 : paneRef0;
    activeRef.current?.stepFrame(dir, fps, frames);
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
    setRecordings(prev => [rec, ...prev]);
    persistRecording(rec);
  }, [recorder, persistRecording]);

  const handleSelectRecording = useCallback((rec: Recording) => {
    setActiveRecording(rec);
    setIsLiveMode(false);
    // VideoPane A reacts to singleSource change and loads the video automatically
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
      onAddElement: (_: string, el: import('./types').AnnotationElement) => {
        ls.addElementOnNewLayer(el);
        if (el.type === 'line' || el.type === 'arrow' || el.type === 'angle' || el.type === 'path') {
          advanceColor();
        }
      },
      onEraseAt: ls.eraseAt,
      onUpdateElement: ls.updateElement,
      onDeleteElement: ls.deleteElement,
      onBeginDrag: ls.beginDrag,
    };
  }

  const activeLayerName = activeLayers.layers.find(l => l.id === activeLayers.activeLayerId)?.name ?? '—';

  // ── Source pane A (single + split A) ─────────────────────────────────────
  // useMemo stabilises the object reference so VideoPane's useEffect([source])
  // only fires when the source actually changes — not on every re-render.
  const singleSource: PaneSource = useMemo(() => {
    if (!isLiveMode && activeRecording) return { type: 'recording', recording: activeRecording };
    if (isLiveMode) return { type: 'camera', deviceId: config.deviceId };
    return { type: 'none' };
  }, [isLiveMode, activeRecording, config.deviceId]);

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
  }, [config.deviceId, handleSelectRecording]); // eslint-disable-line

  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] text-slate-100 select-none overflow-hidden">
      <UpdateBanner />
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#13131f] border-b border-[#22223b] shrink-0 h-11">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚴⚡</span>
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

        {cameraError && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-1 rounded-lg">
            ⚠ {cameraError}
          </div>
        )}

        <div className="flex items-center gap-2">
          {isLiveMode && !cameraIsActive && !cameraError && (
            <span className="text-xs text-slate-500">En attente de la caméra…</span>
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
            onClick={() => {
              if (!splitMode) {
                // Initialise le panneau A avec l'état courant du mode single
                const currentSource: PaneSource = !isLiveMode && activeRecording
                  ? { type: 'recording', recording: activeRecording }
                  : isLiveMode
                    ? { type: 'camera', deviceId: config.deviceId }
                    : { type: 'none' };
                setSplitSources([currentSource, { type: 'none' }]);
                paneLayers0.importLayers(singleLayers.layers, singleLayers.activeLayerId);
                if (activeRecording) {
                  const t = playbackTime;
                  setTimeout(() => paneRef0.current?.seekTo(t), 50);
                }
              }
              setSplitMode(s => !s);
            }}
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

        {/* ── Unified video area — pane A always mounted ── */}
        <div className="flex-1 bg-black overflow-hidden flex flex-col">

          {/* Source selector bar */}
          <div className="flex shrink-0 bg-[#13131f] border-b border-[#22223b] z-20">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${splitMode ? 'flex-1 border-r border-[#22223b]' : 'w-full'}`}>
              <SourceSelector
                source={singleSource} devices={devices} recordings={recordings}
                label={splitMode ? 'A' : 'Source'}
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
              onDurationChange={setPlaybackDuration}
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
                <span className="text-xs font-mono text-white font-semibold">{recorder.isPaused ? 'PAUSE' : 'REC'}</span>
              </div>
            )}
          </div>

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
        onSeek={handleSeek}
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
          <div className="bg-[#13131f] border border-[#22223b] rounded-xl p-6 w-[700px] max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-100">Guide d'utilisation</h2>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Outils */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Outils</h3>
              <div className="flex flex-col gap-1.5">
                {[
                  ['H', '✋', 'Déplacer',   'Glisser pour déplacer la vue (zoom > 1).'],
                  ['V', '⊙', 'Sélection',  'Cliquer pour sélectionner, glisser les handles pour modifier. Suppr/⌫ pour supprimer.'],
                  ['L', '╱', 'Trait',      'Cliquer-glisser pour tracer une ligne droite.'],
                  ['G', '∠', 'Angle',      '3 clics : 1er point → sommet → 3e point. L\'arc et la valeur en degrés s\'affichent automatiquement.'],
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
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Raccourcis clavier</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  ['H',            'Outil Déplacer'],
                  ['V',            'Outil Sélection'],
                  ['L',            'Outil Trait'],
                  ['G',            'Outil Angle'],
                  ['Espace (maintien)', 'Pan temporaire → relâche pour revenir à l\'outil'],
                  ['Ctrl/Cmd + Z', 'Annuler'],
                  ['Ctrl/Cmd + Y', 'Rétablir'],
                  ['Suppr / ⌫',   'Supprimer l\'élément sélectionné'],
                  ['Entrée',       'Lecture / Pause vidéo'],
                  ['←  →',         'Image précédente / suivante (vidéo pausée)'],
                  ['MAJ + ←  →',   'Reculer / avancer 10 images d\'un coup'],
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
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Souris &amp; molette</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                {[
                  ['Ctrl/Cmd + molette',       'Zoom centré sur le curseur'],
                  ['Clic molette + glisser',   'Déplacer la vue (zoom > 1)'],
                  ['Espace + glisser',          'Déplacer la vue (zoom > 1)'],
                  ['Molette seule (vidéo)',     'Image précédente / suivante'],
                  ['Clic seekbar',             'Sauter à ce point dans la vidéo'],
                  ['Glisser seekbar',          'Navigation continue dans la vidéo'],
                  ['Clic handle',              'Déplacer le point (curseur ✊ pendant le drag)'],
                  ['Glisser corps d\'un élément', 'Déplacer l\'élément entier'],
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
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Split screen</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• Chaque panneau A / B a ses <span className="text-slate-300">calques et son zoom/pan indépendants</span>.</p>
                <p>• Cliquer sur un panneau pour l'activer — outils et calques s'y appliquent.</p>
                <p>• ← → et MAJ+← → s'appliquent au panneau actif.</p>
              </div>
            </section>

            {/* Calques */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Calques</h3>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <p>• <span className="text-slate-300">+</span> Créer · <span className="text-slate-300">👁</span> Masquer · <span className="text-slate-300">🔒</span> Verrouiller · <span className="text-slate-300">▲▼</span> Réordonner</p>
                <p>• Slider opacité 0–100 % par calque · chaque tracé crée automatiquement son propre calque.</p>
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
