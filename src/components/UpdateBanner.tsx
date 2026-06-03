import { useEffect, useState } from 'react';

type UpdateState = 'idle' | 'available' | 'downloaded';

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: {
      onUpdateAvailable: (cb: (info: { version: string }) => void) => void;
      onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
      installUpdate: () => void;
    } }).electronAPI;

    if (!api) return; // mode web — pas d'updater

    api.onUpdateAvailable((info) => {
      setVersion(info.version);
      setState('available');
    });

    api.onUpdateDownloaded((info) => {
      setVersion(info.version);
      setState('downloaded');
    });
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-indigo-700 border-b border-indigo-500 text-white text-xs shrink-0">
      <span>
        {state === 'available'
          ? `Mise à jour v${version} disponible — téléchargement en cours…`
          : `Mise à jour v${version} prête à installer.`}
      </span>
      {state === 'downloaded' && (
        <button
          onClick={() => (window as unknown as { electronAPI: { installUpdate: () => void } }).electronAPI.installUpdate()}
          className="ml-4 px-3 py-1 bg-white text-indigo-700 font-semibold rounded hover:bg-indigo-100 transition-colors"
        >
          Installer et relancer
        </button>
      )}
    </div>
  );
}
