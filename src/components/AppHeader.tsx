import { useTranslation } from 'react-i18next';
import type { Client, Session } from '../types';
import { SessionSelector } from './SessionSelector';

interface SessionSelectorProps {
  clients: Client[];
  sessionsByClient: Record<string, Session[]>;
  activeClient: Client | null;
  activeSession: Session | null;
  onSelect: (client: Client, session: Session) => void;
  onNewSession: () => void;
  onEditClient: (updates: Partial<Client> & { id: string }) => Promise<void>;
  onDeleteSession: (session: Session) => Promise<void>;
  onDeleteClient: (client: Client) => Promise<void>;
}

interface Props {
  // Session selector
  sessionProps: SessionSelectorProps;

  // Active context
  splitMode: boolean;
  activePaneIndex: 0 | 1;
  activeLayerName: string;

  // Camera
  isLiveMode: boolean;
  cameraIsActive: boolean;
  cameraError: string | null;

  // Overlays
  showGuide: boolean;
  onToggleGuide: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;

  // Actions
  onToggleSplit: () => void;
  onOpenReport: () => void;
  onOpenPainGuide: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export function AppHeader({
  sessionProps,
  splitMode, activePaneIndex, activeLayerName,
  isLiveMode, cameraIsActive, cameraError,
  showGuide, onToggleGuide,
  showGrid, onToggleGrid,
  gridSize, onGridSizeChange,
  onToggleSplit, onOpenReport, onOpenPainGuide, onOpenSettings, onOpenHelp,
}: Props) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[#13131f] border-b border-[#22223b] shrink-0 h-11">
      {/* ── Left: logo + session + layer ── */}
      <div className="flex items-center gap-2">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="RapidFit" className="h-6 w-6" />
        <span className="text-sm font-bold tracking-wide text-white">RapidFit</span>
        <div className="w-px h-4 bg-[#3d3d5c] mx-1" />
        <SessionSelector {...sessionProps} />
        <div className="w-px h-4 bg-[#3d3d5c] mx-1" />
        <span className="text-xs text-slate-400 bg-[#22223b] px-2 py-0.5 rounded-md border border-[#3d3d5c]">
          {splitMode && (
            <span className="text-indigo-400 font-medium mr-1">
              {t('header.panel')} {activePaneIndex === 0 ? 'A' : 'B'} —
            </span>
          )}
          {t('header.layer')} : <span className="text-slate-200 font-medium">{activeLayerName}</span>
        </span>
      </div>

      {/* ── Centre: camera error ── */}
      {cameraError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-1 rounded-lg">
          ⚠ {cameraError}
        </div>
      )}

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-2">
        {isLiveMode && !cameraIsActive && !cameraError && (
          <span className="text-xs text-slate-500">{t('header.cameraWaiting')}</span>
        )}

        {/* Guides */}
        <button
          onClick={onToggleGuide}
          title={t('header.guidesTitle')}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
            showGuide ? 'bg-yellow-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
          }`}
        >
          {t('header.guides')}
        </button>

        {/* Grid */}
        <button
          onClick={onToggleGrid}
          title={t('header.gridTitle')}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
            showGrid ? 'bg-blue-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
          }`}
        >
          {t('header.grid')}
        </button>
        {showGrid && (
          <div className="flex items-center gap-1 bg-[#22223b] rounded-lg px-1.5 py-0.5 border border-[#3d3d5c]">
            <button
              onClick={() => onGridSizeChange(Math.max(10, gridSize - 10))}
              disabled={gridSize <= 10}
              className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold"
            >−</button>
            <span className="text-xs text-slate-300 w-12 text-center tabular-nums">{gridSize} px</span>
            <button
              onClick={() => onGridSizeChange(Math.min(200, gridSize + 10))}
              disabled={gridSize >= 200}
              className="w-5 h-5 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 text-sm font-bold"
            >+</button>
          </div>
        )}

        {/* Split */}
        <button
          onClick={onToggleSplit}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
            splitMode ? 'bg-indigo-600 text-white' : 'bg-[#22223b] hover:bg-[#2d2d48] text-slate-300'
          }`}
        >
          {t('header.split')}
        </button>

        <div className="w-px h-4 bg-[#3d3d5c]" />

        {/* Pain guide */}
        <button
          onClick={onOpenPainGuide}
          title={t('header.painGuideTitle')}
          className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 font-medium transition-colors"
        >
          {t('header.painGuide')}
        </button>

        {/* Report */}
        <button
          onClick={onOpenReport}
          className="text-xs px-3 py-1 bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 font-medium transition-colors"
        >
          {t('header.report')}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title={t('header.settings')}
          className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Help */}
        <button
          onClick={onOpenHelp}
          title={t('header.help')}
          className="w-8 h-7 flex items-center justify-center bg-[#22223b] hover:bg-[#2d2d48] rounded-lg text-slate-300 text-sm"
        >?</button>
      </div>
    </header>
  );
}
