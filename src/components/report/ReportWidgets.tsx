import { useState } from 'react';
import type { Capture } from '../../types';

// ── Accordion ─────────────────────────────────────────────────────────────────

export function Accordion({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#22223b] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a2e] hover:bg-[#22223b] transition-colors text-left">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{title}</span>
        <span className={`text-slate-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 py-4 space-y-4 bg-[#13131f]">{children}</div>}
    </div>
  );
}

// ── RadioGroup ────────────────────────────────────────────────────────────────

export function RadioGroup<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            value === o.value
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-[#22223b] border-[#3d3d5c] text-slate-300 hover:bg-[#2d2d48]'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── CaptureSlot ───────────────────────────────────────────────────────────────

export function CaptureSlot({ label, selected, all, onToggle, onMoveAll }: {
  label: string;
  selected: string[];
  all: Capture[];
  onToggle: (id: string, slot: 'before' | 'after') => void;
  onMoveAll: (slot: 'before' | 'after') => void;
}) {
  const slot = label === 'Avant' ? 'before' : 'after';
  const selectedCaps = all.filter(c => selected.includes(c.id));
  const available    = all.filter(c => !selected.includes(c.id));

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
        <button onClick={() => onMoveAll(slot)}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          Tout mettre ici
        </button>
      </div>
      <div className="min-h-[80px] bg-[#0d0d14] rounded-lg border border-[#22223b] p-2 flex flex-wrap gap-2 mb-2">
        {selectedCaps.length === 0 ? (
          <span className="text-[10px] text-slate-700 m-auto">{label}</span>
        ) : selectedCaps.map(cap => (
          <button key={cap.id} onClick={() => onToggle(cap.id, slot)}
            title="Retirer"
            className="relative rounded overflow-hidden border-2 border-indigo-500 w-24 aspect-video">
            <img src={cap.url} alt={cap.name} className="w-full h-full object-cover" />
            {cap.paneLabel && (
              <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-indigo-600/90 text-white px-1 rounded">
                {cap.paneLabel}
              </span>
            )}
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center text-[9px] text-white">✕</span>
          </button>
        ))}
      </div>
      {available.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 mb-1">Cliquer pour ajouter ici :</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map(cap => (
              <button key={cap.id} onClick={() => onToggle(cap.id, slot)}
                className="relative rounded overflow-hidden border border-[#3d3d5c] hover:border-indigo-400 w-20 aspect-video opacity-60 hover:opacity-100 transition-all">
                <img src={cap.url} alt={cap.name} className="w-full h-full object-cover" />
                {cap.paneLabel && (
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-indigo-600/90 text-white px-1 rounded">
                    {cap.paneLabel}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG Fallback (affiché si bike-diagram.png absent) ─────────────────────────

export function SvgDiagram() {
  const blue = '#3b82f6';
  const dark = '#1e293b';
  const dash = '5,4';
  const sw   = 7;
  const lw   = 1.2;
  return (
    <svg viewBox="0 0 700 390" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <g stroke={blue} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="135" cy="298" r="78" strokeWidth={sw} />
        <circle cx="475" cy="298" r="78" strokeWidth={sw} />
        <circle cx="135" cy="298" r="5" fill={blue} stroke="none" />
        <circle cx="475" cy="298" r="5" fill={blue} stroke="none" />
        <circle cx="300" cy="298" r="9" fill={blue} stroke="none" />
        <line x1="300" y1="298" x2="135" y2="298" strokeWidth={sw} />
        <line x1="300" y1="298" x2="268" y2="155" strokeWidth={sw} />
        <line x1="268" y1="155" x2="135" y2="298" strokeWidth={sw} />
        <line x1="268" y1="155" x2="440" y2="143" strokeWidth={sw} />
        <line x1="440" y1="143" x2="300" y2="298" strokeWidth={sw} />
        <line x1="440" y1="143" x2="452" y2="173" strokeWidth={sw + 2} />
        <line x1="452" y1="173" x2="475" y2="298" strokeWidth={sw} />
        <line x1="272" y1="162" x2="265" y2="126" strokeWidth={5} />
        <path d="M244,122 Q255,118 265,120 Q275,118 286,122" strokeWidth={6} strokeLinecap="round" />
        <line x1="446" y1="145" x2="474" y2="136" strokeWidth={5} />
        <path d="M466,130 L480,130 Q488,130 488,138 L488,158 Q488,166 480,166" strokeWidth={5} />
        <circle cx="480" cy="136" r="4" fill={blue} stroke="none" />
        <line x1="300" y1="298" x2="322" y2="323" strokeWidth={5} />
        <line x1="300" y1="298" x2="278" y2="273" strokeWidth={5} />
        <line x1="318" y1="326" x2="330" y2="320" strokeWidth={4} />
        <line x1="274" y1="270" x2="264" y2="277" strokeWidth={4} />
      </g>
      <g stroke={dark} fill="none" strokeDasharray={dash} strokeWidth={lw}>
        <line x1="300" y1="298" x2="300" y2="120" />
        <line x1="263" y1="120" x2="300" y2="120" />
        <line x1="300" y1="102" x2="484" y2="102" />
        <line x1="484" y1="120" x2="484" y2="132" />
        <line x1="263" y1="120" x2="480" y2="136" />
        <line x1="263" y1="120" x2="473" y2="130" />
        <line x1="263" y1="120" x2="488" y2="126" />
      </g>
      <g fill={dark} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
        <text x="392" y="98"  fontSize="13">A</text>
        <text x="492" y="130" fontSize="13">D</text>
        <text x="382" y="136" fontSize="13">C</text>
        <text x="374" y="128" fontSize="13">G</text>
        <text x="382" y="116" fontSize="13">P</text>
        <text x="280" y="116" fontSize="13">R</text>
        <text x="315" y="215" fontSize="13">S</text>
        <text x="318" y="333" fontSize="13">M</text>
      </g>
    </svg>
  );
}
