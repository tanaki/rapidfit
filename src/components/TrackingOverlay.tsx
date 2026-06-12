import { useTranslation } from 'react-i18next';
import type { VideoRect } from '../hooks/useVideoRect';
import { TRACKING_JOINTS, type TrackingMode } from '../hooks/useTracking';

const JOINT_COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6',
];

interface InitPoint { x: number; y: number }

interface Props {
  mode: TrackingMode;
  initIndex: number;
  clickedPoints: InitPoint[];
  videoRect: VideoRect | null;
  onInitClick: (containerX: number, containerY: number) => void;
  onStop: () => void;
}

export function TrackingOverlay({ mode, initIndex, clickedPoints, videoRect, onInitClick, onStop }: Props) {
  const { t } = useTranslation();

  if (mode === 'off') return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Only register clicks inside the video area
    if (videoRect && (cx < videoRect.x || cx > videoRect.x + videoRect.w || cy < videoRect.y || cy > videoRect.y + videoRect.h)) return;
    onInitClick(cx, cy);
  };

  const nextJointKey = initIndex < TRACKING_JOINTS.length ? TRACKING_JOINTS[initIndex] : null;
  const nextJointLabel = nextJointKey ? t(`tracking.joints.${nextJointKey}`) : null;

  const panelLeft = videoRect ? videoRect.x + videoRect.w / 2 : '50%';
  const panelTop  = videoRect ? videoRect.y + 16 : 16;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>

      {/* Click interceptor — active only during initialization */}
      {mode === 'initializing' && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{ cursor: 'crosshair' }}
          onClick={handleClick}
        />
      )}

      {/* Dots for already-placed joints */}
      {mode === 'initializing' && clickedPoints.map((pt, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full border-2 border-white"
          style={{
            left: pt.x,
            top: pt.y,
            transform: 'translate(-50%, -50%)',
            width: 16,
            height: 16,
            backgroundColor: JOINT_COLORS[i % JOINT_COLORS.length],
            boxShadow: '0 0 6px rgba(0,0,0,0.6)',
          }}
        />
      ))}

      {/* Guidance panel */}
      {mode === 'initializing' && nextJointLabel && (
        <div
          className="absolute pointer-events-none flex flex-col items-center"
          style={{
            left: panelLeft,
            top: panelTop,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-black/75 text-white rounded-xl px-4 py-2.5 text-center backdrop-blur-sm shadow-xl">
            <div className="text-[11px] text-white/60 mb-1">
              {t('tracking.clickJointHint', { n: initIndex + 1, total: TRACKING_JOINTS.length })}
            </div>
            <div className="text-sm font-semibold text-yellow-300">
              {nextJointLabel}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {mode === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/30">
          <div className="bg-black/75 text-white rounded-xl px-4 py-3 text-sm backdrop-blur-sm">
            {t('tracking.loading')}
          </div>
        </div>
      )}

      {/* Active indicator + stop button */}
      {(mode === 'active' || mode === 'initializing') && (
        <button
          className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-colors"
          style={
            mode === 'active'
              ? { backgroundColor: 'rgba(239,68,68,0.75)', borderColor: 'rgba(252,165,165,0.3)', color: 'white' }
              : { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }
          }
          onClick={e => { e.stopPropagation(); onStop(); }}
        >
          {mode === 'active' && <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />}
          {mode === 'active' ? t('tracking.stop') : t('tracking.cancel')}
        </button>
      )}
    </div>
  );
}
