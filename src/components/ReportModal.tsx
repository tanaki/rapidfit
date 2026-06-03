import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import type { Capture } from '../types';

interface ReportData {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  notes: string;
}

interface Props {
  captures: Capture[];
  onClose: () => void;
}

// Convert a Blob / object-URL to a base-64 data-URL for jsPDF
async function toDataUrl(url: string): Promise<string> {
  const res  = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generatePDF(data: ReportData, captures: Capture[]): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = 0;

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(19, 19, 31);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(i18n.t('report.pdfTitle'), margin, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    pageW - margin, 14, { align: 'right' },
  );
  y = 30;

  // ── Section helper ─────────────────────────────────────────────────────────
  const section = (title: string) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 140);
    doc.text(title.toUpperCase(), margin, y);
    y += 3;
    doc.setDrawColor(200, 200, 210);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  // ── Client info ─────────────────────────────────────────────────────────────
  section(i18n.t('report.pdfSectionClient'));
  const col2 = pageW / 2 + 4;
  const lh   = 7;

  const field = (label: string, value: string, x: number, cx: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 30);
    doc.text(value || '—', cx, y);
  };

  field(i18n.t('report.pdfFieldName'), data.nom, margin, margin + 14);
  field(i18n.t('report.pdfFieldFirstName'), data.prenom, col2, col2 + 20);
  y += lh;
  field(i18n.t('report.pdfFieldEmail'), data.email, margin, margin + 14);
  field(i18n.t('report.pdfFieldPhone'), data.telephone, col2, col2 + 26);
  y += lh + 6;

  // ── Notes ──────────────────────────────────────────────────────────────────
  section(i18n.t('report.pdfSectionNotes'));
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 30);
  if (data.notes.trim()) {
    const lines = doc.splitTextToSize(data.notes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5.5 + 8;
  } else {
    doc.setTextColor(160, 160, 170);
    doc.text('—', margin, y);
    y += 12;
  }

  // ── Captures ───────────────────────────────────────────────────────────────
  if (captures.length > 0) {
    section(i18n.t('report.pdfSectionCaptures'));
    const gap  = 5;
    const cols = 2;
    const imgW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const imgH = imgW * (9 / 16);

    let col = 0;
    const rowX = (c: number) => margin + c * (imgW + gap);

    for (const cap of captures) {
      // New page if not enough room
      if (y + imgH > pageH - margin) { doc.addPage(); y = margin; }

      try {
        const dataUrl = await toDataUrl(cap.url);
        doc.addImage(dataUrl, 'PNG', rowX(col), y, imgW, imgH);

        // Pane badge
        if (cap.paneLabel) {
          doc.setFillColor(79, 70, 229);
          doc.roundedRect(rowX(col) + 2, y + 2, 8, 5, 1, 1, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text(cap.paneLabel, rowX(col) + 6, y + 5.5, { align: 'center' });
        }
      } catch {
        doc.setFillColor(240, 240, 245);
        doc.rect(rowX(col), y, imgW, imgH, 'F');
        doc.setTextColor(160, 160, 170);
        doc.setFontSize(8);
        doc.text(i18n.t('report.pdfImageUnavailable'), rowX(col) + imgW / 2, y + imgH / 2, { align: 'center' });
      }

      col++;
      if (col >= cols) { col = 0; y += imgH + gap; }
    }
    if (col > 0) y += imgH + gap;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 170);
    doc.text(`RapidFit — ${i} / ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  const slug = [data.nom, data.prenom].filter(Boolean).join('_') || 'session';
  const prefix = i18n.language === 'fr' ? 'Compte_rendu' : 'Report';
  doc.save(`${prefix}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportModal({ captures, onClose }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ReportData>({
    nom: '', prenom: '', email: '', telephone: '', notes: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(captures.map(c => c.id)),
  );
  const [exporting, setExporting] = useState(false);

  const set = (key: keyof ReportData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData(d => ({ ...d, [key]: e.target.value }));

  const toggleCapture = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await generatePDF(data, captures.filter(c => selectedIds.has(c.id)));
    } finally {
      setExporting(false);
    }
  };

  const input = 'w-full bg-[#22223b] border border-[#3d3d5c] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#13131f] border border-[#22223b] rounded-xl shadow-2xl w-[680px] max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22223b] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{t('report.title')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('report.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Bloc 1 : Informations client ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
              {t('report.clientInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.lastName')}</label>
                <input className={input} placeholder="Dupont" value={data.nom} onChange={set('nom')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.firstName')}</label>
                <input className={input} placeholder="Jean" value={data.prenom} onChange={set('prenom')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.email')}</label>
                <input className={input} type="email" placeholder="jean@example.com" value={data.email} onChange={set('email')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('report.phone')}</label>
                <input className={input} type="tel" placeholder="+33 6 00 00 00 00" value={data.telephone} onChange={set('telephone')} />
              </div>
            </div>
          </section>

          {/* ── Bloc 2 : Notes ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
              {t('report.notes')}
            </h3>
            <textarea
              className={`${input} resize-y min-h-[120px]`}
              placeholder={t('report.notesPlaceholder')}
              value={data.notes}
              onChange={set('notes')}
            />
          </section>

          {/* ── Bloc 3 : Captures ── */}
          {captures.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
                {t('report.capturesSelected', { selected: selectedIds.size, total: captures.length })}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {captures.map(cap => {
                  const selected = selectedIds.has(cap.id);
                  return (
                    <button
                      key={cap.id}
                      onClick={() => toggleCapture(cap.id)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        selected ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-[#3d3d5c] opacity-50'
                      }`}
                    >
                      <img src={cap.url} alt={cap.name} className="w-full aspect-video object-cover" />
                      {cap.paneLabel && (
                        <span className="absolute top-1 left-1 text-[9px] font-bold bg-indigo-600/90 text-white px-1.5 py-0.5 rounded">
                          {cap.paneLabel}
                        </span>
                      )}
                      {selected && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setSelectedIds(new Set(captures.map(c => c.id)))}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >{t('report.selectAll')}</button>
                <span className="text-slate-600">·</span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >{t('report.deselectAll')}</button>
              </div>
            </section>
          )}

          {captures.length === 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">
                {t('report.captures')}
              </h3>
              <p className="text-xs text-slate-500 italic">
                {t('report.noCaptures')}
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#22223b] shrink-0 bg-[#0d0d14]">
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-[#22223b] hover:bg-[#2d2d48] rounded-lg transition-colors"
            >
              {t('report.cancel')}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg transition-colors"
            >
              {exporting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('report.generating')}
                </>
              ) : (
                <>{t('report.export')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
