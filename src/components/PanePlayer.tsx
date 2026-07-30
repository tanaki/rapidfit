import { useRef, useEffect, useState } from 'react';

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

interface SeekbarProps {
  time: number;
  duration: number;
  onSeek: (t: number) => void;
}

function Seekbar({ time, duration, onSeek }: SeekbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  durationRef.current = duration;
  onSeekRef.current = onSeek;
  const [dragPct, setDragPct] = useState<number | null>(null);

  const getPct = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  const seekFromClient = (clientX: number) => {
    const pct = getPct(clientX);
    setDragPct(pct);
    onSeekRef.current((pct / 100) * durationRef.current);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) seekFromClient(e.clientX); };
    const onUp = () => { if (dragging.current) { dragging.current = false; setDragPct(null); } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []); // eslint-disable-line

  const displayPct = dragPct !== null ? dragPct : (duration > 0 ? Math.min(100, (time / duration) * 100) : 0);

  return (
    <div
      ref={barRef}
      className="relative h-1.5 rounded-full bg-white/10 cursor-pointer group"
      onMouseDown={e => { dragging.current = true; seekFromClient(e.clientX); }}
    >
      <div className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full pointer-events-none" style={{ width: `${displayPct}%` }} />
      <div
        className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${displayPct}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

interface Props {
  label: string;
  isLiveMode: boolean;
  isPaused: boolean;
  time: number;
  duration: number;
  fps?: number;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onFramePrev: () => void;
  onFrameNext: () => void;
}

export function PanePlayer({ label, isLiveMode, isPaused, time, duration, fps, onPlayPause, onSeek, onFramePrev, onFrameNext }: Props) {
  if (isLiveMode) return null;

  return (
    <div className="shrink-0 flex flex-col gap-1 px-3 py-1.5 bg-[#13131f] border-t border-[#22223b]">
      <Seekbar time={time} duration={duration} onSeek={onSeek} />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-slate-500 w-4 shrink-0">{label}</span>
        <button
          onClick={onFramePrev}
          disabled={!isPaused}
          className="w-6 h-6 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded text-xs transition-colors disabled:opacity-30"
        >⏮</button>
        <button
          onClick={onPlayPause}
          className="w-7 h-6 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
        >{isPaused ? '▶' : '⏸'}</button>
        <button
          onClick={onFrameNext}
          disabled={!isPaused}
          className="w-6 h-6 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded text-xs transition-colors disabled:opacity-30"
        >⏭</button>
        <div className="flex-1 flex items-baseline font-mono tabular-nums ml-1">
          <span className="flex-1 text-center text-[10px] text-slate-300">
            {fmtTime(time)}/{isFinite(duration) && duration > 0 ? fmtTime(duration) : '—'}
          </span>
          {fps && fps > 0 && (
            <span className="text-[10px] text-slate-300">
              {Math.round(time * fps)}/{isFinite(duration) && duration > 0 ? Math.round(duration * fps) : '—'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
