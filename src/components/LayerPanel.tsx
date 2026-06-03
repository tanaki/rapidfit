import { useRef } from 'react';
import type { Layer } from '../types';

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
}

export function LayerPanel({
  layers, activeLayerId,
  onSelect, onAdd, onDelete, onToggleVisible, onToggleLock,
  onRename, onOpacity, onMoveUp, onMoveDown,
}: Props) {
  const renameRef = useRef<string | null>(null);

  // Layers are displayed in reverse order (top layer first) like Photoshop
  const reversed = [...layers].reverse();

  return (
    <aside className="flex flex-col bg-[#13131f] border-l border-[#22223b] w-56 min-w-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#22223b]">
        <span className="text-sm font-semibold text-slate-300">Calques</span>
        <button
          onClick={onAdd}
          title="Nouveau calque"
          className="w-6 h-6 rounded bg-indigo-600 text-white text-lg leading-none flex items-center justify-center hover:bg-indigo-500"
        >+</button>
      </div>

      {/* Layer list */}
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
                {/* Visibility */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleVisible(layer.id); }}
                  title={layer.visible ? 'Masquer' : 'Afficher'}
                  className="text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d5c]"
                >
                  {layer.visible ? '👁' : '🙈'}
                </button>

                {/* Lock */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleLock(layer.id); }}
                  title={layer.locked ? 'Déverrouiller' : 'Verrouiller'}
                  className="text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-[#3d3d5c]"
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>

                {/* Name */}
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

                {/* Move up/down */}
                <button
                  onClick={e => { e.stopPropagation(); onMoveUp(layer.id); }}
                  title="Monter"
                  className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400"
                >▲</button>
                <button
                  onClick={e => { e.stopPropagation(); onMoveDown(layer.id); }}
                  title="Descendre"
                  className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-[#3d3d5c] text-slate-400"
                >▼</button>

                {/* Delete */}
                {layers.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(layer.id); }}
                    title="Supprimer"
                    className="text-xs w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-900/40 text-red-400"
                  >✕</button>
                )}
              </div>

              {/* Opacity slider */}
              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={0} max={100} value={layer.opacity}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onOpacity(layer.id, Number(e.target.value))}
                  className="flex-1 h-1 accent-indigo-500"
                  title={`Opacité: ${layer.opacity}%`}
                />
                <span className="text-[10px] text-slate-500 w-7 text-right">{layer.opacity}%</span>
              </div>

              {/* Element count badge */}
              <div className="pl-6 mt-0.5">
                <span className="text-[10px] text-slate-600">
                  {layer.elements.length} élément{layer.elements.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
