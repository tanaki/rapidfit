import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Layer } from '../types';
import type { Discipline } from '../types';
import type { AngleElement } from '../types';
import {
  REFERENCE_ROWS,
  getRange,
  findBestAngleForRow,
  type ReferenceRange,
  type AngleStatus,
} from '../data/referenceAngles';

interface CotesProps {
  discipline: Discipline;
  activeCoteKey: string | null;
  measuredAngles: AngleElement[];
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

function CotesSection({ discipline, activeCoteKey, measuredAngles, onSelectCote }: CotesProps) {
  const { t } = useTranslation();

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
          const isActive = activeCoteKey === row.key;
          const best = (isActive && !row.isCheck && range && measuredAngles.length > 0)
            ? findBestAngleForRow(row.key, discipline, measuredAngles)
            : null;

          return (
            <button
              key={row.key}
              onClick={() => onSelectCote(isActive ? null : row.key)}
              className={`w-full text-left px-3 py-1.5 border-b border-[#1a1a2e] transition-colors
                ${isActive ? 'bg-yellow-500/10' : 'hover:bg-[#22223b]'}`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                {/* Left: dot indicator + label */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors
                    ${isActive ? 'bg-yellow-400' : 'bg-[#3d3d5c]'}`}
                  />
                  <span className="text-[11px] text-slate-300 truncate leading-tight">
                    {t(`guide.${row.key}`)}
                  </span>
                </div>

                {/* Right: range or check label */}
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

              {/* Measured value badge — shown when there's a matched angle */}
              {best && (
                <div className={`mt-1 ml-3 inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] font-mono font-semibold ${STATUS_BG[best.status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[best.status]}`} />
                  {Math.round(best.angle)}°
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LayerPanel({
  layers, activeLayerId,
  onSelect, onAdd, onDelete, onToggleVisible, onToggleLock,
  onRename, onOpacity, onMoveUp, onMoveDown,
  cotesProps,
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
