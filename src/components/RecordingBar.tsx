import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Recording, Capture } from '../types';
import { formatDuration } from '../hooks/useRecorder';

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Seekbar ───────────────────────────────────────────────────────────────────

interface SeekbarProps {
  time: number;
  duration: number;
  onSeek: (t: number) => void;
}

function Seekbar({ time, duration, onSeek }: SeekbarProps) {
  const barRef    = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);
  // Keep latest duration + onSeek in refs so the window listeners never go stale
  const durationRef = useRef(duration);
  const onSeekRef   = useRef(onSeek);
  durationRef.current = duration;
  onSeekRef.current   = onSeek;

  // Local drag percentage for immediate visual feedback (overrides prop during drag)
  const [dragPct, setDragPct] = useState<number | null>(null);

  const getPct = (clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  const seekFromClient = (clientX: number) => {
    const pct = getPct(clientX);
    setDragPct(pct);
    const t = (pct / 100) * durationRef.current;
    onSeekRef.current(t);
  };

  // Attach window listeners once — always calls latest seek via refs
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) seekFromClient(e.clientX); };
    const onUp   = () => { if (dragging.current) { dragging.current = false; setDragPct(null); } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []); // eslint-disable-line

  const displayPct = dragPct !== null ? dragPct : (duration > 0 ? Math.min(100, (time / duration) * 100) : 0);

  return (
    <div
      ref={barRef}
      className="relative h-2 rounded-full bg-white/10 cursor-pointer group"
      onMouseDown={e => { dragging.current = true; seekFromClient(e.clientX); }}
    >
      <div
        className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full pointer-events-none"
        style={{ width: `${displayPct}%` }}
      />
      <div
        className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none
                   opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${displayPct}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

// ── RecordingBar ──────────────────────────────────────────────────────────────

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  elapsed: number;
  recordings: Recording[];
  activeRecordingId: string | null;
  isLiveMode: boolean;
  isPlaybackPaused: boolean;
  playbackTime: number;
  playbackDuration: number;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onStopRecording: () => void;
  onSelectRecording: (r: Recording) => void;
  onDeleteRecording: (id: string) => void;
  onDownloadRecording: (r: Recording) => void;
  onImportVideo: () => void;
  onLiveMode: () => void;
  onPlayPause: () => void;
  onFramePrev: () => void;
  onFrameNext: () => void;
  onSeek: (t: number) => void;
  captures: Capture[];
  onDownloadCapture: (c: Capture) => void;
  onDeleteCapture: (id: string) => void;
}

export function RecordingBar({
  isRecording, isPaused, elapsed, recordings, activeRecordingId,
  isLiveMode, isPlaybackPaused, playbackTime, playbackDuration,
  onStartRecording, onPauseRecording, onStopRecording,
  onSelectRecording, onDeleteRecording, onDownloadRecording,
  onImportVideo, onLiveMode, onPlayPause, onFramePrev, onFrameNext, onSeek,
  captures, onDownloadCapture, onDeleteCapture,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center px-4 bg-[#13131f] border-t border-[#22223b] shrink-0 h-14">

      {/* ── Left: source + recording controls ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex rounded-lg overflow-hidden border border-[#22223b] shrink-0">
          <button
            onClick={onLiveMode}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              isLiveMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('recording.live')}
          </button>
          <button
            onClick={onImportVideo}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !isLiveMode ? 'bg-[#22223b] text-slate-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('recording.import')}
          </button>
        </div>

        {isLiveMode && (
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={onStartRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-white" />
                {t('recording.record')}
              </button>
            ) : (
              <>
                <span className={`text-sm font-mono font-bold tabular-nums ${isPaused ? 'text-yellow-400' : 'text-red-400'}`}>
                  {isPaused ? '⏸ ' : '⏺ '}{formatDuration(elapsed)}
                </span>
                <button onClick={onPauseRecording} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-xs font-medium">
                  {isPaused ? t('recording.resume') : t('recording.pause')}
                </button>
                <button onClick={onStopRecording} className="px-3 py-1.5 bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-lg text-xs font-medium">
                  {t('recording.stop')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Center: player (fixed width, truly centered) ── */}
      <div className="w-[380px] shrink-0 flex flex-col justify-center gap-1 px-2">
        {!isLiveMode && (
          <>
            {/* Seekbar */}
            <Seekbar time={playbackTime} duration={playbackDuration} onSeek={onSeek} />

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onFramePrev}
                title={t('recording.framePrev')}
                disabled={!isPlaybackPaused}
                className="w-7 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-md text-sm transition-colors disabled:opacity-30"
              >
                ⏮
              </button>
              <button
                onClick={onPlayPause}
                title={isPlaybackPaused ? t('recording.play') : t('recording.pausePlayback')}
                className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isPlaybackPaused ? '▶' : '⏸'}
              </button>
              <button
                onClick={onFrameNext}
                title={t('recording.frameNext')}
                disabled={!isPlaybackPaused}
                className="w-7 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-md text-sm transition-colors disabled:opacity-30"
              >
                ⏭
              </button>
              <div className="flex items-baseline gap-1 font-mono tabular-nums ml-1">
                <span className="text-xs text-slate-300">{fmtTime(playbackTime)}</span>
                <span className="text-[10px] text-slate-500">
                  / {isFinite(playbackDuration) && playbackDuration > 0 ? fmtDuration(playbackDuration) : '—'}
                </span>
              </div>
              <span className={`text-[9px] ml-1 ${isPlaybackPaused ? 'text-slate-600' : 'invisible'}`}>{t('recording.shiftHint')}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Right: captures + recordings ── */}
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0 overflow-hidden">
        {captures.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 max-w-[40%] border-r border-[#22223b] pr-3 mr-1">
            {captures.map(cap => (
              <div key={cap.id} className="group relative shrink-0 cursor-pointer" title={cap.name}>
                <img
                  src={cap.url}
                  alt={cap.name}
                  className="h-9 w-16 object-cover rounded border border-[#3d3d5c] group-hover:border-indigo-400 transition-colors"
                />
                {cap.paneLabel && (
                  <span className="absolute top-0.5 left-0.5 text-[9px] font-bold bg-black/70 text-indigo-300 px-1 rounded">
                    {cap.paneLabel}
                  </span>
                )}
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/50 rounded">
                  <button onClick={e => { e.stopPropagation(); onDownloadCapture(cap); }} title={t('recording.download')} className="text-xs text-white hover:text-indigo-300 px-1">⬇</button>
                  <button onClick={e => { e.stopPropagation(); onDeleteCapture(cap.id); }} title={t('recording.delete')} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto shrink min-w-0">
          {recordings.length === 0 && (
            <span className="text-xs text-slate-600 whitespace-nowrap">{t('recording.noRecordings')}</span>
          )}
          {recordings.map(rec => (
            <div
              key={rec.id}
              onClick={() => onSelectRecording(rec)}
              className={`group flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer shrink-0 transition-colors border ${
                activeRecordingId === rec.id
                  ? 'bg-indigo-900/50 border-indigo-500'
                  : 'bg-[#22223b] border-transparent hover:border-[#3d3d5c]'
              }`}
            >
              <span className="text-base">🎬</span>
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 max-w-[120px] truncate">{rec.name}</span>
                <span className="text-[10px] text-slate-500">{formatDuration(rec.duration)}</span>
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                <button onClick={e => { e.stopPropagation(); onDownloadRecording(rec); }} title={t('recording.download')} className="text-xs text-slate-400 hover:text-white px-1">⬇</button>
                <button onClick={e => { e.stopPropagation(); onDeleteRecording(rec.id); }} title={t('recording.delete')} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
