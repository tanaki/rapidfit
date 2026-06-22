import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Layer } from '../types';
import type { Discipline } from '../types';
import type { AngleElement } from '../types';
import {
  REFERENCE_ROWS,
  getRange,
  getStatus,
  type ReferenceRange,
  type AngleStatus,
} from '../data/referenceAngles';

interface CotesProps {
  discipline: Discipline;
  layers: Layer[];
  activeLayerId: string;
  onSelectCote: (key: string | null) => void;
}

interface Props {
  layers: Layer[];
  activeLayerId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onOpacity: (id: string, opacity: number) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  cotesProps?: CotesProps;
  currentTime?: number;
  onSetCueTime?: (id: string, time: number | undefined) => void;
  onSeekToCue?: (t: number) => void;
}

const STATUS_BG: Record<AngleStatus, string> = {
  ok:    'bg-green-500/20 text-green-300 border-green-500/40',
  warn:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  error: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const STATUS_DOT: Record<AngleStatus, string> = {
  ok:    'bg-green-400',
  warn:  'bg-yellow-400',
  error: 'bg-red-500',
};

function formatRange(range: ReferenceRange): string {
  if (range.approx && range.max - range.min <= 10) {
    return `~${Math.round((range.min + range.max) / 2)}°`;
  }
  return `${range.min}–${range.max}°`;
}

// Retourne la meilleure valeur mesurée depuis les éléments d'un calque donné
function getBestAngle(layer: Layer | undefined, range: ReferenceRange | null) {
  if (!layer || !range) return null;
  const angles = layer.elements.filter((e): e is AngleElement => e.type === 'angle');
  if (!angles.length) return null;
  const center = (range.min + range.max) / 2;
  const best = angles.reduce((a, b) =>
    Math.abs(a.angle - center) <= Math.abs(b.angle - center) ? a : b
  );
  return { angle: best.angle, color: best.color, status: getStatus(best.angle, range) };
}

function CotesSection({ discipline, layers, activeLayerId, onSelectCote }: CotesProps) {
  const { t } = useTranslation();
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const activeCoteKey = activeLayer?.coteKey ?? null;

  return (
    <div className="border-b border-[#22223b] overflow-y-auto" style={{ maxHeight: '55%' }}>
      <div className="px-3 py-2 border-b border-[#22223b] shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-yellow-400">
          {t('guide.title')}
        </span>
        <span className="ml-2 text-[10px] text-slate-600">
          {t(`session.discipline_${discipline}`)}
        </span>
      </div>

      <div className="flex flex-col">
        {REFERENCE_ROWS.map(row => {
          const range = getRange(row, discipline);
          // Calque lié à cette cote (n'importe quel calque, pas juste l'actif)
          const linkedLayer = layers.find(l => l.coteKey === row.key);
          const measured = !row.isCheck && range ? getBestAngle(linkedLayer, range) : null;
          // Mise en surbrillance : le calque actif est lié à cette cote
          const isActive = activeCoteKey === row.key;

          return (
            <button
              key={row.key}
              onClick={() => onSelectCote(row.key)}
              className={`w-full text-left px-3 py-1.5 border-b border-[#1a1a2e] transition-colors
                ${isActive ? 'bg-yellow-500/10' : 'hover:bg-[#22223b]'}`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                {/* Indicateur + label */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors
                    ${isActive ? 'bg-yellow-400' : linkedLayer ? 'bg-indigo-400' : 'bg-[#3d3d5c]'}`}
                  />
                  <span className="text-[11px] text-slate-300 truncate leading-tight">
                    {t(`guide.${row.key}`)}
                  </span>
                </div>

                {/* Plage de référence */}
                <div className="shrink-0 flex items-center gap-1">
                  {row.isCheck ? (
                    <span className="text-[9px] text-slate-600 italic">{t('guide.checkReminder')}</span>
                  ) : range ? (
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                      {formatRange(range)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700">—</span>
                  )}
                </div>
              </div>

              {/* Badge valeur mesurée — toujours visible si un calque est lié */}
              {measured && (
                <div className={`mt-1 ml-3 inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] font-mono font-semibold ${STATUS_BG[measured.status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[measured.status]}`} />
                  {Math.round(measured.angle)}°
                  {linkedLayer && !isActive && (
                    <span className="text-[9px] opacity-60 ml-0.5 font-normal truncate max-w-[50px]">
                      {linkedLayer.name}
                    </span>
                  )}
                </div>
              )}

              {/* Calque lié mais sans angle : petit hint */}
              {linkedLayer && !measured && !row.isCheck && range && (
                <div className="mt-1 ml-3 text-[9px] text-slate-600 italic">
                  {linkedLayer.name} — {t('guide.noAngle')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtCue(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function LayerPanel({
  layers, activeLayerId,
  onSelect, onAdd, onDelete, onToggleVisible, onToggleLock,
  onRename, onOpacity, onMoveUp, onMoveDown,
  cotesProps, currentTime, onSetCueTime, onSeekToCue,
}: Props) {
  const { t } = useTranslation();
  const renameRef = useRef<string | null>(null);

  const reversed = [...layers].reverse();

  return (
    <aside className="flex flex-col bg-[#13131f] border-l border-[#22223b] w-56 min-w-[200px] overflow-hidden">

      {cotesProps && <CotesSection {...cotesProps} />}

      <div className="flex items-center justify-between px-3 py-2 border-b border-[#22223b] shrink-0">
        <span className="text-sm font-semibold text-slate-300">{t('layers.title')}</span>
        <button
          onClick={onAdd}
          title={t('layers.newLayer')}
          className="w-6 h-6 rounded bg-indigo-600 text-white text-lg leading-none flex items-center justify-center hover:bg-indigo-500"
        >+</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {reversed.map(layer => {
          const isActive = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              className={`group flex flex-col px-2 py-1.5 border-b border-[#22223b] cursor-pointer transition-colors
                ${isActive ? 'bg-indigo-900/40' : 'hover:bg-[#22223b]'}`}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); onToggleVisible(layer.id); }}
                  title={layer.visible ? t('layers.hide') : t('layers.show')}
                  className="text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d5c]"
                >
                  {layer.visible ? '👁' : '🙈'}
                </button>

                <button
                  onClick={e => { e.stopPropagation(); onToggleLock(layer.id); }}
                  title={layer.locked ? t('layers.unlock') : t('layers.lock')}
                  className="text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d5c]"
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>

                <input
                  defaultValue={layer.name}
                  key={layer.name}
                  onFocus={() => { renameRef.current = layer.name; }}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val && val !== renameRef.current) onRename(layer.id, val);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-transparent text-xs text-slate-300 focus:outline-none focus:bg-[#22223b] rounded px-1"
                />

                <button
                  onClick={e => { e.stopPropagation(); onMoveUp(layer.id); }}
                  title={t('layers.moveUp')}
                  className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400"
                >▲</button>
                <button
                  onClick={e => { e.stopPropagation(); onMoveDown(layer.id); }}
                  title={t('layers.moveDown')}
                  className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400"
                >▼</button>

                {layers.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(layer.id); }}
                    title={t('layers.delete')}
                    className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-900/40 text-red-400"
                  >✕</button>
                )}
              </div>

              {/* Badge cote liée */}
              {layer.coteKey && (
                <div className="mt-0.5 ml-10 flex items-center gap-1">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded px-1.5 py-px truncate max-w-[120px]">
                    {t(`guide.${layer.coteKey}`)}
                  </span>
                </div>
              )}

              {/* Cue point */}
              {(layer.cueTime !== undefined || onSetCueTime) && (
                <div className="mt-0.5 ml-10 flex items-center gap-1">
                  {layer.cueTime !== undefined && (
                    <button
                      onClick={e => { e.stopPropagation(); onSeekToCue?.(layer.cueTime!); }}
                      title={t('layers.seekToCue')}
                      className="text-[9px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded px-1.5 py-px hover:bg-amber-500/30 transition-colors"
                    >
                      ◆ {fmtCue(layer.cueTime)}
                    </button>
                  )}
                  {onSetCueTime && currentTime !== undefined && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSetCueTime(layer.id, layer.cueTime !== undefined ? undefined : currentTime);
                      }}
                      title={layer.cueTime !== undefined ? t('layers.removeCue') : t('layers.setCue')}
                      className="text-[9px] w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-500 hover:text-amber-300 transition-colors"
                    >
                      {layer.cueTime !== undefined ? '✕' : '📍'}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={0} max={100} value={layer.opacity}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onOpacity(layer.id, Number(e.target.value))}
                  className="flex-1 h-1 accent-indigo-500"
                  title={`${t('layers.opacity')}: ${layer.opacity}%`}
                />
                <span className="text-[10px] text-slate-500 w-7 text-right">{layer.opacity}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
