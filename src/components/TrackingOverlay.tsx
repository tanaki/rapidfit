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
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-colors"
          style={{ backgroundColor: 'rgba(239,68,68,0.75)', borderColor: 'rgba(252,165,165,0.3)', color: 'white' }}
          onClick={e => { e.stopPropagation(); onStop(); }}
        >
          <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
          {t('tracking.stop')}
        </button>
      </div>
    </div>
  );
}
