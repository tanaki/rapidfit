import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaneSource, Recording, Layer, Tool } from '../types';
import type { AnnotationElement } from '../types';
import { AnnotationCanvas } from './AnnotationCanvas';
import { useZoomPan } from '../hooks/useZoomPan';
import { ZoomControls } from './ZoomControls';
import { GuideOverlay } from './GuideOverlay';
import { GridOverlay } from './GridOverlay';
import { capturePane } from '../utils/captureFrame';
import { computeVideoRect, type VideoRect } from '../hooks/useVideoRect';

interface Props {
  source: PaneSource;
  devices: MediaDeviceInfo[];
  recordings: Recording[];
  active?: boolean;
  label?: string;
  onFocus?: () => void;
  showGuide?: boolean;
  showGrid?: boolean;
  gridSize?: number;
  onCapture?: (blob: Blob, name: string) => void;
  // Media callbacks — used by pane A to sync state to App
  onStreamChange?: (stream: MediaStream | null) => void;
  onCameraError?: (err: string | null) => void;
  onTimeUpdate?: (t: number) => void;
  onDurationChange?: (d: number) => void;
  onPlayStateChange?: (paused: boolean) => void;
  annotationProps?: {
    layers: Layer[];
    activeLayerId: string;
    tool: Tool;
    color: string;
    strokeWidth: number;
    filled: boolean;
    onAddElement: (layerId: string, el: AnnotationElement) => void;
    onEraseAt: (layerId: string, p: { x: number; y: number }, radius: number) => void;
    onUpdateElement: (layerId: string, el: AnnotationElement) => void;
    onDeleteElement: (layerId: string, elementId: string) => void;
    onBeginDrag: () => void;
    onRescaleElements?: (sx: number, sy: number) => void;
  };
}

export interface VideoPaneHandle {
  stepFrame: (dir: 1 | -1, fps?: number, frames?: number) => void;
  seekTo: (time: number) => void;
  isPaused: () => boolean;
  togglePlay: () => void;
}

