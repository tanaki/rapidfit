import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import type { Capture, Client, Session, ReportData, CompanySettings } from '../types';
import { DEFAULT_REPORT } from '../types';
import { BikeMeasurementDiagram } from './BikeMeasurementDiagram';

interface Props {
  captures: Capture[];
  client: Client | null;
  session: Session | null;
  company: CompanySettings;
  initialData: ReportData | null;
  onClose: () => void;
  onSave: (data: ReportData) => void;
}

// ── PDF helpers ────────────────────────────────────────────────────────────────

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generatePDF(
  data: ReportData,
  captures: Capture[],
  client: Client | null,
  session: Session | null,
  company: CompanySettings,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 16;
  const col2   = pageW / 2 + 4;
  let y = 0;

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const companyLine = [company.name, company.subtitle].filter(Boolean).join(' — ');

  const drawHeader = () => {
    doc.setFillColor(19, 19, 31);
    doc.rect(0, 0, pageW, 20, 'F');
    // Company logo
    if (company.logoDataUrl) {
      try { doc.addImage(company.logoDataUrl, 'PNG', margin, 2, 0, 16); } catch { /* skip */ }
    }
    // Company name centred
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    if (companyLine) doc.text(companyLine, pageW / 2, 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Étude posturale — ${dateStr}`, pageW / 2, 16, { align: 'center' });
    y = 28;
  };

  const newPage = () => { doc.addPage(); drawHeader(); };

  const needSpace = (h: number) => { if (y + h > pageH - 18) newPage(); };

  const section = (title: string) => {
    needSpace(14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 130);
    doc.text(title.toUpperCase(), margin, y);
    y += 3;
    doc.setDrawColor(210, 210, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const field = (label: string, value: string, x: number, vx: number) => {
    needSpace(7);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 90, 110);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 30);
    doc.text(value || '—', vx, y);
  };

  const textBlock = (label: string, value: string) => {
    needSpace(8);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 90, 110);
    doc.text(label, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 30);
    if (value.trim()) {
      const lines = doc.splitTextToSize(value, pageW - margin * 2);
      needSpace(lines.length * 5);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    } else {
      doc.setTextColor(180, 180, 190);
      doc.text('—', margin, y);
      y += 9;
    }
  };

  const discipline = session?.discipline
    ? i18n.t(`session.discipline_${session.discipline}`)
    : '';

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  drawHeader();

  // Client
  section(i18n.t('report.pdfSectionClient'));
  field(i18n.t('report.pdfFieldName'),      client?.nom    || '', margin,  margin + 16);
  field(i18n.t('report.pdfFieldFirstName'), client?.prenom || '', col2,    col2 + 22);
  y += 7;
  field(i18n.t('report.pdfFieldEmail'),     client?.email  || '', margin,  margin + 16);
  field(i18n.t('report.pdfFieldPhone'),     client?.phone  || '', col2,    col2 + 22);
  y += 7;
  if (client?.birthDate) {
    field('Date de naissance :', client.birthDate, margin, margin + 34);
  }
  if (client?.weight || client?.height) {
    field('Mensurations :', [client?.weight ? `${client.weight} kg` : '', client?.height ? `${client.height} cm` : ''].filter(Boolean).join(' · '), col2, col2 + 22);
  }
  y += 7;
  field('Discipline :', discipline, margin, margin + 22);
  if (session?.bikeFitDate) {
    field('Date :', session.bikeFitDate, col2, col2 + 14);
  }
  y += 10;

  // Pratique
  section(i18n.t('report.s2_title'));
  const levelLabel = data.practiceLevel ? i18n.t(`report.s2_level_${data.practiceLevel}`) : '—';
  field(i18n.t('report.s2_level') + ' :', levelLabel, margin, margin + 34);
  field(i18n.t('report.s2_years') + ' :', data.practiceYears ? `${data.practiceYears} ans` : '—', col2, col2 + 34);
  y += 7;
  field(i18n.t('report.s2_weekly') + ' :', data.weeklyVolume ? `${data.weeklyVolume} h/sem` : '—', margin, margin + 40);
  field(i18n.t('report.s2_annual') + ' :', data.annualVolume ? `${data.annualVolume} km/an` : '—', col2, col2 + 34);
  y += 10;

  // Diagnostic
  section(i18n.t('report.s3_title'));
  textBlock(i18n.t('report.s3_motif') + ' :', data.motif);
  textBlock(i18n.t('report.s3_douleurs') + ' :', data.douleurs);
  field(i18n.t('report.s3_veloDepuis') + ' :', data.veloDepuis || '—', margin, margin + 30);
  field(i18n.t('report.s3_veloPrecedent') + ' :', data.veloPrecedent || '—', col2, col2 + 28);
  y += 7;
  textBlock(i18n.t('report.s3_anciennesBlessures') + ' :', data.anciennesBlessures);
  textBlock(i18n.t('report.s3_blessuresRecentes') + ' :', data.blessuresRecentes);
  field(i18n.t('report.s3_autresSports') + ' :', data.autresSports || '—', margin, margin + 36);
  y += 10;

  // ── Page 2 ──────────────────────────────────────────────────────────────────
  newPage();

  // Tests physios
  section(i18n.t('report.s4_title'));
  const testRows: [string, string, string][] = [
    [i18n.t('report.s4_pieds'),     data.piedAllure  ? i18n.t(`report.s4_${data.piedAllure}`)   : '—', data.piedNote],
    [i18n.t('report.s4_genoux'),    data.genouAllure ? i18n.t(`report.s4_${data.genouAllure}`)  : '—', data.genouNote],
    [i18n.t('report.s4_souplesse'), data.souplesseChaine ? i18n.t(`report.s4_${data.souplesseChaine}`) : '—', data.souplesseNote],
    [i18n.t('report.s4_squat'),     data.squat       ? i18n.t(`report.s4_${data.squat}`)        : '—', data.squatNote],
    [i18n.t('report.s4_fente'),     data.fente       ? i18n.t(`report.s4_${data.fente}`)        : '—', data.fenteNote],
  ];
  for (const [label, val, note] of testRows) {
    needSpace(7);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
    doc.text(label + ' :', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
    doc.text(val, margin + 58, y);
    if (note) {
      doc.setTextColor(100, 100, 120);
      doc.text(`(${note})`, margin + 58 + doc.getTextWidth(val) + 4, y);
    }
    y += 7;
  }
  y += 4;

  // Bilan
  section(i18n.t('report.s5_title'));
  textBlock('', data.bilan);
  y += 4;

  // ── Page 3 — Fiche de cotes ──────────────────────────────────────────────────
  newPage();
  section(i18n.t('report.s6_title'));

  // Matériel
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
  doc.text(i18n.t('report.s6_materiel'), margin, y); y += 5;
  const materielRows: [string, string][] = [
    [i18n.t('report.s6_veloModele'), data.veloModele],
    [i18n.t('report.s6_veloTaille'), data.veloTaille],
    [i18n.t('report.s6_selle'),      data.selleMateriel],
    [i18n.t('report.s6_pedales'),    data.pedales],
    [i18n.t('report.s6_chaussures'), data.chaussures],
  ];
  const mColW = (pageW - margin * 2) / 2;
  for (let i = 0; i < materielRows.length; i += 2) {
    needSpace(6);
    const [l1, v1] = materielRows[i];
    const [l2, v2] = materielRows[i + 1] ?? ['', ''];
    doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
    doc.text(l1 + ' :', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
    doc.text(v1 || '—', margin + mColW * 0.45, y);
    if (l2) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
      doc.text(l2 + ' :', col2, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
      doc.text(v2 || '—', col2 + mColW * 0.45, y);
    }
    y += 6;
  }
  y += 6;

  // Cotes table
  doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
  doc.text(i18n.t('report.s6_cotes'), margin, y); y += 5;

  const coteRows: [string, string, string][] = [
    ['A', 'Axe pédalier — Axe cintre', data.cotesA],
    ['D', 'Différence Selle–Cintre',   data.cotesD],
    ['C', 'Selle — creux du cintre',   data.cotesC],
    ['G', 'Selle — cintre',            data.cotesG],
    ['P', 'Selle — poignées',          data.cotesP],
    ['R', 'Recul de selle',            data.cotesR],
    ['S', 'Hauteur de selle',          data.cotesS],
    ['M', 'Longueur des manivelles',   data.cotesM],
  ];
  const headerRows: [string, string, string][] = [
    ['',  i18n.t('report.s6_cintre'),  ''],
    ['1', 'Largeur',   data.cotes1],
    ['2', 'Reach',     data.cotes2],
    ['3', 'Drop',      data.cotes3],
    ['',  i18n.t('report.s6_potence'), ''],
    ['4', 'Longueur',  data.cotes4],
    ['5', 'Angle',     data.cotes5],
  ];

  const refW = 12; const valW = 28;
  const tW = (pageW - margin * 2);
  const halfW = tW / 2 - 4;
  const desW = halfW - refW - valW;
  const col2x = margin + halfW + 8;

  const tableHeader = (x: number) => {
    doc.setFillColor(230, 230, 240);
    doc.rect(x, y - 4, halfW, 6, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
    doc.text(i18n.t('report.s6_ref'),         x + 2,              y);
    doc.text(i18n.t('report.s6_designation'), x + refW + 2,       y);
    doc.text(i18n.t('report.s6_valeur'),       x + refW + desW + 2, y);
  };

  needSpace(8 * coteRows.length + 10);
  tableHeader(margin); tableHeader(col2x);
  y += 4;

  const drawRow = (x: number, ref: string, des: string, val: string, isGroupHeader = false) => {
    if (isGroupHeader) {
      doc.setFillColor(240, 240, 250);
      doc.rect(x, y - 3.5, halfW, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 80, 140); doc.setFontSize(7.5);
      doc.text(des, x + refW + 2, y);
    } else {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100); doc.setFontSize(8);
      doc.text(ref, x + 2, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
      doc.text(des, x + refW + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(val || '—', x + refW + desW + 2, y);
      doc.setDrawColor(220, 220, 230);
      doc.line(x, y + 1.5, x + halfW, y + 1.5);
    }
    y += 6;
  };

  const savedY = y;
  for (const [ref, des, val] of coteRows) drawRow(margin, ref, des, val);
  const leftEndY = y;

  y = savedY;
  for (const [ref, des, val] of headerRows) drawRow(col2x, ref, des, val, ref === '');
  y = Math.max(leftEndY, y) + 4;

  // ── Captures ────────────────────────────────────────────────────────────────
  const selectedCaps = captures.filter(c => data.selectedCaptureIds.includes(c.id));
  if (selectedCaps.length > 0) {
    newPage();
    section(i18n.t('report.s7_title'));
    const gap = 5; const cols = 2;
    const imgW = (pageW - margin * 2 - gap) / cols;
    const imgH = imgW * (9 / 16);
    let col = 0;
    for (const cap of selectedCaps) {
      needSpace(imgH + gap);
      const x = margin + col * (imgW + gap);
      try {
        const dataUrl = await toDataUrl(cap.url);
        doc.addImage(dataUrl, 'PNG', x, y, imgW, imgH);
        if (cap.paneLabel) {
          doc.setFillColor(79, 70, 229);
          doc.roundedRect(x + 2, y + 2, 8, 5, 1, 1, 'F');
          doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.text(cap.paneLabel, x + 6, y + 5.5, { align: 'center' });
        }
      } catch {
        doc.setFillColor(240, 240, 245);
        doc.rect(x, y, imgW, imgH, 'F');
        doc.setTextColor(160, 160, 170); doc.setFontSize(8);
        doc.text(i18n.t('report.pdfImageUnavailable'), x + imgW / 2, y + imgH / 2, { align: 'center' });
      }
      col++;
      if (col >= cols) { col = 0; y += imgH + gap; }
    }
    if (col > 0) y += imgH + gap;
  }

  // ── Page numbers ─────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 170);
    const footer = companyLine
      ? `${companyLine} — ${p} / ${total}`
      : `RapidFit — ${p} / ${total}`;
    doc.text(footer, pageW / 2, pageH - 6, { align: 'center' });
  }

  const slug = [client?.nom, client?.prenom].filter(Boolean).join('_') || 'session';
  const prefix = i18n.language === 'fr' ? 'Compte_rendu' : 'Report';
  doc.save(`${prefix}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Accordion section ──────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#22223b] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a2e] hover:bg-[#22223b] transition-colors text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{title}</span>
        <span className={`text-slate-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 py-4 space-y-4 bg-[#13131f]">{children}</div>}
    </div>
  );
}

// ── Radio group ────────────────────────────────────────────────────────────────

function RadioGroup<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            value === o.value
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-[#22223b] border-[#3d3d5c] text-slate-300 hover:bg-[#2d2d48]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportModal({ captures, client, session, company, initialData, onClose, onSave }: Props) {
  const { t } = useTranslation();

  const [data, setData] = useState<ReportData>(() => {
    const base = initialData ?? DEFAULT_REPORT;
    if (base.selectedCaptureIds.length === 0) {
      return { ...base, selectedCaptureIds: captures.map(c => c.id) };
    }
    return base;
  });
  const [exporting, setExporting] = useState(false);

  const set = useCallback(<K extends keyof ReportData>(key: K, val: ReportData[K]) =>
    setData(d => ({ ...d, [key]: val })), []);

  const setStr = useCallback((key: keyof ReportData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as ReportData[typeof key]), [set]);

  // Auto-save on data change (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(data), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, onSave]);

  const toggleCapture = useCallback((id: string) =>
    setData(d => ({
      ...d,
      selectedCaptureIds: d.selectedCaptureIds.includes(id)
        ? d.selectedCaptureIds.filter(x => x !== id)
        : [...d.selectedCaptureIds, id],
    })), []);

  const handleExport = async () => {
    setExporting(true);
    onSave(data);
    try {
      await generatePDF(data, captures, client, session, company);
    } finally {
      setExporting(false);
    }
  };

  const input = 'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const smallInput = 'bg-[#22223b] border border-[#3d3d5c] rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const coteInput = 'w-20 bg-[#22223b] border border-[#3d3d5c] rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500 text-center tabular-nums';

  const discipline = session?.discipline
    ? t(`session.discipline_${session.discipline}`)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[760px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{t('report.title')}</h2>
            {client && (
              <p className="text-xs text-slate-500 mt-0.5">
                {client.prenom} {client.nom}
                {discipline && <> · {discipline}</>}
                {session?.bikeFitDate && <> · {session.bikeFitDate}</>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">

          {/* S1 — Client (read-only recap) */}
          <Accordion title={t('report.clientInfo')}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {[
                [t('report.lastName'),  `${client?.nom || '—'}`],
                [t('report.firstName'), `${client?.prenom || '—'}`],
                [t('report.email'),     client?.email    || '—'],
                [t('report.phone'),     client?.phone    || '—'],
                ['Date de naissance',   client?.birthDate || '—'],
                ['Poids / Taille',      [client?.weight ? `${client.weight} kg` : '', client?.height ? `${client.height} cm` : ''].filter(Boolean).join(' · ') || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <span className="text-slate-500 shrink-0 w-32">{l} :</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </Accordion>

          {/* S2 — Pratique */}
          <Accordion title={t('report.s2_title')}>
            <div>
              <label className="block text-xs text-slate-400 mb-2">{t('report.s2_level')}</label>
              <RadioGroup
                value={data.practiceLevel}
                options={(['loisir','sport','competition','pro'] as const).map(v => ({ value: v, label: t(`report.s2_level_${v}`) }))}
                onChange={v => set('practiceLevel', v)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['practiceYears', t('report.s2_years'), 'ans'],
                ['weeklyVolume',  t('report.s2_weekly'), 'h/sem'],
                ['annualVolume',  t('report.s2_annual'), 'km/an'],
              ].map(([key, label, unit]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <div className="flex items-center gap-1">
                    <input className={`${smallInput} flex-1`} placeholder="0"
                      value={data[key as keyof ReportData] as string}
                      onChange={setStr(key as keyof ReportData)} />
                    <span className="text-xs text-slate-600">{unit}</span>
                  </div>
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
              {[
                ['veloDepuis',   t('report.s3_veloDepuis')],
                ['veloPrecedent',t('report.s3_veloPrecedent')],
                ['autresSports', t('report.s3_autresSports')],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <input className={input} value={data[key as keyof ReportData] as string} onChange={setStr(key as keyof ReportData)} />
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
            {/* Pieds */}
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{t('report.s4_pieds')}</label>
              <RadioGroup value={data.piedAllure}
                options={[
                  { value: 'neutre', label: t('report.s4_neutre') },
                  { value: 'varus',  label: t('report.s4_varus') },
                  { value: 'valgus', label: t('report.s4_valgus') },
                ]}
                onChange={v => set('piedAllure', v)} />
              <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data.piedNote} onChange={setStr('piedNote')} />
            </div>
            {/* Genoux */}
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{t('report.s4_genoux')}</label>
              <RadioGroup value={data.genouAllure}
                options={[
                  { value: 'neutre', label: t('report.s4_neutre') },
                  { value: 'dedans', label: t('report.s4_dedans') },
                  { value: 'dehors', label: t('report.s4_dehors') },
                ]}
                onChange={v => set('genouAllure', v)} />
              <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data.genouNote} onChange={setStr('genouNote')} />
            </div>
            {/* Souplesse, Squat, Fente */}
            {([
              ['souplesseChaine', t('report.s4_souplesse'), ['bonne','moyenne','limitee'], 'souplesseNote'],
              ['squat',           t('report.s4_squat'),    ['bon','moyen','compensations'], 'squatNote'],
              ['fente',           t('report.s4_fente'),    ['bonne','moyenne','asymetrique'], 'fenteNote'],
            ] as [keyof ReportData, string, string[], keyof ReportData][]).map(([key, label, opts, noteKey]) => (
              <div key={String(key)} className="space-y-1">
                <label className="block text-xs text-slate-400">{label}</label>
                <RadioGroup value={data[key] as string}
                  options={opts.map(v => ({ value: v, label: t(`report.s4_${v}`) }))}
                  onChange={v => set(key, v as ReportData[typeof key])} />
                <input className={`${input} mt-1`} placeholder={t('report.s4_note')} value={data[noteKey] as string} onChange={setStr(noteKey)} />
              </div>
            ))}
          </Accordion>

          {/* S5 — Bilan */}
          <Accordion title={t('report.s5_title')}>
            <textarea
              className={`${input} min-h-[120px] resize-y`}
              placeholder={t('report.s5_placeholder')}
              value={data.bilan}
              onChange={setStr('bilan')}
            />
          </Accordion>

          {/* S6 — Fiche de cotes */}
          <Accordion title={t('report.s6_title')}>
            {/* Matériel */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('report.s6_materiel')}</h4>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['veloModele',   t('report.s6_veloModele')],
                  ['veloTaille',   t('report.s6_veloTaille')],
                  ['selleMateriel',t('report.s6_selle')],
                  ['pedales',      t('report.s6_pedales')],
                  ['chaussures',   t('report.s6_chaussures')],
                ] as [keyof ReportData, string][]).map(([key, label]) => (
                  <div key={String(key)}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <input className={input} value={data[key] as string} onChange={setStr(key)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Diagram + table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('report.s6_cotes')}</h4>
              <div className="flex gap-4">
                {/* SVG diagram */}
                <div className="w-64 shrink-0 bg-white rounded-lg p-2">
                  <BikeMeasurementDiagram />
                </div>
                {/* Two-column table */}
                <div className="flex-1 flex gap-3">
                  {/* Left table: A-M */}
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
                        ['A', 'Axe pédalier — Axe cintre', 'cotesA'],
                        ['D', 'Différence Selle–Cintre',   'cotesD'],
                        ['C', 'Selle — creux du cintre',   'cotesC'],
                        ['G', 'Selle — cintre',            'cotesG'],
                        ['P', 'Selle — poignées',          'cotesP'],
                        ['R', 'Recul de selle',            'cotesR'],
                        ['S', 'Hauteur de selle',          'cotesS'],
                        ['M', 'Longueur des manivelles',   'cotesM'],
                      ] as [string, string, keyof ReportData][]).map(([ref, des, key]) => (
                        <tr key={ref} className="border-b border-[#22223b]">
                          <td className="px-2 py-1 font-bold text-indigo-400">{ref}</td>
                          <td className="px-2 py-1 text-slate-300">{des}</td>
                          <td className="px-2 py-1 text-center">
                            <input className={coteInput} value={data[key] as string}
                              onChange={setStr(key)} placeholder="—" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Right table: 1-5 */}
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
                      {([
                        ['1', 'Largeur', 'cotes1'],
                        ['2', 'Reach',   'cotes2'],
                        ['3', 'Drop',    'cotes3'],
                      ] as [string, string, keyof ReportData][]).map(([ref, des, key]) => (
                        <tr key={ref} className="border-b border-[#22223b]">
                          <td className="px-2 py-1 font-bold text-indigo-400">{ref}</td>
                          <td className="px-2 py-1 text-slate-300">{des}</td>
                          <td className="px-2 py-1 text-center">
                            <input className={coteInput} value={data[key] as string} onChange={setStr(key)} placeholder="—" />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#1a1a2e]">
                        <td colSpan={3} className="px-2 py-1 text-xs font-semibold text-slate-400">{t('report.s6_potence')}</td>
                      </tr>
                      {([
                        ['4', 'Longueur', 'cotes4'],
                        ['5', 'Angle',    'cotes5'],
                      ] as [string, string, keyof ReportData][]).map(([ref, des, key]) => (
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
                </div>
              </div>
            </div>
          </Accordion>

          {/* S7 — Captures */}
          <Accordion title={t('report.s7_title')}>
            {captures.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t('report.noCaptures')}</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {captures.map(cap => {
                    const selected = data.selectedCaptureIds.includes(cap.id);
                    return (
                      <button key={cap.id} onClick={() => toggleCapture(cap.id)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selected ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-[#3d3d5c] opacity-50'
                        }`}>
                        <img src={cap.url} alt={cap.name} className="w-full aspect-video object-cover" />
                        {cap.paneLabel && (
                          <span className="absolute top-1 left-1 text-[9px] font-bold bg-indigo-600/90 text-white px-1.5 py-0.5 rounded">
                            {cap.paneLabel}
                          </span>
                        )}
                        {selected && (
                          <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setData(d => ({ ...d, selectedCaptureIds: captures.map(c => c.id) }))}
                    className="text-xs text-slate-400 hover:text-slate-200">{t('report.selectAll')}</button>
                  <span className="text-slate-600">·</span>
                  <button onClick={() => setData(d => ({ ...d, selectedCaptureIds: [] }))}
                    className="text-xs text-slate-400 hover:text-slate-200">{t('report.deselectAll')}</button>
                </div>
              </>
            )}
          </Accordion>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#22223b] shrink-0 bg-[#0d0d14]">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-[#22223b] hover:bg-[#2d2d48] rounded-lg transition-colors">
            {t('report.cancel')}
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg transition-colors">
            {exporting
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('report.generating')}</>
              : <>{t('report.export')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
