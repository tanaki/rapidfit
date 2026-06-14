import { useTranslation } from 'react-i18next';
import type { TrackingMode } from '../hooks/useTracking';

interface Props {
  mode:   TrackingMode;
  onStop: () => void;
}

export function TrackingOverlay({ mode, onStop }: Props) {
  const { t } = useTranslation();
  if (mode === 'off') return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border"
          style={{ backgroundColor: 'rgba(20,20,40,0.80)', borderColor: 'rgba(252,165,165,0.25)', color: 'white' }}
        >
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <span>{t('tracking.active')}</span>
          <button
            className="ml-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
            style={{ backgroundColor: 'rgba(239,68,68,0.55)', color: 'rgba(255,200,200,1)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.55)')}
            onClick={e => { e.stopPropagation(); onStop(); }}
          >
            {t('tracking.stop')}
          </button>
        </div>
      </div>
    </div>
  );
}