export const VideoPane = forwardRef<VideoPaneHandle, Props>(function VideoPane(
  {
    source, active = false, label, onFocus,
    showGuide = false, showGrid = false, gridSize = 50,
    onCapture,
    onStreamChange, onCameraError, onTimeUpdate, onDurationChange, onPlayStateChange,
    annotationProps,
  },
  ref,
) {
  const { t } = useTranslation();
  const videoRef       = useRef<HTMLVideoElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const isPanMode      = annotationProps?.tool === 'pan';

  // Track the video display rect (object-contain letterbox)
  const [videoRect, setVideoRect] = useState<VideoRect | null>(null);

  const stepVideoFrame = useCallback((dir: 1 | -1) => {
    if (source.type !== 'recording') return;
    const v = videoRef.current;
    if (!v || !v.paused) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir / 30));
  }, [source.type]);

  const zoomState = useZoomPan(isPanMode, d => stepVideoFrame(d < 0 ? -1 : 1));

  // updateVideoRect declared AFTER zoomState to avoid accessing it before declaration
  const updateVideoRect = useCallback(() => {
    const video = videoRef.current;
    const container = zoomState.containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) return;
    const aspect = video.videoWidth / video.videoHeight;
    setVideoRect(computeVideoRect(container.clientWidth, container.clientHeight, aspect));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Video rect (letterbox) tracking ────────────────────────────────────────
  useEffect(() => {
    const container = zoomState.containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(updateVideoRect);
    obs.observe(container);
    return () => obs.disconnect();
  }, [updateVideoRect, zoomState.containerRef]);

  // ── Source management ───────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (source.type === 'camera') {
      let cancelled = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      onStreamChange?.(null);
      onCameraError?.(null);
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
          onStreamChange?.(stream);
          video.addEventListener('loadedmetadata', updateVideoRect, { once: true });
        })
        .catch(err => {
          if (!cancelled) onCameraError?.(err?.message ?? err?.name ?? 'camera-error');
        });
      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        onStreamChange?.(null);
      };
    }

    if (source.type === 'recording') {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      onStreamChange?.(null);
      video.srcObject = null;
      video.src = source.recording.url;
      video.load();

      const onTime     = () => onTimeUpdate?.(video.currentTime);
      const onDur      = () => { if (isFinite(video.duration) && video.duration > 0) onDurationChange?.(video.duration); };
      const onPause    = () => onPlayStateChange?.(true);
      const onPlay     = () => onPlayStateChange?.(false);
      const onLoaded   = () => { onDur(); onPlayStateChange?.(video.paused); onTime(); updateVideoRect(); };
      const onCanPlay  = () => {
        onDur();
        if (pendingSeekRef.current !== null) {
          video.currentTime = pendingSeekRef.current;
          pendingSeekRef.current = null;
        }
      };

      video.addEventListener('timeupdate',     onTime);
      video.addEventListener('seeked',         onTime);
      video.addEventListener('durationchange', onDur);
      video.addEventListener('canplay',        onCanPlay);
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('pause',          onPause);
      video.addEventListener('play',           onPlay);

      return () => {
        video.removeEventListener('timeupdate',     onTime);
        video.removeEventListener('seeked',         onTime);
        video.removeEventListener('durationchange', onDur);
        video.removeEventListener('canplay',        onCanPlay);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('pause',          onPause);
        video.removeEventListener('play',           onPlay);
      };
    }

    // none
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    onStreamChange?.(null);
    video.srcObject = null;
    video.src = '';
  }, [source]); // eslint-disable-line

  // ── Imperative handle ───────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    stepFrame(dir, fps = 30, frames = 1) {
      const v = videoRef.current;
      if (!v || !v.paused) return;
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir * frames / fps));
    },
    seekTo(time: number) {
      const v = videoRef.current;
      if (!v) return;
      if (v.readyState >= 1) v.currentTime = time;
      else pendingSeekRef.current = time;
    },
    isPaused()   { return videoRef.current?.paused ?? true; },
    togglePlay() { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); },
  }));

  const isNone = source.type === 'none';

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
            <span className="text-xs">{t('video.noSource')}</span>
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
          onRescaleElements={annotationProps.onRescaleElements}
          videoRect={videoRect}
          style={annotationProps.tool === 'pan' ? { pointerEvents: 'none' } : undefined}
        />
      )}

      <GuideOverlay visible={showGuide} />
      <GridOverlay visible={showGrid} gridSize={gridSize} zoom={zoomState.zoom} pan={zoomState.pan} />
      <ZoomControls state={zoomState} />

      {onCapture && (
        <button
          onClick={async e => {
            e.stopPropagation();
            const container = zoomState.containerRef.current;
            if (!container) return;
            const { blob, name } = await capturePane(container, label);
            onCapture(blob, name);
          }}
          title={t('video.captureTitle')}
          style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 300 }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-colors"
        >
          {t('video.capture')}
        </button>
      )}

      {/* Label badge — only in split mode (when label is provided) */}
      {label && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 pointer-events-none" style={{ zIndex: 300 }}>
          <span className="text-[10px] font-semibold text-white/60 bg-black/40 px-2 py-0.5 rounded-full">{label}</span>
          {active && <span className="text-[10px] text-white bg-indigo-600/80 px-2 py-0.5 rounded-full">{t('video.active')}</span>}
        </div>
      )}
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
  const { t } = useTranslation();
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
        <option value="none">{t('video.noSourceOption')}</option>
        {devices.length > 0 && (
          <optgroup label={t('video.cameras')}>
            {devices.map(d => (
              <option key={d.deviceId} value={`cam:${d.deviceId}`}>
                {d.label || t('video.cameraLabel', { id: d.deviceId.slice(0, 6) })}
              </option>
            ))}
          </optgroup>
        )}
        {recordings.length > 0 && (
          <optgroup label={t('video.recordings')}>
            {recordings.map(r => (
              <option key={r.id} value={`rec:${r.id}`}>{r.name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
