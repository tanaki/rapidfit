import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tool } from '../types';

export const COLORS = [
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
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  tool, color,
  onTool, onColor,
  onUndo, onRedo, canUndo, canRedo,
}: Props) {
  const { t } = useTranslation();

  const TOOLS: { id: Tool; icon: ReactNode; label: string }[] = [
    { id: 'pan',    icon: '✋', label: t('toolbar.pan') },
    { id: 'select', icon: '⊙', label: t('toolbar.select') },
    { id: 'line',   icon: '╱', label: t('toolbar.line') },
    { id: 'angle',  icon: '∠', label: t('toolbar.angle') },
    {
      id: 'h-angle',
      label: t('toolbar.h_angle', 'Angle / Horiz.'),
      icon: <span className="flex items-end leading-none gap-[1px]">
        <span className="text-lg">∠</span>
        <span className="text-[9px] font-bold mb-[2px]">H</span>
      </span>,
    },
    {
      id: 'v-angle',
      label: t('toolbar.v_angle', 'Angle / Vert.'),
      icon: <span className="flex items-end leading-none gap-[1px]">
        <span className="text-lg">∠</span>
        <span className="text-[9px] font-bold mb-[2px]">V</span>
      </span>,
    },
    {
      id: 'skeleton',
      label: t('toolbar.skeleton', 'Squelette cycliste'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {/* head */}
          <circle cx="12" cy="2.8" r="1.8" fill="currentColor" stroke="none" />
          {/* torso: shoulder → hip */}
          <line x1="10.5" y1="4.5" x2="8.5" y2="9.5" />
          {/* upper arm: shoulder → elbow */}
          <line x1="10.5" y1="5.5" x2="15" y2="7.5" />
          {/* forearm: elbow → wrist */}
          <line x1="15" y1="7.5" x2="17.5" y2="10" />
          {/* thigh: hip → knee */}
          <line x1="8.5" y1="9.5" x2="7.5" y2="14.5" />
          {/* shin: knee → ankle */}
          <line x1="7.5" y1="14.5" x2="7" y2="18.5" />
          {/* foot: ankle → toes */}
          <line x1="7" y1="18.5" x2="11" y2="18.5" />
          {/* head segment: shoulder → head (dashed) */}
          <line x1="10.5" y1="4.5" x2="12" y2="4.5" strokeDasharray="1.5 1" strokeWidth="1.2" opacity="0.6" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="flex flex-col gap-2 p-2 bg-[#13131f] border-r border-[#22223b] w-14 items-center overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-1 w-full">
        {TOOLS.map(toolItem => (
          <button
            key={toolItem.id}
            title={toolItem.label}
            onClick={() => onTool(toolItem.id)}
            className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-colors
              ${tool === toolItem.id
                ? 'bg-indigo-600 text-white'
                : 'bg-[#22223b] text-slate-300 hover:bg-[#2d2d48]'
              }`}
          >
            {toolItem.icon}
          </button>
        ))}
      </div>

      <div className="w-8 border-t border-[#22223b]" />

      <button title={t('toolbar.undo')} onClick={onUndo} disabled={!canUndo}
        className="w-10 h-10 rounded-lg bg-[#22223b] text-slate-300 hover:bg-[#2d2d48] disabled:opacity-30 text-sm">↩</button>
      <button title={t('toolbar.redo')} onClick={onRedo} disabled={!canRedo}
        className="w-10 h-10 rounded-lg bg-[#22223b] text-slate-300 hover:bg-[#2d2d48] disabled:opacity-30 text-sm">↪</button>

      <div className="w-8 border-t border-[#22223b]" />

      <div className="grid grid-cols-3 gap-[2px] w-full px-1">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => onColor(c)}
            title={c}
            style={{ background: c }}
            className={`w-[10px] h-[10px] rounded-sm justify-self-center transition-transform hover:scale-125 ${
              color === c ? 'ring-1 ring-white scale-125' : ''
            }`}
          />
        ))}
      </div>
    </aside>
  );
}
