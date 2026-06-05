import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';

interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const api = (window as unknown as {
    electronAPI?: {
      onUpdateAvailable: (cb: (i: { version: string }) => void) => void;
      onUpdateDownloaded: (cb: (i: { version: string }) => void) => void;
      onUpdateNotAvailable: (cb: (i: { version: string }) => void) => void;
      onUpdateError: (cb: (msg: string) => void) => void;
      installUpdate: () => void;
      checkForUpdates: () => void;
    };
  }).electronAPI;

  useEffect(() => {
    mountedRef.current = true;
    if (!api) return;
    api.onUpdateAvailable(info => {
      if (!mountedRef.current) return;
      setUpdateVersion(info.version);
      setUpdateStatus('downloading');
    });
    api.onUpdateDownloaded(info => {
      if (!mountedRef.current) return;
      setUpdateVersion(info.version);
      setUpdateStatus('ready');
    });
    api.onUpdateNotAvailable(() => {
      if (!mountedRef.current) return;
      setUpdateStatus('up-to-date');
    });
    api.onUpdateError(msg => {
      if (!mountedRef.current) return;
      setUpdateError(msg);
      setUpdateStatus('error');
    });
    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line

  const handleCheck = () => {
    if (!api) return;
    setUpdateStatus('checking');
    setUpdateError(null);
    setUpdateVersion(null);
    api.checkForUpdates();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl p-6 w-[720px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{t('help.title')}</h2>
            <span className="text-[10px] text-slate-500 font-mono select-text">v{__APP_VERSION__}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* ── Outils ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.tools')}</h3>
          <div className="flex flex-col gap-1.5">
            {[
              ['H', '✋', t('help.tool_pan'),    t('help.tool_pan_desc')],
              ['V', '⊙', t('help.tool_select'), t('help.tool_select_desc')],
              ['L', '╱', t('help.tool_line'),   t('help.tool_line_desc')],
              ['G', '∠', t('help.tool_angle'),  t('help.tool_angle_desc')],
            ].map(([key, icon, name, desc]) => (
              <div key={key} className="flex items-start gap-3 bg-[#1a1a2e] rounded-lg px-3 py-2">
                <kbd className="shrink-0 w-6 h-6 bg-[#3d3d5c] rounded text-xs font-mono text-slate-300 flex items-center justify-center">{key}</kbd>
                <span className="text-base w-5 shrink-0 leading-6">{icon}</span>
                <div>
                  <span className="text-sm font-medium text-slate-200">{name}</span>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Raccourcis clavier + Trackpad ── */}
        <div className="grid grid-cols-2 gap-x-6 mb-5">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.shortcuts')}</h3>
            <div className="flex flex-col gap-1">
              {[
                ['H',                           t('help.shortcut_pan')],
                ['V',                           t('help.shortcut_select')],
                ['L',                           t('help.shortcut_line')],
                ['G',                           t('help.shortcut_angle')],
                [t('help.shortcut_space_key'),  t('help.shortcut_space')],
                [t('help.shortcut_undo_key'),   t('help.shortcut_undo')],
                [t('help.shortcut_redo_key'),   t('help.shortcut_redo')],
                [t('help.shortcut_delete_key'), t('help.shortcut_delete')],
                [t('help.shortcut_enter_key'),  t('help.shortcut_enter')],
                [t('help.shortcut_arrows_key'), t('help.shortcut_arrows')],
                [t('help.shortcut_shift_key'),  t('help.shortcut_shift')],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 h-6">
                  <kbd className="shrink-0 bg-[#3d3d5c] rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300 whitespace-nowrap leading-none">{key}</kbd>
                  <span className="text-slate-400 text-xs truncate">{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.mouse')}</h3>
            <div className="flex flex-col gap-1">
              {[
                [t('help.mouse_zoom_key'),         t('help.mouse_zoom')],
                [t('help.mouse_pinch_key'),        t('help.mouse_pinch')],
                [t('help.mouse_pan_middle_key'),   t('help.mouse_pan_middle')],
                [t('help.mouse_pan_space_key'),    t('help.mouse_pan_space')],
                [t('help.mouse_wheel_key'),        t('help.mouse_wheel')],
                [t('help.mouse_seekbar_key'),      t('help.mouse_seekbar')],
                [t('help.mouse_seekbar_drag_key'), t('help.mouse_seekbar_drag')],
                [t('help.mouse_handle_key'),       t('help.mouse_handle')],
                [t('help.mouse_element_key'),      t('help.mouse_element')],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 h-6">
                  <span className="shrink-0 text-[10px] font-mono bg-[#22223b] text-slate-400 rounded px-1.5 py-0.5 whitespace-nowrap leading-none">{key}</span>
                  <span className="text-slate-400 text-xs truncate">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Captures & vidéos ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.media')}</h3>
          <div className="flex flex-col gap-1.5">
            {[
              [t('help.media_capture'),     t('help.media_capture_desc')],
              [t('help.media_panel'),       t('help.media_panel_desc')],
              [t('help.media_view'),        t('help.media_view_desc')],
              [t('help.media_rename'),      t('help.media_rename_desc')],
              [t('help.media_import'),      t('help.media_import_desc')],
              [t('help.media_source'),      t('help.media_source_desc')],
            ].map(([key, label]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="shrink-0 text-[10px] font-mono bg-[#22223b] text-slate-300 rounded px-1.5 py-0.5 whitespace-nowrap leading-tight mt-px">{key}</span>
                <span className="text-slate-400 text-xs leading-relaxed">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Guide des cotes ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.cotes')}</h3>
          <div className="flex flex-col gap-1 text-xs text-slate-400 leading-relaxed">
            <p>• {t('help.cotes_desc1')}</p>
            <p>• {t('help.cotes_desc2')}</p>
            <p>• {t('help.cotes_desc3')}</p>
          </div>
        </section>

        {/* ── Split ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.split')}</h3>
          <div className="flex flex-col gap-1 text-xs text-slate-400 leading-relaxed">
            <p>• {t('help.split_desc1')}</p>
            <p>• {t('help.split_desc2')}</p>
            <p>• {t('help.split_desc3')}</p>
          </div>
        </section>

        {/* ── Calques ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.layers')}</h3>
          <div className="flex flex-col gap-1 text-xs text-slate-400 leading-relaxed">
            <p>• <span className="text-slate-300 font-mono">{t('help.layers_desc1_create')}</span> {t('help.layers_desc1_text').split(' · ')[0]} · <span className="text-slate-300 font-mono">{t('help.layers_desc1_hide')}</span> {t('help.layers_desc1_text').split(' · ')[1]} · <span className="text-slate-300 font-mono">{t('help.layers_desc1_lock')}</span> {t('help.layers_desc1_text').split(' · ')[2]} · <span className="text-slate-300 font-mono">{t('help.layers_desc1_reorder')}</span> {t('help.layers_desc1_text').split(' · ')[3]}</p>
            <p>• {t('help.layers_desc2')}</p>
          </div>
        </section>

        {/* ── Compte rendu ── */}
        <section className="mb-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">{t('help.report')}</h3>
          <div className="flex flex-col gap-1 text-xs text-slate-400 leading-relaxed">
            <p>• {t('help.report_desc1')}</p>
            <p>• {t('help.report_desc2')}</p>
            <p>• {t('help.report_desc3')}</p>
          </div>
        </section>

        {/* ── Mises à jour ── */}
        {api && (
          <section className="mb-5 border border-[#22223b] rounded-lg p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">Mises à jour</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCheck}
                disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                className="shrink-0 px-3 py-1.5 bg-[#22223b] hover:bg-[#2d2d48] disabled:opacity-40 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                {updateStatus === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour'}
              </button>

              <span className="text-xs">
                {updateStatus === 'idle' && (
                  <span className="text-slate-500">Version actuelle : <span className="font-mono text-slate-400">v{__APP_VERSION__}</span></span>
                )}
                {updateStatus === 'checking' && (
                  <span className="text-slate-400">Connexion à GitHub…</span>
                )}
                {updateStatus === 'up-to-date' && (
                  <span className="text-green-400">✓ Vous avez la dernière version</span>
                )}
                {updateStatus === 'downloading' && (
                  <span className="text-indigo-300">⬇ Téléchargement de la v{updateVersion}…</span>
                )}
                {updateStatus === 'ready' && (
                  <span className="text-yellow-300">✓ v{updateVersion} prête — redémarrage requis</span>
                )}
                {updateStatus === 'error' && (
                  <span className="text-red-400" title={updateError ?? ''}>⚠ Erreur lors de la vérification</span>
                )}
              </span>

              {updateStatus === 'ready' && (
                <button
                  onClick={() => api.installUpdate()}
                  className="shrink-0 ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Installer et redémarrer
                </button>
              )}
            </div>
          </section>
        )}

        <button onClick={onClose} className="mt-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">
          {t('help.close')}
        </button>
      </div>
    </div>
  );
}
