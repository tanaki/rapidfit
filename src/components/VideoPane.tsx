import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { PaneSource, Recording, Layer, Tool } from '../types';
import type { AnnotationElement } from '../types';
import { AnnotationCanvas } from './AnnotationCanvas';
import { useZoomPan } from '../hooks/useZoomPan';
import { ZoomControls } from './ZoomControls';
import { GuideOverlay } from './GuideOverlay';
import { GridOverlay } from './GridOverlay';
import { capturePane } from '../utils/captureFrame';

interface Props {
  source: PaneSource;
  devices: MediaDeviceInfo[];
  recordings: Recording[];
  active: boolean;
  label: string;
  onFocus: () => void;
  showGuide?: boolean;
  showGrid?: boolean;
  gridSize?: number;
  onCapture?: (blob: Blob, name: string) => void;
  annotationProps?: {
    layers: Layer[];
    activeLayerId: string;
    tool: Tool;
    color: string;
    strokeWidth: number;
    filled: boolean;
    canvasInteractive: boolean;
    onAddElement: (layerId: string, el: AnnotationElement) => void;
    onEraseAt: (layerId: string, p: { x: number; y: number }, radius: number) => void;
    onUpdateElement: (layerId: string, el: AnnotationElement) => void;
    onDeleteElement: (layerId: string, elementId: string) => void;
    onBeginDrag: () => void;
  };
}

export interface VideoPaneHandle {
  stepFrame: (dir: 1 | -1, fps?: number, frames?: number) => void;
  isPaused: () => boolean;
  togglePlay: () => void;
}

