import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type UpdateState = 'idle' | 'available' | 'downloaded' | 'error';

export function UpdateBanner() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: {
      onUpdateAvailable: (cb: (info: { version: string }) => void) => void;
      onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
      onUpdateError: (cb: (message: string) => void) => void;
      installUpdate: () => void;
    } }).electronAPI;

    if (!api) return;

    api.onUpdateAvailable((info) => { setVersion(info.version); setState('available'); });
    api.onUpdateDownloaded((info) => { setVersion(info.version); setState('downloaded'); });
    api.onUpdateError((msg) => { setErrorMsg(msg); setState('error'); });
  }, []);

  if (state === 'idle') return null;

  if (state === 'error') {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-red-900/80 border-b border-red-700 text-white text-xs shrink-0">
        <span>⚠ Mise à jour : {errorMsg}</span>
        <button onClick={() => setState('idle')} className="ml-4 text-red-300 hover:text-white">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-indigo-700 border-b border-indigo-500 text-white text-xs shrink-0">
      <span>
        {state === 'available'
          ? t('update.available', { version })
          : t('update.downloaded', { version })}
      </span>
      {state === 'downloaded' && (
        <button
          onClick={() => (window as unknown as { electronAPI: { installUpdate: () => void } }).electronAPI.installUpdate()}
          className="ml-4 px-3 py-1 bg-white text-indigo-700 font-semibold rounded hover:bg-indigo-100 transition-colors"
        >
          {t('update.install')}
        </button>
      )}
    </div>
  );
}
