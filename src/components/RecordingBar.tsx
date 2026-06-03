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
  captures: Capture[];
  onDownloadCapture: (c: Capture) => void;
  onDeleteCapture: (id: string) => void;
}

export function RecordingBar({
  isRecording, isPaused, elapsed, recordings, activeRecordingId,
  isLiveMode, isPlaybackPaused, playbackTime, playbackDuration,
  onStartRecording, onPauseRecording, onStopRecording,
  onSelectRecording, onDeleteRecording, onDownloadRecording,
  onImportVideo, onLiveMode, onPlayPause, onFramePrev, onFrameNext,
  captures, onDownloadCapture, onDeleteCapture,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#13131f] border-t border-[#22223b] h-14 shrink-0">
      {/* Live / Import toggle */}
      <div className="flex rounded-lg overflow-hidden border border-[#22223b]">
        <button
          onClick={onLiveMode}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            isLiveMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📷 Live
        </button>
        <button
          onClick={onImportVideo}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            !isLiveMode ? 'bg-[#22223b] text-slate-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📂 Importer
        </button>
      </div>

      {/* Recording controls (live mode) */}
      {isLiveMode && (
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={onStartRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Enregistrer
            </button>
          ) : (
            <>
              <span className={`text-sm font-mono font-bold tabular-nums ${isPaused ? 'text-yellow-400' : 'text-red-400'}`}>
                {isPaused ? '⏸ ' : '⏺ '}{formatDuration(elapsed)}
              </span>
              <button
                onClick={onPauseRecording}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-xs font-medium"
              >
                {isPaused ? '▶ Reprendre' : '⏸ Pause'}
              </button>
              <button
                onClick={onStopRecording}
                className="px-3 py-1.5 bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-lg text-xs font-medium"
              >
                ⏹ Arrêter
              </button>
            </>
          )}
        </div>
      )}

      {/* Playback controls (video mode) */}
      {!isLiveMode && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onFramePrev}
            title="Image précédente (←)"
            disabled={!isPlaybackPaused}
            className="w-8 h-8 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
          >
            ⏮
          </button>
          <button
            onClick={onPlayPause}
            title={isPlaybackPaused ? 'Lecture (Entrée)' : 'Pause (Entrée)'}
            className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPlaybackPaused ? '▶' : '⏸'}
          </button>
          <button
            onClick={onFrameNext}
            title="Image suivante (→)"
            disabled={!isPlaybackPaused}
            className="w-8 h-8 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
          >
            ⏭
          </button>
          <div className="flex items-baseline gap-1 font-mono tabular-nums">
            <span className="text-xs text-slate-300">{fmtTime(playbackTime)}</span>
            <span className="text-[10px] text-slate-500">/ {isFinite(playbackDuration) && playbackDuration > 0 ? fmtDuration(playbackDuration) : '—'}</span>
          </div>
          {isPlaybackPaused && (
            <span className="text-[10px] text-slate-500">← → image · MAJ+← → ×10</span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Captures library */}
      {captures.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 max-w-[30%] border-r border-[#22223b] pr-3 mr-1">
          {captures.map(cap => (
            <div
              key={cap.id}
              className="group relative shrink-0 cursor-pointer"
              title={cap.name}
            >
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
                <button
                  onClick={e => { e.stopPropagation(); onDownloadCapture(cap); }}
                  title="Télécharger"
                  className="text-xs text-white hover:text-indigo-300 px-1"
                >⬇</button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteCapture(cap.id); }}
                  title="Supprimer"
                  className="text-xs text-red-400 hover:text-red-300 px-1"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recordings library */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-[40%]">
        {recordings.length === 0 && (
          <span className="text-xs text-slate-600">Aucun enregistrement</span>
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
              <button
                onClick={e => { e.stopPropagation(); onDownloadRecording(rec); }}
                title="Télécharger"
                className="text-xs text-slate-400 hover:text-white px-1"
              >⬇</button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteRecording(rec.id); }}
                title="Supprimer"
                className="text-xs text-red-400 hover:text-red-300 px-1"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
