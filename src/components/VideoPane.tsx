import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaneSource, Recording, Capture, Layer, Tool, Discipline, SkeletonElement, Point, SkeletonKey, AnnotationElement } from '../types';
import { AnnotationCanvas } from './AnnotationCanvas';
import { useZoomPan } from '../hooks/useZoomPan';
import { ZoomControls } from './ZoomControls';
import { GuideOverlay } from './GuideOverlay';
import { GridOverlay } from './GridOverlay';
import { capturePane } from '../utils/captureFrame';
import { computeVideoRect, type VideoRect } from '../hooks/useVideoRect';
import { useTracking, applyTrackingToSkeleton, TRACKING_JOINTS, FREE_COLORS } from '../hooks/useTracking';
import { TrackingOverlay } from './TrackingOverlay';
import { TrajectoryCanvas } from './TrajectoryCanvas';

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
  annotationProps?: AnnotationProps;
}

export interface AnnotationProps {
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
  onAddNamedLayer?: (name: string) => string;
  discipline?: Discipline;
}

export interface VideoPaneHandle {
  stepFrame: (dir: 1 | -1, fps?: number, frames?: number) => void;
  seekTo: (time: number) => void;
  getTime: () => number;
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
  const imageRef       = useRef<HTMLImageElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const isPanMode      = annotationProps?.tool === 'pan';

