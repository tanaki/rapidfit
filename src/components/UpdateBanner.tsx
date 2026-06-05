import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type UpdateState = 'idle' | 'available-mac' | 'downloading' | 'ready' | 'error';

interface ElectronAPI {
  onUpdateAvailable:  (cb: (info: { version: string; isMac?: boolean }) => void) => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
  onUpdateError:      (cb: (message: string) => void) => void;
  installUpdate:      () => void;
  openReleasePage:    () => void;
}

export function UpdateBanner() {
  const { t } = useTranslation();
  const [state, setState]     = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    if (!api) return;

    api.onUpdateAvailable((info) => {
      setVersion(info.version);
      setState(info.isMac ? 'available-mac' : 'downloading');
    });
    api.onUpdateDownloaded((info) => { setVersion(info.version); setState('ready'); });
    api.onUpdateError((msg)       => { setErrorMsg(msg); setState('error'); });
  }, []);

  const api = () => (window as unknown as { electronAPI: ElectronAPI }).electronAPI;

  if (state === 'idle') return null;

  // ── Erreur ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="fixed bottom-6 right-6 z-[2000] flex items-start gap-3 bg-red-900/90 border border-red-700 text-white text-xs rounded-xl px-4 py-3 shadow-2xl max-w-sm backdrop-blur-sm">
        <span className="text-base leading-none mt-px">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-0.5">Erreur de mise à jour</p>
          <p className="text-red-300 break-words">{errorMsg}</p>
        </div>
        <button onClick={() => setState('idle')} className="text-red-400 hover:text-white shrink-0 text-base leading-none">✕</button>
      </div>
    );
  }

  // ── Mac : téléchargement manuel ───────────────────────────────────────────
  if (state === 'available-mac') {
    return (
      <button
        onClick={() => api().openReleasePage()}
        className="fixed bottom-6 right-6 z-[2000] flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs rounded-xl px-4 py-3 shadow-2xl transition-all duration-150 cursor-pointer group"
      >
        <span className="text-base leading-none">↓</span>
        <div className="text-left">
          <p className="font-semibold">{t('update.available')}</p>
          <p className="text-indigo-200 text-[10px]">v{version} — {t('update.clickToDownload')}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); setState('idle'); }} className="text-indigo-300 hover:text-white ml-1 leading-none">✕</button>
      </button>
    );
  }

  // ── Téléchargement en cours (Windows) ────────────────────────────────────
  if (state === 'downloading') {
    return (
      <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-3 bg-[#1a1a2e]/95 border border-[#3d3d5c] text-slate-300 text-xs rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin shrink-0" />
        <span>{t('update.downloading', { version })}</span>
      </div>
    );
  }

  // ── Prête à installer (Windows) ───────────────────────────────────────────
  return (
    <button
      onClick={() => api().installUpdate()}
      className="fixed bottom-6 right-6 z-[2000] flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs rounded-xl px-4 py-3 shadow-2xl transition-all duration-150 cursor-pointer group"
    >
      <span className="text-base leading-none group-hover:rotate-180 transition-transform duration-300">↻</span>
      <div className="text-left">
        <p className="font-semibold">{t('update.ready')}</p>
        <p className="text-indigo-200 text-[10px]">v{version} — {t('update.clickToRestart')}</p>
      </div>
    </button>
  );
}
