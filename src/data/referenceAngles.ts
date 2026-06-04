import type { Discipline } from '../types';

export interface ReferenceRange {
  min: number;
  max: number;
  approx?: boolean; // true when source value was "~"
}

// null = not applicable for this discipline
export type ReferenceValue = ReferenceRange | null;

export interface ReferenceRow {
  key: string; // maps to guide.<key> in i18n
  route: ReferenceValue;
  gravel: ReferenceValue;
  clm: ReferenceValue;
  vtt: ReferenceValue;
  /** shown as a note below the label (e.g. "endurance" variant info) */
  noteKey?: string;
  /** qualitative check — no range comparison, shown as a reminder row */
  isCheck?: boolean;
}

export const REFERENCE_ROWS: ReferenceRow[] = [
  {
    key: 'kneeExtension',
    route:  { min: 139, max: 145 },
    gravel: { min: 139, max: 145 },
    clm:    { min: 139, max: 145 },
    vtt:    { min: 139, max: 145 },
  },
  {
    key: 'ankleExtension',
    route:  { min: 125, max: 130 },
    gravel: { min: 125, max: 130 },
    clm:    { min: 125, max: 130 },
    vtt:    { min: 95,  max: 110 },
  },
  {
    key: 'ankleKneeFlex',
    noteKey: 'ankleKneeFlexNote',
    route:  { min: 105, max: 115, approx: true },
    gravel: { min: 105, max: 115, approx: true },
    clm:    { min: 105, max: 115, approx: true },
    vtt:    { min: 75,  max: 85 },
  },
  {
    key: 'hipAngle',
    noteKey: 'hipAngleNote',
    route:  { min: 55, max: 62 },
    gravel: { min: 55, max: 62 },
    clm:    { min: 30, max: 40 },
    vtt:    { min: 57, max: 63, approx: true },
  },
  {
    key: 'trunkAngle',
    noteKey: 'trunkAngleNote',
    route:  { min: 40, max: 45 },
    gravel: { min: 40, max: 45 },
    clm:    { min: 25, max: 35 },
    vtt:    null,
  },
  {
    key: 'shoulderAngle',
    noteKey: 'shoulderAngleNote',
    route:  { min: 85, max: 90 },
    gravel: { min: 85, max: 90 },
    clm:    { min: 87, max: 93, approx: true },
    vtt:    { min: 75, max: 85 },
  },
  {
    key: 'elbowAngle',
    route:  { min: 155, max: 165, approx: true },
    gravel: { min: 155, max: 165, approx: true },
    clm:    { min: 85,  max: 95, approx: true },
    vtt:    { min: 155, max: 165, approx: true },
  },
  {
    key: 'tibialAlignment',
    route:  null,
    gravel: null,
    clm:    null,
    vtt:    null,
    isCheck: true,
  },
];

export function getRange(row: ReferenceRow, discipline: Discipline): ReferenceValue {
  return row[discipline];
}

export type AngleStatus = 'ok' | 'warn' | 'error';

export function getStatus(value: number, range: ReferenceRange): AngleStatus {
  if (value >= range.min && value <= range.max) return 'ok';
  const margin = 5;
  if (value >= range.min - margin && value <= range.max + margin) return 'warn';
  return 'error';
}

/** For a given row key, returns the measured angle element closest to the range centre + its status */
export function findBestAngleForRow(
  rowKey: string,
  discipline: Discipline,
  angles: { id: string; angle: number; color: string }[],
): { id: string; angle: number; color: string; status: AngleStatus } | null {
  const row = REFERENCE_ROWS.find(r => r.key === rowKey);
  if (!row) return null;
  const range = getRange(row, discipline);
  if (!range) return null;
  const centre = (range.min + range.max) / 2;
  let best: { id: string; angle: number; color: string; dist: number } | null = null;
  for (const el of angles) {
    const dist = Math.abs(el.angle - centre);
    if (!best || dist < best.dist) best = { ...el, dist };
  }
  if (!best) return null;
  return { id: best.id, angle: best.angle, color: best.color, status: getStatus(best.angle, range) };
}

