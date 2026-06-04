import i18n from '../i18n';
import type { Capture, Client, Session, ReportData, CompanySettings } from '../types';

const getElectronAPI = () =>
  (window as unknown as { electronAPI?: Record<string, (...a: unknown[]) => Promise<unknown>> }).electronAPI;

/** Returns a URL suitable for fetch() to load a static app asset (e.g. bike-diagram.png).
 *  In packaged Electron, window.location.origin is "null" (file://), so we use the
 *  local file server with the absolute path from the main process instead. */
export async function getAppAssetUrl(name: string): Promise<string> {
  const api = getElectronAPI();
  if (api?.appGetAssetPath) {
    const absPath = await api.appGetAssetPath(name) as string;
    const port    = await api.getFileServerPort() as number;
    return `http://127.0.0.1:${port}${absPath}`;
  }
  return `${window.location.origin}${import.meta.env.BASE_URL}${name}`;
}

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

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { w, h } = await new Promise<{ w: number; h: number }>(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 700, h: 390 });
      img.src = dataUrl;
    });
    return { dataUrl, w, h };
  } catch {
    return null;
  }
}

export async function generatePDF(
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

  const dateStr    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const companyLine = [company.name, company.subtitle].filter(Boolean).join(' — ');

  const bikeImgDataUrl = await loadImageDataUrl(await getAppAssetUrl('bike-diagram.png'));

  const HDR_H  = 26;
  const LOGO_H = 18;
  let logoRenderW = 0;
  if (company.logoDataUrl) {
    const dims = await new Promise<{ w: number; h: number }>(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = company.logoDataUrl;
    });
    logoRenderW = Math.min(48, LOGO_H * (dims.w / dims.h));
  }

  const drawHeader = () => {
    doc.setFillColor(19, 19, 31);
    doc.rect(0, 0, pageW, HDR_H, 'F');
    doc.setTextColor(255, 255, 255);

    if (company.logoDataUrl && logoRenderW > 0) {
      try {
        const logoY = (HDR_H - LOGO_H) / 2;
        doc.addImage(company.logoDataUrl, 'PNG', margin, logoY, logoRenderW, LOGO_H);
      } catch { /* skip */ }
    }

    const infoX    = company.logoDataUrl ? margin + logoRenderW + 5 : margin;
    const dateW    = 38;
    const infoMaxW = pageW - infoX - dateW - margin;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    if (company.name) doc.text(company.name, infoX, 9, { maxWidth: infoMaxW });

    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    if (company.subtitle) doc.text(company.subtitle, infoX, 15, { maxWidth: infoMaxW });

    const contactParts = [company.email, company.phone].filter(Boolean);
    if (contactParts.length) {
      doc.setFontSize(7);
      doc.text(contactParts.join('  ·  '), infoX, 21, { maxWidth: infoMaxW });
    }

    const rightX = pageW - margin;
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text('Étude posturale', rightX, 9, { align: 'right' });
    doc.setFontSize(7);
    doc.text(dateStr, rightX, 15, { align: 'right' });

    y = HDR_H + 8;
  };

  const newPage   = () => { doc.addPage(); drawHeader(); };
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
    [i18n.t('report.s4_pieds'),     data.piedAllure  ? i18n.t(`report.s4_${data.piedAllure}`)          : '—', data.piedNote],
    [i18n.t('report.s4_genoux'),    data.genouAllure ? i18n.t(`report.s4_${data.genouAllure}`)         : '—', data.genouNote],
    [i18n.t('report.s4_souplesse'), data.souplesseChaine ? i18n.t(`report.s4_${data.souplesseChaine}`) : '—', data.souplesseNote],
    [i18n.t('report.s4_squat'),     data.squat       ? i18n.t(`report.s4_${data.squat}`)              : '—', data.squatNote],
    [i18n.t('report.s4_fente'),     data.fente       ? i18n.t(`report.s4_${data.fente}`)              : '—', data.fenteNote],
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

  if (bikeImgDataUrl) {
    const imgW = pageW - margin * 2;
    const imgH = imgW * (bikeImgDataUrl.h / bikeImgDataUrl.w);
    needSpace(imgH + 6);
    try { doc.addImage(bikeImgDataUrl.dataUrl, 'PNG', margin, y, imgW, imgH); } catch { /* skip */ }
    y += imgH + 6;
  }

  doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
  doc.text(i18n.t('report.s6_cotes'), margin, y); y += 5;

  const coteRows: [string, string, string][] = [
    ['A', i18n.t('report.s6_cote_A'), data.cotesA],
    ['D', i18n.t('report.s6_cote_D'), data.cotesD],
    ['C', i18n.t('report.s6_cote_C'), data.cotesC],
    ['G', i18n.t('report.s6_cote_G'), data.cotesG],
    ['P', i18n.t('report.s6_cote_P'), data.cotesP],
    ['R', i18n.t('report.s6_cote_R'), data.cotesR],
    ['S', i18n.t('report.s6_cote_S'), data.cotesS],
    ['M', i18n.t('report.s6_cote_M'), data.cotesM],
  ];
  const rightRows: [string, string, string][] = [
    ['',  i18n.t('report.s6_cintre'),  ''],
    ['1', i18n.t('report.s6_cote_1'), data.cotes1],
    ['2', i18n.t('report.s6_cote_2'), data.cotes2],
    ['3', i18n.t('report.s6_cote_3'), data.cotes3],
    ['',  i18n.t('report.s6_potence'), ''],
    ['4', i18n.t('report.s6_cote_4'), data.cotes4],
    ['5', i18n.t('report.s6_cote_5'), data.cotes5],
  ];

  const halfW = (pageW - margin * 2) / 2 - 4;
  const refW = 12; const valW = 28;
  const desW = halfW - refW - valW;
  const col2x = margin + halfW + 8;

  const tableHeader = (x: number) => {
    doc.setFillColor(230, 230, 240);
    doc.rect(x, y - 4, halfW, 6, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
    doc.text(i18n.t('report.s6_ref'),         x + 2,           y);
    doc.text(i18n.t('report.s6_designation'), x + refW + 2,     y);
    doc.text(i18n.t('report.s6_valeur'),      x + refW + desW + 2, y);
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

  if (beforeCaps.length + afterCaps.length > 0) {
    newPage();
    section(i18n.t('report.s7_title'));

    const capColGap = 6;
    const capColW   = (pageW - margin * 2 - capColGap) / 2;
    const capImgH   = capColW * (9 / 16);
    const capImgGap = 3;
    const capCol2x  = margin + capColW + capColGap;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 80);
    if (beforeCaps.length > 0) doc.text('Avant', margin, y);
    if (afterCaps.length  > 0) doc.text('Après', capCol2x, y);
    y += 7;

    const capStartY = y;
    const renderCol = async (caps: Capture[], x: number): Promise<number> => {
      let cy = capStartY;
      for (const cap of caps) {
        if (cy + capImgH > pageH - margin) break;
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

  const slug    = [client?.nom, client?.prenom].filter(Boolean).join('_') || 'session';
  const discSlug = session?.discipline?.toUpperCase() || '';
  const prefix  = i18n.language === 'fr' ? 'Compte_rendu' : 'Report';
  doc.save(`${prefix}_${slug}${discSlug ? '_' + discSlug : ''}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