  // Track the video/image display rect (object-contain letterbox)
  const [videoRect, setVideoRect] = useState<VideoRect | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const stepVideoFrame = useCallback((dir: 1 | -1) => {
    if (source.type !== 'recording') return;
    const v = videoRef.current;
    if (!v || !v.paused) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir / 30));
  }, [source.type]);

  const zoomState = useZoomPan(isPanMode, d => stepVideoFrame(d < 0 ? -1 : 1));

  // ── Refs stale-closure-safe pour les callbacks tracking ───────────────────
  const annotationPropsRef = useRef(annotationProps);
  useEffect(() => { annotationPropsRef.current = annotationProps; }, [annotationProps]);
  const videoRectRef2 = useRef<VideoRect | null>(null);
  const imgDimsRef    = useRef({ w: 0, h: 0 });

  // World canvas → coordonnées naturelles vidéo
  const worldToNatural = useCallback((wx: number, wy: number): Point => {
    const vr  = videoRectRef2.current;
    const dim = imgDimsRef.current;
    if (!vr || !dim.w) return { x: wx, y: wy };
    return { x: (wx / vr.w) * dim.w, y: (wy / vr.h) * dim.h };
  }, []);

  // Coordonnées naturelles vidéo → world canvas
  const naturalToWorld = useCallback((nx: number, ny: number): Point => {
    const vr  = videoRectRef2.current;
    const dim = imgDimsRef.current;
    if (!vr || !dim.w) return { x: nx, y: ny };
    return { x: (nx / dim.w) * vr.w, y: (ny / dim.h) * vr.h };
  }, []);

  const onUpdateSkeleton = useCallback((positions: Partial<Record<SkeletonKey, Point>>) => {
    const ap = annotationPropsRef.current;
    if (!ap) return;
    const layer = ap.layers.find(l => l.id === ap.activeLayerId);
    const sk    = layer?.elements.find(el => el.type === 'skeleton') as SkeletonElement | undefined;
    if (!sk) return;
    const worldPos: Partial<Record<SkeletonKey, Point>> = {};
    for (const [k, pt] of Object.entries(positions) as [SkeletonKey, Point][]) {
      if (pt) worldPos[k] = naturalToWorld(pt.x, pt.y);
    }
    ap.onUpdateElement(ap.activeLayerId, applyTrackingToSkeleton(sk, worldPos));
  }, [naturalToWorld]);

  const trajCounterRef = useRef(0);  // pour nommer les calques "Trajectoire 1", "Trajectoire 2"…

  const {
    tracking, startTracking, stopTracking, addFreePoint,
    trajectoryHistoryRef, lostJointsRef, jointConfidenceRef, definitiveLostRef,
  } = useTracking({ videoRef, onUpdateSkeleton });

  // Démarre le tracking en extrayant les positions du squelette actif
  const handleStartTracking = useCallback(() => {
    const ap = annotationPropsRef.current;
    if (!ap) return;
    const layer = ap.layers.find(l => l.id === ap.activeLayerId);
    const sk    = layer?.elements.find(el => el.type === 'skeleton') as SkeletonElement | undefined;
    if (!sk) return;

    const initPoints = TRACKING_JOINTS
      .filter(key => sk.points[key] !== undefined)
      .map(key => {
        const nat = worldToNatural(sk.points[key].x, sk.points[key].y);
        return { key, x: nat.x, y: nat.y, lost: false, err: 1 };
      });

    if (initPoints.length === 0) return;
    startTracking(initPoints);
  }, [worldToNatural, startTracking]);

  // Clic outil "trajectory" : auto-start si besoin + ajout du point
  const handleTrajectoryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const container = zoomState.containerRef.current;
    const vr  = videoRectRef2.current;
    const dim = imgDimsRef.current;
    if (!container || !vr || !dim.w) return;

    const rect = container.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;

    const { zoom, pan } = zoomState;
    const tx   = zoom * (pan.x + vr.x) + container.clientWidth  / 2 * (1 - zoom);
    const ty   = zoom * (pan.y + vr.y) + container.clientHeight / 2 * (1 - zoom);
    const wx   = (cx - tx) / zoom;
    const wy   = (cy - ty) / zoom;
    const natX = (wx / vr.w) * dim.w;
    const natY = (wy / vr.h) * dim.h;

    if (natX < 0 || natX > dim.w || natY < 0 || natY > dim.h) return;

    if (tracking.mode === 'off') startTracking([], 'trajectory');

    const ap = annotationPropsRef.current;
    if (!ap?.onAddNamedLayer) return;

    const colorIdx  = trajCounterRef.current % FREE_COLORS.length;
    const color     = FREE_COLORS[colorIdx];
    const layerName = `Trajectoire ${++trajCounterRef.current}`;
    const layerId   = ap.onAddNamedLayer(layerName);

    addFreePoint(natX, natY, layerId, color);
  }, [zoomState, tracking.mode, startTracking, addFreePoint]);


  const isVideoSource = source.type === 'camera' || source.type === 'recording';

  // Memoised: does the active layer have a skeleton?
  const hasSkeleton = useMemo(() => {
    if (!annotationProps) return false;
    const al = annotationProps.layers.find(l => l.id === annotationProps.activeLayerId);
    return al?.elements.some(el => el.type === 'skeleton') ?? false;
  }, [annotationProps]);

  // updateVideoRect declared AFTER zoomState to avoid accessing it before declaration
  const updateVideoRect = useCallback(() => {
    const video = videoRef.current;
    const container = zoomState.containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) return;
    const aspect = video.videoWidth / video.videoHeight;
    const vr = computeVideoRect(container.clientWidth, container.clientHeight, aspect);
    videoRectRef2.current = vr;
    imgDimsRef.current    = { w: video.videoWidth, h: video.videoHeight };
    setVideoRect(vr);
    setImgDims({ w: video.videoWidth, h: video.videoHeight });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateImageRect = useCallback(() => {
    const img = imageRef.current;
    const container = zoomState.containerRef.current;
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    const vr = computeVideoRect(container.clientWidth, container.clientHeight, aspect);
    videoRectRef2.current = vr;
    imgDimsRef.current    = { w: img.naturalWidth, h: img.naturalHeight };
    setVideoRect(vr);
    setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Video/image rect (letterbox) tracking ──────────────────────────────────
  useEffect(() => {
    const container = zoomState.containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => {
      if (source.type === 'image') updateImageRect(); else updateVideoRect();
    });
    obs.observe(container);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, updateVideoRect, updateImageRect, zoomState.containerRef]);

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
            deviceId: source.deviceId ? { exact: source.deviceId } : undefined,
            frameRate: { ideal: 60 },
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

      const onTime  = () => onTimeUpdate?.(video.currentTime);
      const onPause = () => onPlayStateChange?.(true);
      const onPlay  = () => onPlayStateChange?.(false);

      // WebM files recorded by MediaRecorder do not embed a duration in the
      // header — video.duration is Infinity. The standard fix is to seek to a
      // huge timestamp so the browser reads the last cluster and derives the
      // real duration, then seek back to 0 (or the pending restore position).
      let fixingDuration = false;
      const onDur = () => {
        if (isFinite(video.duration) && video.duration > 0) {
          onDurationChange?.(video.duration);
          if (fixingDuration) {
            fixingDuration = false;
            const seek = pendingSeekRef.current ?? 0;
            pendingSeekRef.current = null;
            video.currentTime = seek;
          }
        }
      };

      const onLoaded = () => {
        onPlayStateChange?.(video.paused);
        updateVideoRect();
        if (!isFinite(video.duration) || video.duration <= 0) {
          // Trigger the browser to seek to the end so it can determine duration.
          fixingDuration = true;
          video.currentTime = 1e101; // browser clamps to actual end
        } else {
          onDur();
          onTime();
        }
      };

      const onCanPlay = () => {
        if (!fixingDuration) {
          onDur();
          if (pendingSeekRef.current !== null) {
            video.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
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

    if (source.type === 'image') {
      // Stop any active camera/video
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      onStreamChange?.(null);
      video.srcObject = null;
      video.src = '';
      // Image rect computed in onLoad below via imageRef
      return;
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
      if (!v) return;
      if (!v.paused) v.pause();
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + dir * frames / fps));
      // Chromium bug: paused video doesn't always repaint on currentTime change.
      // play() → pause() forces frame decode and display.
      v.play().then(() => v.pause()).catch(() => {});
    },
    seekTo(time: number) {
      const v = videoRef.current;
      if (!v) return;
      if (v.readyState >= 1) v.currentTime = time;
      else pendingSeekRef.current = time;
    },
    getTime()    { return videoRef.current?.currentTime ?? 0; },
    isPaused()   { return videoRef.current?.paused ?? true; },
    togglePlay() { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); },
  }));

  const isNone  = source.type === 'none';
  const isImage = source.type === 'image';

  return (
    <div
      ref={zoomState.containerRef}
      className={`relative flex-1 bg-black overflow-hidden ${active ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
      onClick={onFocus}
    >
      {/* Transform wrapper — video / image */}
      <div style={zoomState.transformStyle}>
        <video
          ref={videoRef}
          autoPlay={source.type === 'camera'}
          muted={source.type === 'camera'}
          playsInline
          crossOrigin="anonymous"
          style={{ pointerEvents: isPanMode ? 'none' : undefined }}
          className={`absolute inset-0 w-full h-full object-contain ${(isNone || isImage) ? 'hidden' : ''}`}
        />
        {isImage && (
          <img
            ref={imageRef}
            src={(source as { type: 'image'; capture: { url: string } }).capture.url}
            alt=""
            onLoad={updateImageRect}
            style={{ pointerEvents: isPanMode ? 'none' : undefined }}
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
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
          imgW={imgDims.w}
          imgH={imgDims.h}
          discipline={annotationProps.discipline}
          style={annotationProps.tool === 'pan' || annotationProps.tool === 'trajectory' ? { pointerEvents: 'none' } : undefined}
        />
      )}

      <GuideOverlay visible={showGuide} />
      <GridOverlay visible={showGrid} gridSize={gridSize} zoom={zoomState.zoom} pan={zoomState.pan} />
      <ZoomControls state={zoomState} />

      {/* Trajectoires — canvas overlay séparé */}
      {isVideoSource && (
        <TrajectoryCanvas
          trajectoryHistoryRef={trajectoryHistoryRef}
          lostJointsRef={lostJointsRef}
          jointConfidenceRef={jointConfidenceRef}
          definitiveLostRef={definitiveLostRef}
          layers={annotationProps?.layers ?? []}
          zoom={zoomState.zoom}
          pan={zoomState.pan}
          videoRect={videoRect}
          imgW={imgDims.w}
          imgH={imgDims.h}
        />
      )}

      {isVideoSource && tracking.source === 'skeleton' && (
        <TrackingOverlay mode={tracking.mode} />
      )}

      {/* Overlay transparent outil trajectory — capte les clics sur la vidéo */}
      {annotationProps?.tool === 'trajectory' && isVideoSource && (
        <div
          className="absolute inset-0"
          style={{ zIndex: 55, cursor: 'crosshair' }}
          onClick={handleTrajectoryClick}
        />
      )}

      {/* Bottom-right buttons: tracking + capture */}
      <div className="absolute flex items-center gap-2" style={{ bottom: 8, right: 8, zIndex: 300 }}>
        {isVideoSource && annotationProps && (
          <button
            onClick={e => {
              e.stopPropagation();
              if (tracking.source === 'skeleton' && tracking.mode !== 'off') { stopTracking(); return; }
              if (!hasSkeleton) return;
              handleStartTracking();
            }}
            title={hasSkeleton ? t('tracking.activate') : t('tracking.noSkeleton')}
            disabled={!hasSkeleton && tracking.mode === 'off'}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-sm transition-colors',
              tracking.source === 'skeleton' && tracking.mode !== 'off'
                ? 'bg-red-600/70 hover:bg-red-600/90 border-red-400/30 text-white'
                : hasSkeleton
                  ? 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
                  : 'bg-black/30 border-white/10 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.25"/>
              <line x1="7" y1="0" x2="7" y2="3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <line x1="7" y1="10.5" x2="7" y2="14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <line x1="0" y1="7" x2="3.5" y2="7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <line x1="10.5" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {onCapture && (
          <button
            onClick={async e => {
              e.stopPropagation();
              const container = zoomState.containerRef.current;
              if (!container) return;
              const { blob, name } = await capturePane(
                container,
                label,
                annotationProps?.layers,
                videoRect,
              );
              onCapture(blob, name);
            }}
            title={t('video.captureTitle')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/20 text-white text-xs font-medium backdrop-blur-sm transition-colors"
          >
            {t('video.capture')}
          </button>
        )}
      </div>

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
  captures?: Capture[];
  label: string;
  onChange: (s: PaneSource) => void;
  onRefreshDevices?: () => void;
}

export function SourceSelector({ source, devices, recordings, captures = [], label, onChange, onRefreshDevices }: SourceSelectorProps) {
  const { t } = useTranslation();
  const value =
    source.type === 'camera'    ? `cam:${source.deviceId}`
    : source.type === 'recording' ? `rec:${source.recording.id}`
    : source.type === 'image'     ? `img:${source.capture.id}`
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
          } else if (v.startsWith('img:')) {
            const cap = captures.find(c => c.id === v.slice(4));
            if (cap) onChange({ type: 'image', capture: cap });
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
        {captures.length > 0 && (
          <optgroup label={t('video.captures', 'Captures')}>
            {captures.map(c => (
              <option key={c.id} value={`img:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Refresh button — lets users re-scan after plugging in a camera or
          after macOS TCC permission is granted mid-session */}
      {onRefreshDevices && (
        <button
          onClick={onRefreshDevices}
          title={t('video.refreshCameras', 'Actualiser les caméras')}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-[#22223b] transition-colors text-sm"
        >
          ↺
        </button>
      )}
    </div>
  );
}
