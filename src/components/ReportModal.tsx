import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { Capture, Client, Session, ReportData, CompanySettings } from '../types';
import { DEFAULT_REPORT } from '../types';
import { generatePDF } from '../utils/reportPdf';
import { formatDateFR } from '../utils/formatDate';
import { Accordion, RadioGroup, CaptureSlot, SvgDiagram } from './report/ReportWidgets';

interface Props {
  captures: Capture[];
  client: Client | null;
  session: Session | null;
  company: CompanySettings;
  initialData: ReportData | null;
  onClose: () => void;
  onSave: (data: ReportData) => void | Promise<void>;
  onUpdateClient?: (updates: Partial<Pick<Client, 'weight' | 'height'>>) => Promise<void>;
}

function migrate(raw: Partial<ReportData> & { selectedCaptureIds?: string[] }): ReportData {
  const base = { ...DEFAULT_REPORT, ...raw };
  if (raw.selectedCaptureIds && !raw.capturesBefore?.length && !raw.capturesAfter?.length) {
    base.capturesBefore = raw.selectedCaptureIds;
    base.capturesAfter  = [];
  }
  return base;
}

export function ReportModal({ captures, client, session, company, initialData, onClose, onSave, onUpdateClient }: Props) {
  const { t } = useTranslation();

  const [data, setData]           = useState<ReportData>(() => migrate(initialData ?? DEFAULT_REPORT));
  const [exporting, setExporting] = useState(false);
  const [localWeight, setLocalWeight] = useState(String(client?.weight ?? ''));
  const [localHeight, setLocalHeight] = useState(String(client?.height ?? ''));

  const set = useCallback(<K extends keyof ReportData>(key: K, val: ReportData[K]) =>
    setData(d => ({ ...d, [key]: val })), []);

  const setStr = useCallback((key: keyof ReportData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as ReportData[typeof key]), [set]);

  // ── Sauvegarde : statut visible + garde anti-écrasement ─────────────────────
  // saveState : 'saved' (à jour) · 'dirty' (modifié, pas encore écrit) · 'saving'.
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');

  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Toujours la dernière version des données (pour les flushs hors-render).
  const dataRef = useRef(data);
  dataRef.current = data;

  // Signature de la dernière version RÉELLEMENT persistée. Initialisée sur les
  // données chargées → tant que rien ne change, on ne sauvegarde PAS (empêche
  // d'écraser un rapport existant par des valeurs par défaut au montage).
  const lastSavedRef = useRef<string>(JSON.stringify(data));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const snapshot = JSON.stringify(dataRef.current);
    if (snapshot === lastSavedRef.current) { setSaveState('saved'); return; } // rien de neuf
    setSaveState('saving');
    try {
      await onSaveRef.current(dataRef.current);
      lastSavedRef.current = snapshot;
      setSaveState('saved');
    } catch {
      setSaveState('dirty'); // échec → on garde "modifié"
    }
  }, []);

  // Débounce : marque "modifié" puis planifie l'écriture, uniquement si les
  // données diffèrent réellement du dernier enregistrement.
  useEffect(() => {
    if (JSON.stringify(data) === lastSavedRef.current) return;
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void doSave(); }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, doSave]);

  // Filet anti-perte : flush sur fermeture de fenêtre / arrière-plan / quit /
  // démontage. doSave ne fait rien si rien n'a changé → jamais d'écrasement.
  useEffect(() => {
    const onBeforeUnload = () => { void doSave(); };
    const onVisibility   = () => { if (document.visibilityState === 'hidden') void doSave(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    const api = (window as unknown as { electronAPI?: { onBeforeQuit?: (cb: () => void) => (() => void) | void } }).electronAPI;
    const offQuit = api?.onBeforeQuit?.(() => { void doSave(); });
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      offQuit?.();
      void doSave();
    };
  }, [doSave]);

  const handleCapture = useCallback((id: string, slot: 'before' | 'after') => {
    setData(d => {
      const inBefore = d.capturesBefore.includes(id);
      const inAfter  = d.capturesAfter.includes(id);
      if (slot === 'before') {
        return inBefore
          ? { ...d, capturesBefore: d.capturesBefore.filter(x => x !== id) }
          : { ...d, capturesBefore: [...d.capturesBefore, id], capturesAfter: d.capturesAfter.filter(x => x !== id) };
      } else {
        return inAfter
          ? { ...d, capturesAfter: d.capturesAfter.filter(x => x !== id) }
          : { ...d, capturesAfter: [...d.capturesAfter, id], capturesBefore: d.capturesBefore.filter(x => x !== id) };
      }
    });
  }, []);

  const handleMoveAll = useCallback((slot: 'before' | 'after') => {
    const allIds = captures.map(c => c.id);
    if (slot === 'before') setData(d => ({ ...d, capturesBefore: allIds, capturesAfter: [] }));
    else setData(d => ({ ...d, capturesBefore: [], capturesAfter: allIds }));
  }, [captures]);

  const handleSaveMetrics = useCallback(async () => {
    if (!onUpdateClient) return;
    const w = parseFloat(localWeight);
    const h = parseFloat(localHeight);
    await onUpdateClient({ weight: isNaN(w) ? undefined : w, height: isNaN(h) ? undefined : h });
  }, [onUpdateClient, localWeight, localHeight]);

  const handleClose = useCallback(() => { void doSave(); onClose(); }, [doSave, onClose]);
  useEscapeKey(handleClose);

  const handleExport = async () => {
    setExporting(true);
    void doSave();
    try { await generatePDF(data, captures, client, session, company); }
    finally { setExporting(false); }
  };

  const input      = 'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const smallInput = 'bg-[#22223b] border border-[#3d3d5c] rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const coteInput  = 'w-20 bg-[#22223b] border border-[#3d3d5c] rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500 text-center tabular-nums';

  const discipline = session?.discipline ? t(`session.discipline_${session.discipline}`) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[780px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{t('report.title')}</h2>
            {client && (
              <p className="text-xs text-slate-500 mt-0.5">
                {client.prenom} {client.nom}
                {discipline && <> · {discipline}</>}
                {session?.bikeFitDate && <> · {formatDateFR(session.bikeFitDate)}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Indicateur de sauvegarde — style Drive */}
            <span
              className={`flex items-center gap-1.5 text-xs font-medium select-none ${
                saveState === 'saved' ? 'text-emerald-400'
                : saveState === 'saving' ? 'text-slate-400'
                : 'text-amber-400'
              }`}
              title={
                saveState === 'saved' ? t('report.saved', 'Enregistré')
                : saveState === 'saving' ? t('report.saving', 'Enregistrement…')
                : t('report.dirty', 'Modifications non enregistrées')
              }
            >
              {saveState === 'saved' && <>✓ {t('report.saved', 'Enregistré')}</>}
              {saveState === 'saving' && <><span className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" /> {t('report.saving', 'Enregistrement…')}</>}
              {saveState === 'dirty' && <>● {t('report.dirty', 'Modifié')}</>}
            </span>

            {/* Bouton Enregistrer explicite (secours) */}
            <button
              onClick={() => void doSave()}
              disabled={saveState !== 'dirty'}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-[#22223b] disabled:text-slate-500 disabled:cursor-default"
            >
              {t('report.save', 'Enregistrer')}
            </button>

            <button onClick={handleClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">

          {/* S1 — Informations client */}
          <Accordion title={t('report.clientInfo')}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {[
                [t('report.lastName'),  client?.nom       || '—'],
                [t('report.firstName'), client?.prenom    || '—'],
                [t('report.email'),     client?.email     || '—'],
                [t('report.phone'),     client?.phone     || '—'],
                ['Date de naissance',   formatDateFR(client?.birthDate)],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <span className="text-slate-500 shrink-0 w-32">{l} :</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-4 pt-2 border-t border-[#22223b]">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Poids (kg)</label>
                <input className={`${smallInput} w-24`} value={localWeight} placeholder="—"
                  onChange={e => setLocalWeight(e.target.value)} onBlur={handleSaveMetrics} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Taille (cm)</label>
                <input className={`${smallInput} w-24`} value={localHeight} placeholder="—"
                  onChange={e => setLocalHeight(e.target.value)} onBlur={handleSaveMetrics} />
              </div>
            </div>
          </Accordion>

          {/* S2 — Pratique */}
          <Accordion title={t('report.s2_title')}>
            <div>
              <label className="block text-xs text-slate-400 mb-2">{t('report.s2_level')}</label>
              <RadioGroup value={data.practiceLevel}
                options={(['loisir','sport','competition','pro'] as const).map(v => ({ value: v, label: t(`report.s2_level_${v}`) }))}
                onChange={v => set('practiceLevel', v)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['practiceYears', t('report.s2_years')],
                ['weeklyVolume',  t('report.s2_weekly')],
                ['annualVolume',  t('report.s2_annual')],
              ] as [keyof ReportData, string][]).map(([key, label]) => (
                <div key={String(key)}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <input className={`${smallInput} w-full`} placeholder="0"
                    value={data[key] as string} onChange={setStr(key)} />
                </div>
              ))}
            </div>
          </Accordion>

          {/* S3 — Diagnostic */}
          <Accordion title={t('report.s3_title')}>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('report.s3_motif')}</label>
              <textarea className={`${input} min-h-[60px] resize-y`} value={data.motif} onChange={setStr('motif')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('report.s3_douleurs')}</label>
              <textarea className={`${input} min-h-[60px] resize-y`} value={data.douleurs} onChange={setStr('douleurs')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['veloDepuis',    t('report.s3_veloDepuis')],
                ['veloPrecedent', t('report.s3_veloPrecedent')],
                ['autresSports',  t('report.s3_autresSports')],
              ] as [keyof ReportData, string][]).map(([key, label]) => (
                <div key={String(key)}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <input className={input} value={data[key] as string} onChange={setStr(key)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.s3_anciennesBlessures')}</label>
                <textarea className={`${input} min-h-[60px] resize-y`} value={data.anciennesBlessures} onChange={setStr('anciennesBlessures')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.s3_blessuresRecentes')}</label>
                <textarea className={`${input} min-h-[60px] resize-y`} value={data.blessuresRecentes} onChange={setStr('blessuresRecentes')} />
              </div>
            </div>
          </Accordion>

          {/* S4 — Tests physios */}
          <Accordion title={t('report.s4_title')}>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{t('report.s4_pieds')}</label>
              <RadioGroup value={data.piedAllure}
                options={[{value:'neutre',label:t('report.s4_neutre')},{value:'varus',label:t('report.s4_varus')},{value:'valgus',label:t('report.s4_valgus')}]}
                onChange={v => set('piedAllure', v)} />
              <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data.piedNote} onChange={setStr('piedNote')} />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{t('report.s4_genoux')}</label>
              <RadioGroup value={data.genouAllure}
                options={[{value:'neutre',label:t('report.s4_neutre')},{value:'dedans',label:t('report.s4_dedans')},{value:'dehors',label:t('report.s4_dehors')}]}
                onChange={v => set('genouAllure', v)} />
              <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data.genouNote} onChange={setStr('genouNote')} />
            </div>
            {([
              ['souplesseChaine','s4_souplesse',['bonne','moyenne','limitee'],'souplesseNote'],
              ['squat',          's4_squat',    ['bon','moyen','compensations'],'squatNote'],
              ['fente',          's4_fente',    ['bonne','moyenne','asymetrique'],'fenteNote'],
            ] as [keyof ReportData, string, string[], keyof ReportData][]).map(([key, labelKey, opts, noteKey]) => (
              <div key={String(key)} className="space-y-1">
                <label className="block text-xs text-slate-400">{t(`report.${labelKey}`)}</label>
                <RadioGroup value={data[key] as string}
                  options={opts.map(v => ({ value: v, label: t(`report.s4_${v}`) }))}
                  onChange={v => set(key, v as ReportData[typeof key])} />
                <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data[noteKey] as string} onChange={setStr(noteKey)} />
              </div>
            ))}
          </Accordion>

          {/* S5 — Bilan */}
          <Accordion title={t('report.s5_title')}>
            <textarea className={`${input} min-h-[120px] resize-y`}
              placeholder={t('report.s5_placeholder')} value={data.bilan} onChange={setStr('bilan')} />
          </Accordion>

          {/* S6 — Fiche de cotes */}
          <Accordion title={t('report.s6_title')}>
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('report.s6_materiel')}</h4>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['veloModele',    t('report.s6_veloModele')],
                  ['veloTaille',    t('report.s6_veloTaille')],
                  ['selleMateriel', t('report.s6_selle')],
                  ['pedales',       t('report.s6_pedales')],
                  ['chaussures',    t('report.s6_chaussures')],
                ] as [keyof ReportData, string][]).map(([key, label]) => (
                  <div key={String(key)}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <input className={input} value={data[key] as string} onChange={setStr(key)} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('report.s6_cotes')}</h4>
              <div className="mb-4 bg-white rounded-lg p-3">
                <img
                  src={`${import.meta.env.BASE_URL}bike-diagram.png`}
                  alt="Diagramme de cotes vélo"
                  className="w-full h-auto"
                  onError={e => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const svgFallback = target.nextElementSibling as HTMLElement;
                    if (svgFallback) svgFallback.style.display = 'block';
                  }}
                />
                <div style={{ display: 'none' }}><SvgDiagram /></div>
              </div>
              <div className="flex gap-3">
                {/* Left table: A–M */}
                <table className="flex-1 text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#22223b]">
                      <th className="text-slate-400 font-semibold px-2 py-1 text-left w-8">{t('report.s6_ref')}</th>
                      <th className="text-slate-400 font-semibold px-2 py-1 text-left">{t('report.s6_designation')}</th>
                      <th className="text-slate-400 font-semibold px-2 py-1 text-center w-16">{t('report.s6_valeur')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['A','Axe pédalier — Axe cintre','cotesA'],
                      ['D','Différence Selle–Cintre',  'cotesD'],
                      ['C','Selle — creux du cintre',  'cotesC'],
                      ['G','Selle — cintre',           'cotesG'],
                      ['P','Selle — poignées',         'cotesP'],
                      ['R','Recul de selle',           'cotesR'],
                      ['S','Hauteur de selle',         'cotesS'],
                      ['M','Longueur des manivelles',  'cotesM'],
                    ] as [string,string,keyof ReportData][]).map(([ref,des,key]) => (
                      <tr key={ref} className="border-b border-[#22223b]">
                        <td className="px-2 py-1 font-bold text-indigo-400">{ref}</td>
                        <td className="px-2 py-1 text-slate-300">{des}</td>
                        <td className="px-2 py-1 text-center">
                          <input className={coteInput} value={data[key] as string} onChange={setStr(key)} placeholder="—" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Right table: 1–5 */}
                <table className="w-44 text-xs border-collapse self-start">
                  <thead>
                    <tr className="bg-[#22223b]">
                      <th className="text-slate-400 font-semibold px-2 py-1 text-left w-6">{t('report.s6_ref')}</th>
                      <th className="text-slate-400 font-semibold px-2 py-1 text-left">{t('report.s6_designation')}</th>
                      <th className="text-slate-400 font-semibold px-2 py-1 text-center w-14">{t('report.s6_valeur')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[#1a1a2e]">
                      <td colSpan={3} className="px-2 py-1 text-xs font-semibold text-slate-400">{t('report.s6_cintre')}</td>
                    </tr>
                    {([['1','Largeur','cotes1'],['2','Reach','cotes2'],['3','Drop','cotes3']] as [string,string,keyof ReportData][]).map(([ref,des,key]) => (
                      <tr key={ref} className="border-b border-[#22223b]">
                        <td className="px-2 py-1 font-bold text-indigo-400">{ref}</td>
                        <td className="px-2 py-1 text-slate-300">{des}</td>
                        <td className="px-2 py-1 text-center"><input className={coteInput} value={data[key] as string} onChange={setStr(key)} placeholder="—" /></td>
                      </tr>
                    ))}
                    <tr className="bg-[#1a1a2e]">
                      <td colSpan={3} className="px-2 py-1 text-xs font-semibold text-slate-400">{t('report.s6_potence')}</td>
                    </tr>
                    {([['4','Longueur','cotes4'],['5','Angle','cotes5']] as [string,string,keyof ReportData][]).map(([ref,des,key]) => (
                      <tr key={ref} className="border-b border-[#22223b]">
                        <td className="px-2 py-1 font-bold text-indigo-400">{ref}</td>
                        <td className="px-2 py-1 text-slate-300">{des}</td>
                        <td className="px-2 py-1 text-center"><input className={coteInput} value={data[key] as string} onChange={setStr(key)} placeholder="—" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Accordion>

          {/* S7 — Captures Avant / Après */}
          <Accordion title={t('report.s7_title')}>
            {captures.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t('report.noCaptures')}</p>
            ) : (
              <div className="flex gap-4">
                <CaptureSlot label="Avant" selected={data.capturesBefore} all={captures}
                  excluded={data.capturesAfter}
                  onToggle={handleCapture} onMoveAll={handleMoveAll} />
                <div className="w-px bg-[#22223b] shrink-0" />
                <CaptureSlot label="Après" selected={data.capturesAfter} all={captures}
                  excluded={data.capturesBefore}
                  onToggle={handleCapture} onMoveAll={handleMoveAll} />
              </div>
            )}
          </Accordion>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#22223b] shrink-0 bg-[#0d0d14]">
          <button onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-[#22223b] hover:bg-[#2d2d48] rounded-lg transition-colors">
            {t('report.cancel')}
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg transition-colors">
            {exporting
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('report.generating')}</>
              : t('report.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
