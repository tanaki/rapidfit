import { useTranslation } from 'react-i18next';
import type { TrackingMode } from '../hooks/useTracking';

interface Props {
  mode: TrackingMode;
}

export function TrackingOverlay({ mode }: Props) {
  const { t } = useTranslation();
  if (mode === 'off') return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border"
          style={{ backgroundColor: 'rgba(20,20,40,0.80)', borderColor: 'rgba(252,165,165,0.25)', color: 'white' }}
        >
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <span>{t('tracking.active')}</span>
        </div>
      </div>
    </div>
  );
}
