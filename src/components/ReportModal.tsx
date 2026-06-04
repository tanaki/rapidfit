import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import type { Capture, Client, Session, ReportData, CompanySettings } from '../types';
import { DEFAULT_REPORT } from '../types';

interface Props {
  captures: Capture[];
  client: Client | null;
  session: Session | null;
  company: CompanySettings;
  initialData: ReportData | null;
  onClose: () => void;
  onSave: (data: ReportData) => void;
  onUpdateClient?: (updates: Partial<Pick<Client, 'weight' | 'height'>>) => Promise<void>;
}

// ── Migrate old report format (selectedCaptureIds → capturesBefore) ────────────
function migrate(raw: Partial<ReportData> & { selectedCaptureIds?: string[] }): ReportData {
  const base = { ...DEFAULT_REPORT, ...raw };
  if (raw.selectedCaptureIds && !raw.capturesBefore?.length && !raw.capturesAfter?.length) {
    base.capturesBefore = raw.selectedCaptureIds;
    base.capturesAfter  = [];
  }
  return base;
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
    if (company.logoDataUrl) {
      try { doc.addImage(company.logoDataUrl, 'PNG', margin, 2, 0, 16); } catch { /* skip */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    if (companyLine) doc.text(companyLine, pageW / 2, 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Étude posturale — ${dateStr}`, pageW / 2, 16, { align: 'center' });
    y = 28;
  };

  const newPage = () => { doc.addPage(); drawHeader(); };
  const needSpace = (h: number) => { if (y + h > pageH - 18) newPage(); };

  const section = (title: string) => {
    needSpace(14);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 130);
    doc.text(title.toUpperCase(), margin, y);
    y += 3;
    doc.setDrawColor(210, 210, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const field = (label: string, value: string, x: number, vxHint: number) => {
    needSpace(7);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
    doc.text(label, x, y);
    // Ensure value never overlaps label
    const vx = Math.max(vxHint, x + doc.getTextWidth(label) + 3);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
    doc.text(value || '—', vx, y);
  };

  const textBlock = (label: string, value: string) => {
    needSpace(8);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
    doc.text(label, margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
    if (value.trim()) {
      const lines = doc.splitTextToSize(value, pageW - margin * 2);
      needSpace(lines.length * 5);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    } else {
      doc.setTextColor(180, 180, 190); doc.text('—', margin, y); y += 9;
    }
  };

  const discipline = session?.discipline ? i18n.t(`session.discipline_${session.discipline}`) : '';

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  drawHeader();
  section(i18n.t('report.pdfSectionClient'));
  field(i18n.t('report.pdfFieldName'),      client?.nom    || '', margin, margin + 16);
  field(i18n.t('report.pdfFieldFirstName'), client?.prenom || '', col2,   col2 + 22);
  y += 7;
  field(i18n.t('report.pdfFieldEmail'),     client?.email  || '', margin, margin + 16);
  field(i18n.t('report.pdfFieldPhone'),     client?.phone  || '', col2,   col2 + 22);
  y += 7;
  if (client?.birthDate) field('Date de naissance :', client.birthDate, margin, margin + 34);
  const mensu = [client?.weight ? `${client.weight} kg` : '', client?.height ? `${client.height} cm` : ''].filter(Boolean).join(' · ');
  if (mensu) field('Mensurations :', mensu, col2, col2 + 22);
  y += 7;
  field('Discipline :', discipline, margin, margin + 22);
  if (session?.bikeFitDate) field('Date :', session.bikeFitDate, col2, col2 + 14);
  y += 10;

  section(i18n.t('report.s2_title'));
  const levelLabel = data.practiceLevel ? i18n.t(`report.s2_level_${data.practiceLevel}`) : '—';
  field(i18n.t('report.s2_level') + ' :', levelLabel, margin, margin + 34);
  field(i18n.t('report.s2_years') + ' :', data.practiceYears ? `${data.practiceYears} ans` : '—', col2, col2 + 34);
  y += 7;
  field(i18n.t('report.s2_weekly') + ' :', data.weeklyVolume ? `${data.weeklyVolume} h/sem` : '—', margin, margin + 40);
  field(i18n.t('report.s2_annual') + ' :', data.annualVolume ? `${data.annualVolume} km/an` : '—', col2, col2 + 34);
  y += 10;

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
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 110);
    doc.text(label + ' :', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 30);
    doc.text(val, margin + 58, y);
    if (note) { doc.setTextColor(100, 100, 120); doc.text(`(${note})`, margin + 58 + doc.getTextWidth(val) + 4, y); }
    y += 7;
  }
  y += 4;

  section(i18n.t('report.s5_title'));
  textBlock('', data.bilan);
  y += 4;

  // ── Page 3 — Fiche de cotes ──────────────────────────────────────────────────
  newPage();
  section(i18n.t('report.s6_title'));

  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
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
  const rightRows: [string, string, string][] = [
    ['',  i18n.t('report.s6_cintre'),  ''],
    ['1', 'Largeur',   data.cotes1],
    ['2', 'Reach',     data.cotes2],
    ['3', 'Drop',      data.cotes3],
    ['',  i18n.t('report.s6_potence'), ''],
    ['4', 'Longueur',  data.cotes4],
    ['5', 'Angle',     data.cotes5],
  ];

  const halfW = (pageW - margin * 2) / 2 - 4;
  const refW = 12; const valW = 28;
  const desW = halfW - refW - valW;
  const col2x = margin + halfW + 8;

  const tableHeader = (x: number) => {
    doc.setFillColor(230, 230, 240);
    doc.rect(x, y - 4, halfW, 6, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
    doc.text(i18n.t('report.s6_ref'), x + 2, y);
    doc.text(i18n.t('report.s6_designation'), x + refW + 2, y);
    doc.text(i18n.t('report.s6_valeur'), x + refW + desW + 2, y);
  };

  needSpace(8 * coteRows.length + 10);
  tableHeader(margin); tableHeader(col2x); y += 6;

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
  for (const [ref, des, val] of rightRows) drawRow(col2x, ref, des, val, ref === '');
  y = Math.max(leftEndY, y) + 4;

  // ── Captures ────────────────────────────────────────────────────────────────
  const beforeCaps = captures.filter(c => data.capturesBefore.includes(c.id));
  const afterCaps  = captures.filter(c => data.capturesAfter.includes(c.id));

  const renderCaptureGroup = async (label: string, caps: Capture[]) => {
    if (caps.length === 0) return;
    needSpace(20);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
    doc.text(label, margin, y); y += 6;
    const gap = 5; const cols = 2;
    const imgW = (pageW - margin * 2 - gap) / cols;
    const imgH = imgW * (9 / 16);
    let col = 0;
    for (const cap of caps) {
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
  };

  if (beforeCaps.length + afterCaps.length > 0) {
    newPage();
    section(i18n.t('report.s7_title'));

    const capColGap = 6;
    const capColW   = (pageW - margin * 2 - capColGap) / 2;
    const capImgH   = capColW * (9 / 16);
    const capImgGap = 3;
    const capCol2x  = margin + capColW + capColGap;

    // Column headers
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
    if (beforeCaps.length > 0) doc.text('Avant', margin, y);
    if (afterCaps.length  > 0) doc.text('Après', capCol2x, y);
    y += 7;

    const capStartY = y;

    // Helper — render one column of captures
    const renderCol = async (caps: Capture[], x: number): Promise<number> => {
      let cy = capStartY;
      for (const cap of caps) {
        if (cy + capImgH > pageH - margin) break; // avoid overflow (add page if needed later)
        try {
          const dataUrl = await toDataUrl(cap.url);
          doc.addImage(dataUrl, 'PNG', x, cy, capColW, capImgH);
          if (cap.paneLabel) {
            doc.setFillColor(79, 70, 229);
            doc.roundedRect(x + 2, cy + 2, 8, 5, 1, 1, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
            doc.text(cap.paneLabel, x + 6, cy + 5.5, { align: 'center' });
          }
        } catch {
          doc.setFillColor(240, 240, 245);
          doc.rect(x, cy, capColW, capImgH, 'F');
          doc.setTextColor(160, 160, 170); doc.setFontSize(8);
          doc.text(i18n.t('report.pdfImageUnavailable'), x + capColW / 2, cy + capImgH / 2, { align: 'center' });
        }
        cy += capImgH + capImgGap;
      }
      return cy;
    };

    const [yLeft, yRight] = await Promise.all([
      renderCol(beforeCaps, margin),
      renderCol(afterCaps,  capCol2x),
    ]);
    y = Math.max(yLeft, yRight);
  }

  // ── Page numbers ─────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 170);
    const footer = companyLine ? `${companyLine} — ${p} / ${total}` : `RapidFit — ${p} / ${total}`;
    doc.text(footer, pageW / 2, pageH - 6, { align: 'center' });
  }

  const slug = [client?.nom, client?.prenom].filter(Boolean).join('_') || 'session';
  const discSlug = session?.discipline?.toUpperCase() || '';
  const prefix = i18n.language === 'fr' ? 'Compte_rendu' : 'Report';
  doc.save(`${prefix}_${slug}${discSlug ? '_' + discSlug : ''}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Accordion ─────────────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#22223b] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a2e] hover:bg-[#22223b] transition-colors text-left">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{title}</span>
        <span className={`text-slate-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 py-4 space-y-4 bg-[#13131f]">{children}</div>}
    </div>
  );
}

// ── RadioGroup ────────────────────────────────────────────────────────────────

function RadioGroup<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            value === o.value
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-[#22223b] border-[#3d3d5c] text-slate-300 hover:bg-[#2d2d48]'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── CaptureSlot ───────────────────────────────────────────────────────────────

function CaptureSlot({ label, captures, selected, all, onToggle, onMoveAll, otherLabel }: {
  label: string;
  captures: Capture[];
  selected: string[];
  all: Capture[];
  onToggle: (id: string, slot: 'before' | 'after') => void;
  onMoveAll: (slot: 'before' | 'after') => void;
  otherLabel: string;
}) {
  const slot = label === 'Avant' ? 'before' : 'after';
  const selectedCaps = all.filter(c => selected.includes(c.id));
  const available = all.filter(c => !selected.includes(c.id));

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
        <button onClick={() => onMoveAll(slot)}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          Tout mettre ici
        </button>
      </div>
      {/* Selected captures */}
      <div className="min-h-[80px] bg-[#0d0d14] rounded-lg border border-[#22223b] p-2 flex flex-wrap gap-2 mb-2">
        {selectedCaps.length === 0 ? (
          <span className="text-[10px] text-slate-700 m-auto">{label}</span>
        ) : selectedCaps.map(cap => (
          <button key={cap.id} onClick={() => onToggle(cap.id, slot)}
            title="Retirer"
            className="relative rounded overflow-hidden border-2 border-indigo-500 w-24 aspect-video">
            <img src={cap.url} alt={cap.name} className="w-full h-full object-cover" />
            {cap.paneLabel && (
              <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-indigo-600/90 text-white px-1 rounded">
                {cap.paneLabel}
              </span>
            )}
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center text-[9px] text-white">✕</span>
          </button>
        ))}
      </div>
      {/* Available captures not yet in any slot */}
      {available.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 mb-1">Cliquer pour ajouter ici :</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map(cap => (
              <button key={cap.id} onClick={() => onToggle(cap.id, slot)}
                className="relative rounded overflow-hidden border border-[#3d3d5c] hover:border-indigo-400 w-20 aspect-video opacity-60 hover:opacity-100 transition-all">
                <img src={cap.url} alt={cap.name} className="w-full h-full object-cover" />
                {cap.paneLabel && (
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-indigo-600/90 text-white px-1 rounded">
                    {cap.paneLabel}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportModal({ captures, client, session, company, initialData, onClose, onSave, onUpdateClient }: Props) {
  const { t } = useTranslation();

  const [data, setData] = useState<ReportData>(() => migrate(initialData ?? DEFAULT_REPORT));
  const [exporting, setExporting] = useState(false);
  const [localWeight, setLocalWeight] = useState(String(client?.weight ?? ''));
  const [localHeight, setLocalHeight] = useState(String(client?.height ?? ''));

  const set = useCallback(<K extends keyof ReportData>(key: K, val: ReportData[K]) =>
    setData(d => ({ ...d, [key]: val })), []);

  const setStr = useCallback((key: keyof ReportData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as ReportData[typeof key]), [set]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(data), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, onSave]);

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
    await onUpdateClient({
      weight: isNaN(w) ? undefined : w,
      height: isNaN(h) ? undefined : h,
    });
  }, [onUpdateClient, localWeight, localHeight]);

  const handleExport = async () => {
    setExporting(true);
    onSave(data);
    try { await generatePDF(data, captures, client, session, company); }
    finally { setExporting(false); }
  };

  const input = 'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const smallInput = 'bg-[#22223b] border border-[#3d3d5c] rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';
  const coteInput = 'w-20 bg-[#22223b] border border-[#3d3d5c] rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500 text-center tabular-nums';

  const discipline = session?.discipline ? t(`session.discipline_${session.discipline}`) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[780px] max-h-[92vh] flex flex-col overflow-hidden">

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

          {/* S1 — Informations client */}
          <Accordion title={t('report.clientInfo')}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {[
                [t('report.lastName'),  client?.nom    || '—'],
                [t('report.firstName'), client?.prenom || '—'],
                [t('report.email'),     client?.email  || '—'],
                [t('report.phone'),     client?.phone  || '—'],
                ['Date de naissance',   client?.birthDate || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <span className="text-slate-500 shrink-0 w-32">{l} :</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
            {/* Editable weight / height */}
            <div className="flex items-end gap-4 pt-2 border-t border-[#22223b]">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Poids (kg)</label>
                <input className={`${smallInput} w-24`} value={localWeight} placeholder="—"
                  onChange={e => setLocalWeight(e.target.value)}
                  onBlur={handleSaveMetrics} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Taille (cm)</label>
                <input className={`${smallInput} w-24`} value={localHeight} placeholder="—"
                  onChange={e => setLocalHeight(e.target.value)}
                  onBlur={handleSaveMetrics} />
              </div>
              <span className="text-[10px] text-slate-600 pb-1.5">Sauvegardé automatiquement</span>
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
                ['veloDepuis',   t('report.s3_veloDepuis')],
                ['veloPrecedent',t('report.s3_veloPrecedent')],
                ['autresSports', t('report.s3_autresSports')],
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

            {/* Image PNG au-dessus, tables en dessous */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('report.s6_cotes')}</h4>
              {/* Diagram — PNG with SVG fallback */}
              <div className="mb-4 bg-white rounded-lg p-3">
                <img
                  src={`${import.meta.env.BASE_URL}bike-diagram.png`}
                  alt="Diagramme de cotes vélo"
                  className="w-full h-auto"
                  onError={e => {
                    // Fallback: hide broken image, show SVG inline
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const svgFallback = target.nextElementSibling as HTMLElement;
                    if (svgFallback) svgFallback.style.display = 'block';
                  }}
                />
                {/* SVG fallback (hidden by default) */}
                <div style={{ display: 'none' }}>
                  <SvgDiagram />
                </div>
              </div>

              {/* Tables */}
              <div className="flex gap-3">
                {/* Left: A-M */}
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
                {/* Right: 1-5 */}
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
                <CaptureSlot
                  label="Avant"
                  captures={captures}
                  selected={data.capturesBefore}
                  all={captures}
                  onToggle={handleCapture}
                  onMoveAll={handleMoveAll}
                  otherLabel="Après"
                />
                <div className="w-px bg-[#22223b] shrink-0" />
                <CaptureSlot
                  label="Après"
                  captures={captures}
                  selected={data.capturesAfter}
                  all={captures}
                  onToggle={handleCapture}
                  onMoveAll={handleMoveAll}
                  otherLabel="Avant"
                />
              </div>
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
              : t('report.export')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SVG Fallback (affiché si bike-diagram.png absent) ─────────────────────────
function SvgDiagram() {
  const blue = '#3b82f6';
  const dark = '#1e293b';
  const dash = '5,4';
  const sw   = 7;
  const lw   = 1.2;
  return (
    <svg viewBox="0 0 700 390" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <g stroke={blue} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="135" cy="298" r="78" strokeWidth={sw} />
        <circle cx="475" cy="298" r="78" strokeWidth={sw} />
        <circle cx="135" cy="298" r="5" fill={blue} stroke="none" />
        <circle cx="475" cy="298" r="5" fill={blue} stroke="none" />
        <circle cx="300" cy="298" r="9" fill={blue} stroke="none" />
        <line x1="300" y1="298" x2="135" y2="298" strokeWidth={sw} />
        <line x1="300" y1="298" x2="268" y2="155" strokeWidth={sw} />
        <line x1="268" y1="155" x2="135" y2="298" strokeWidth={sw} />
        <line x1="268" y1="155" x2="440" y2="143" strokeWidth={sw} />
        <line x1="440" y1="143" x2="300" y2="298" strokeWidth={sw} />
        <line x1="440" y1="143" x2="452" y2="173" strokeWidth={sw + 2} />
        <line x1="452" y1="173" x2="475" y2="298" strokeWidth={sw} />
        <line x1="272" y1="162" x2="265" y2="126" strokeWidth={5} />
        <path d="M244,122 Q255,118 265,120 Q275,118 286,122" strokeWidth={6} strokeLinecap="round" />
        <line x1="446" y1="145" x2="474" y2="136" strokeWidth={5} />
        <path d="M466,130 L480,130 Q488,130 488,138 L488,158 Q488,166 480,166" strokeWidth={5} />
        <circle cx="480" cy="136" r="4" fill={blue} stroke="none" />
        <line x1="300" y1="298" x2="322" y2="323" strokeWidth={5} />
        <line x1="300" y1="298" x2="278" y2="273" strokeWidth={5} />
        <line x1="318" y1="326" x2="330" y2="320" strokeWidth={4} />
        <line x1="274" y1="270" x2="264" y2="277" strokeWidth={4} />
      </g>
      <g stroke={dark} fill="none" strokeDasharray={dash} strokeWidth={lw}>
        <line x1="300" y1="298" x2="300" y2="120" />
        <line x1="263" y1="120" x2="300" y2="120" />
        <line x1="300" y1="102" x2="484" y2="102" />
        <line x1="484" y1="120" x2="484" y2="132" />
        <line x1="263" y1="120" x2="480" y2="136" />
        <line x1="263" y1="120" x2="473" y2="130" />
        <line x1="263" y1="120" x2="488" y2="126" />
      </g>
      <g fill={dark} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
        <text x="392" y="98" fontSize="13">A</text>
        <text x="492" y="130" fontSize="13">D</text>
        <text x="382" y="136" fontSize="13">C</text>
        <text x="374" y="128" fontSize="13">G</text>
        <text x="382" y="116" fontSize="13">P</text>
        <text x="280" y="116" fontSize="13">R</text>
        <text x="315" y="215" fontSize="13">S</text>
        <text x="318" y="333" fontSize="13">M</text>
      </g>
    </svg>
  );
}
