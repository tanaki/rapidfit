import type { Tool } from '../types';

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'pan',    icon: '✋', label: 'Déplacer (H)' },
  { id: 'select', icon: '⊙', label: 'Sélection (V)' },
  { id: 'line',   icon: '╱', label: 'Trait (L)' },
  { id: 'angle',  icon: '∠', label: 'Angle (G)' },
];

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

interface Props {
  tool: Tool;
  color: string;
  onTool: (t: Tool) => void;
  onColor: (c: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  tool, color,
  onTool, onColor,
  onUndo, onRedo, onClear, canUndo, canRedo,
}: Props) {
  return (
    <aside className="flex flex-col gap-2 p-2 bg-[#13131f] border-r border-[#22223b] w-14 items-center overflow-y-auto">
      {/* Tool buttons */}
      <div className="flex flex-col gap-1 w-full">
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => onTool(t.id)}
            className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-colors
              ${tool === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-[#22223b] text-slate-300 hover:bg-[#2d2d48]'
              }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-8 border-t border-[#22223b]" />

      {/* Undo / Redo / Clear */}
      <button title="Annuler (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}
        className="w-10 h-10 rounded-lg bg-[#22223b] text-slate-300 hover:bg-[#2d2d48] disabled:opacity-30 text-sm">↩</button>
      <button title="Rétablir (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}
        className="w-10 h-10 rounded-lg bg-[#22223b] text-slate-300 hover:bg-[#2d2d48] disabled:opacity-30 text-sm">↪</button>
      <button title="Effacer le calque actif" onClick={onClear}
        className="w-10 h-10 rounded-lg bg-[#22223b] text-red-400 hover:bg-red-900/30 text-sm">🗑</button>

      <div className="w-8 border-t border-[#22223b]" />

      {/* Palette — 9 couleurs, 3 par ligne */}
      <div className="grid grid-cols-3 gap-[3px]">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => onColor(c)}
            title={c}
            style={{ background: c }}
            className={`w-[14px] h-[14px] rounded-sm transition-transform hover:scale-125 ${
              color === c ? 'ring-2 ring-white scale-125' : ''
            }`}
          />
        ))}
      </div>
    </aside>
  );
}