export const VideoPane = forwardRef<VideoPaneHandle, Props>(function VideoPane(
  { source, active, label, onFocus, showGuide = false, showGrid = false, gridSize = 50, onCapture, annotationProps },
  ref,
) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isPanMode = annotationProps?.tool === 'pan';

  const stepVideoFrame = useCallback((dir: 1 | -1) => {
    if (source.type !== 'recording') return;
    const v = videoRef.current;
    if (!v || !v.paused) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir / 30));
  }, [source.type]);

  const zoomState = useZoomPan(isPanMode, (d) => stepVideoFrame(d < 0 ? -1 : 1));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (source.type === 'camera') {
      let cancelled = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      navigator.mediaDevices
        .getUserMedia({
          video: {
            deviceId: source.deviceId ? { ideal: source.deviceId } : undefined,
            width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 },
          },
          audio: false,
        })
        .then(stream => {
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          video.srcObject = stream;
          video.play();
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
    }

    if (source.type === 'recording') {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      video.srcObject = null;
      video.src = source.recording.url;
      video.load();
      return;
    }

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    video.srcObject = null;
    video.src = '';
  }, [source]);

  useImperativeHandle(ref, () => ({
    stepFrame(dir, fps = 30, frames = 1) {
      const v = videoRef.current;
      if (!v || !v.paused) return;
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir * frames / fps));
    },
    isPaused()  { return videoRef.current?.paused ?? true; },
    togglePlay(){ const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); },
    async capture(paneLabel?: string) {
      const container = zoomState.containerRef.current;
      if (!container) return;
      const { blob, name } = await capturePane(container, paneLabel);
      onCapture?.(blob, name);
    },
  }));

  const isNone     = source.type === 'none';
  const isPlayback = source.type === 'recording';

  return (
    <div
      ref={zoomState.containerRef}
      className={`relative flex-1 bg-black overflow-hidden ${active ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
      onClick={onFocus}
    >
      {/* Transform wrapper — video only */}
      <div style={zoomState.transformStyle}>
        <video
          ref={videoRef}
          autoPlay={source.type === 'camera'}
          muted={source.type === 'camera'}
          playsInline
          style={{ pointerEvents: isPanMode ? 'none' : undefined }}
          className={`absolute inset-0 w-full h-full object-contain ${isNone ? 'hidden' : ''}`}
        />

        {isNone && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700 pointer-events-none">
            <span className="text-4xl">📷</span>
            <span className="text-xs">Aucune source</span>
          </div>
        )}
      </div>

      {/* Annotation canvas — full resolution, outside CSS transform */}
      {annotationProps && (
        <AnnotationCanvas
          layers={annotationProps.layers}
          activeLayerId={annotationProps.activeLayerId}
          tool={annotationProps.tool}
          color={annotationProps.color}
          strokeWidth={annotationProps.strokeWidth}
          filled={annotationProps.filled}
          zoom={zoomState.zoom}
          pan={zoomState.pan}
          onAddElement={annotationProps.onAddElement}
          onEraseAt={annotationProps.onEraseAt}
          onUpdateElement={annotationProps.onUpdateElement}
          onDeleteElement={annotationProps.onDeleteElement}
          onBeginDrag={annotationProps.onBeginDrag}
          style={(annotationProps.canvasInteractive && annotationProps.tool !== 'pan') ? undefined : { pointerEvents: 'none' }}
        />
      )}

      {/* Overlays — fixed to view, outside the zoom transform */}
      <GuideOverlay visible={showGuide} />
      <GridOverlay visible={showGrid} gridSize={gridSize} zoom={zoomState.zoom} pan={zoomState.pan} />

      {/* Controls rendered AFTER the wrapper in DOM — always on top */}
      <ZoomControls state={zoomState} />

      {/* Capture button */}
      {onCapture && (
        <button
          onClick={async e => {
            e.stopPropagation();
            const container = zoomState.containerRef.current;
            if (!container) return;
            const { blob, name } = await capturePane(container, label);
            onCapture(blob, name);
          }}
          title="Capturer l'image avec les calques"
          style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 300 }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-colors"
        >
          📸 Capturer
        </button>
      )}

      {/* Label + active badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 pointer-events-none" style={{ zIndex: 300 }}>
        <span className="text-[10px] font-semibold text-white/60 bg-black/40 px-2 py-0.5 rounded-full">{label}</span>
        {active && <span className="text-[10px] text-white bg-indigo-600/80 px-2 py-0.5 rounded-full">actif</span>}
      </div>
    </div>
  );
});

// ── Source selector ──────────────────────────────────────────────────────────

interface SourceSelectorProps {
  source: PaneSource;
  devices: MediaDeviceInfo[];
  recordings: Recording[];
  label: string;
  onChange: (s: PaneSource) => void;
}

export function SourceSelector({ source, devices, recordings, label, onChange }: SourceSelectorProps) {
  const value =
    source.type === 'camera'    ? `cam:${source.deviceId}`
    : source.type === 'recording' ? `rec:${source.recording.id}`
    : 'none';

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-xs font-semibold text-slate-400 shrink-0">{label}</span>
      <select
        value={value}
        onChange={e => {
          const v = e.target.value;
          if (v === 'none') onChange({ type: 'none' });
          else if (v.startsWith('cam:')) onChange({ type: 'camera', deviceId: v.slice(4) });
          else if (v.startsWith('rec:')) {
            const rec = recordings.find(r => r.id === v.slice(4));
            if (rec) onChange({ type: 'recording', recording: rec });
          }
        }}
        className="flex-1 min-w-0 text-xs bg-[#22223b] text-slate-200 border border-[#3d3d5c] rounded-lg px-2 py-1 outline-none"
      >
        <option value="none">— Aucune source —</option>
        {devices.length > 0 && (
          <optgroup label="Caméras">
            {devices.map(d => (
              <option key={d.deviceId} value={`cam:${d.deviceId}`}>
                {d.label || `Caméra ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </optgroup>
        )}
        {recordings.length > 0 && (
          <optgroup label="Enregistrements">
            {recordings.map(r => (
              <option key={r.id} value={`rec:${r.id}`}>{r.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
