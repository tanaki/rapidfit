import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capture, Recording } from '../types';
import { formatDuration } from '../hooks/useRecorder';

// ── Inline rename input ───────────────────────────────────────────────────────

function RenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); onCommit(draft.trim() || value); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => onCommit(draft.trim() || value)}
      onClick={e => e.stopPropagation()}
      className="w-full bg-[#22223b] border border-indigo-500 rounded px-1 text-[11px] text-slate-100 outline-none"
    />
  );
}

// ── Capture card ──────────────────────────────────────────────────────────────

function CaptureCard({
  cap, label, isActive,
  onSelect, onDownload, onDelete, onRename,
}: {
  cap: Capture;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`group flex flex-col shrink-0 w-28 cursor-pointer rounded-lg overflow-hidden border transition-colors
        ${isActive ? 'border-indigo-500' : 'border-[#2d2d48] hover:border-[#4d4d6c]'}`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black overflow-hidden">
        <img src={cap.url} alt={label} className="w-full h-full object-cover" />
        {cap.paneLabel && (
          <span className="absolute top-1 left-1 text-[9px] font-bold bg-indigo-600/90 text-white px-1 py-px rounded">
            {cap.paneLabel}
          </span>
        )}
        {/* Hover actions */}
        {confirming ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/80" onClick={e => e.stopPropagation()}>
            <span className="text-[10px] text-white font-medium">Supprimer ?</span>
            <div className="flex gap-1.5">
              <button onClick={e => { e.stopPropagation(); onDelete(); }}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-medium">Oui</button>
              <button onClick={e => { e.stopPropagation(); setConfirming(false); }}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px]">Non</button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1.5 bg-black/60">
            <button
              onClick={e => { e.stopPropagation(); onSelect(); }}
              title={t('recording.view', 'Afficher')}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/25 text-white text-xs transition-colors"
            >👁</button>
            <button
              onClick={e => { e.stopPropagation(); onDownload(); }}
              title={t('recording.download')}
              className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/25 text-white text-xs transition-colors"
            >⬇</button>
            <button
              onClick={e => { e.stopPropagation(); setConfirming(true); }}
              title={t('recording.delete')}
              className="w-6 h-6 flex items-center justify-center rounded bg-red-500/30 hover:bg-red-500/60 text-red-300 text-xs transition-colors"
            >✕</button>
          </div>
        )}
      </div>

      {/* Name — double-click to rename */}
      <div
        className="px-1.5 py-1 bg-[#13131f]"
        onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
        title={t('media.doubleClickRename', 'Double-clic pour renommer')}
      >
        {editing ? (
          <RenameInput
            value={label}
            onCommit={v => { onRename(v); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="block text-[10px] text-slate-400 truncate leading-tight select-none">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Recording row ─────────────────────────────────────────────────────────────

function RecordingRow({
  rec, label, isActive,
  onSelect, onDownload, onDelete, onRename,
}: {
  rec: Recording;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border
        ${isActive
          ? 'bg-indigo-900/40 border-indigo-600/60'
          : 'bg-[#0d0d14] border-transparent hover:bg-[#1a1a2e] hover:border-[#2d2d48]'}`}
      onClick={onSelect}
    >
      {/* Play icon */}
      <span className={`text-sm shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
        {isActive ? '▶' : '🎬'}
      </span>

      {/* Name + duration */}
      <div className="flex-1 min-w-0" onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}>
        {editing ? (
          <RenameInput
            value={label}
            onCommit={v => { onRename(v); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="text-xs text-slate-200 truncate leading-tight" title={label}>{label}</p>
            <p className="text-[10px] text-slate-500 tabular-nums">
              {rec.duration > 0 ? formatDuration(rec.duration) : '—'}
            </p>
          </>
        )}
      </div>

      {/* Actions — always visible on active, hover otherwise */}
      <div className={`flex items-center gap-1 shrink-0 ${isActive ? 'flex' : 'hidden group-hover:flex'}`} onClick={e => e.stopPropagation()}>
        {confirming ? (
          <>
            <span className="text-[10px] text-slate-300 mr-0.5">Supprimer ?</span>
            <button onClick={() => onDelete()}
              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-medium">Oui</button>
            <button onClick={() => setConfirming(false)}
              className="px-1.5 py-0.5 bg-[#22223b] hover:bg-[#2d2d48] text-slate-300 rounded text-[10px]">Non</button>
          </>
        ) : (
          <>
            <button
              onClick={e => { e.stopPropagation(); onDownload(); }}
              title={t('recording.download')}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-colors"
            >⬇</button>
            <button
              onClick={e => { e.stopPropagation(); setConfirming(true); }}
              title={t('recording.delete')}
              className="w-6 h-6 flex items-center justify-center rounded text-red-500/60 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
            >✕</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── MediaPanel ────────────────────────────────────────────────────────────────

interface Props {
  captures:        Capture[];
  recordings:      Recording[];
  activeRecordingId: string | null;
  captureLabels:   Record<string, string>;
  recordingLabels: Record<string, string>;
  onSelectCapture:    (c: Capture)   => void;
  onSelectRecording:  (r: Recording) => void;
  onDownloadCapture:  (c: Capture)   => void;
  onDeleteCapture:    (id: string)   => void;
  onDownloadRecording:(r: Recording) => void;
  onDeleteRecording:  (id: string)   => void;
  onRenameCapture:    (id: string, name: string) => void;
  onRenameRecording:  (id: string, name: string) => void;
}

export function MediaPanel({
  captures, recordings, activeRecordingId,
  captureLabels, recordingLabels,
  onSelectCapture, onSelectRecording,
  onDownloadCapture, onDeleteCapture,
  onDownloadRecording, onDeleteRecording,
  onRenameCapture, onRenameRecording,
}: Props) {
  const { t } = useTranslation();

  const capLabel  = useCallback((c: Capture)   => captureLabels[c.id]    ?? stripTimestamp(c.name),   [captureLabels]);
  const recLabel  = useCallback((r: Recording) => recordingLabels[r.id]  ?? stripTimestamp(r.name),   [recordingLabels]);

  const noCaptures   = captures.length   === 0;
  const noRecordings = recordings.length === 0;

  return (
    <div className="flex bg-[#0a0a12] border-t border-[#22223b] shrink-0 overflow-hidden" style={{ height: 200 }}>

      {/* ── Captures (left) ─────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-[#22223b] w-[45%] min-w-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#22223b] shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('media.captures', 'Captures')}
          </span>
          {captures.length > 0 && (
            <span className="text-[10px] text-slate-600 tabular-nums">{captures.length}</span>
          )}
        </div>

        {noCaptures ? (
          <div className="flex-1 flex items-center justify-center text-slate-700 text-xs">
            {t('media.noCaptures', 'Aucune capture')}
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-2 p-2 h-full items-start">
              {captures.map(cap => (
                <CaptureCard
                  key={cap.id}
                  cap={cap}
                  label={capLabel(cap)}
                  isActive={false}
                  onSelect={() => onSelectCapture(cap)}
                  onDownload={() => onDownloadCapture(cap)}
                  onDelete={() => onDeleteCapture(cap.id)}
                  onRename={name => onRenameCapture(cap.id, name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Recordings (right) ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#22223b] shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('media.recordings', 'Vidéos')}
          </span>
          {recordings.length > 0 && (
            <span className="text-[10px] text-slate-600 tabular-nums">{recordings.length}</span>
          )}
        </div>

        {noRecordings ? (
          <div className="flex-1 flex items-center justify-center text-slate-700 text-xs">
            {t('media.noRecordings', 'Aucune vidéo')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {recordings.map(rec => (
              <RecordingRow
                key={rec.id}
                rec={rec}
                label={recLabel(rec)}
                isActive={rec.id === activeRecordingId}
                onSelect={() => onSelectRecording(rec)}
                onDownload={() => onDownloadRecording(rec)}
                onDelete={() => onDeleteRecording(rec.id)}
                onRename={name => onRenameRecording(rec.id, name)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formate les noms auto-générés pour l'affichage avec date + heure.
 *  "Vidéo_2024-01-05_14h30m00.webm"     → "Vidéo · 05/01/2024 14:30"
 *  "Capture_A_2024-01-05_14h30m00.png"  → "Capture A · 05/01/2024 14:30"
 *  Anciens noms ISO toujours supportés. */
function stripTimestamp(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  // Nouveau format : Préfixe_YYYY-MM-DD_HHhMMmSS
  const m = base.match(/^(.+?)_(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})m\d{2}$/);
  if (m) {
    const [, prefix, yyyy, mm, dd, hh, min] = m;
    return `${prefix} · ${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }
  // Ancien format ISO : Recording_YYYY-MM-DDTHH-MM-…
  const old = base.match(/^(Recording|Capture[^_]*)_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
  if (old) {
    const [, prefix, yyyy, mm, dd, hh, min] = old;
    return `${prefix} · ${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }
  return base;
}
