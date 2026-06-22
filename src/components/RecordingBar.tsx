import { useTranslation } from 'react-i18next';
import { formatDuration } from '../hooks/useRecorder';

// ── RecordingBar ──────────────────────────────────────────────────────────────

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  elapsed: number;
  isLiveMode: boolean;
  canRecord: boolean; // pane actif en caméra (A ou B)
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onStopRecording: () => void;
  onImportVideo: () => void;
  onLiveMode: () => void;
  captureCount: number;
  recordingCount: number;
  showMedia: boolean;
  onToggleMedia: () => void;
}

export function RecordingBar({
  isRecording, isPaused, elapsed,
  isLiveMode: _isLiveMode, canRecord,
  onStartRecording, onPauseRecording, onStopRecording,
  onImportVideo, onLiveMode,
  captureCount, recordingCount, showMedia, onToggleMedia,
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
              canRecord ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('recording.live')}
          </button>
          <button
            onClick={onImportVideo}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !canRecord ? 'bg-[#22223b] text-slate-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('recording.import')}
          </button>
        </div>

        {canRecord && (
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

      {/* ── Right: media library toggle ── */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <button
          onClick={onToggleMedia}
          title={t('media.toggle', 'Bibliothèque médias')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            showMedia
              ? 'bg-[#22223b] border-indigo-500/60 text-slate-200'
              : 'bg-[#13131f] border-[#22223b] text-slate-500 hover:text-slate-300 hover:border-[#3d3d5c]'
          }`}
        >
          <span>📁</span>
          <span>{t('media.library', 'Médias')}</span>
          {(captureCount + recordingCount) > 0 && (
            <span className={`text-[10px] tabular-nums px-1.5 py-px rounded-full ${
              showMedia ? 'bg-indigo-600 text-white' : 'bg-[#22223b] text-slate-500'
            }`}>
              {captureCount + recordingCount}
            </span>
          )}
        </button>
      </div>

    </div>
  );
}
