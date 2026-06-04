export type Point = { x: number; y: number };

export type Tool =
  | 'pan'
  | 'select'
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'angle'
  | 'eraser';

export interface PathElement {
  type: 'path';
  id: string;
  points: Point[];
  color: string;
  strokeWidth: number;
}
export interface LineElement {
  type: 'line';
  id: string;
  p1: Point;
  p2: Point;
  color: string;
  strokeWidth: number;
}
export interface ArrowElement {
  type: 'arrow';
  id: string;
  p1: Point;
  p2: Point;
  color: string;
  strokeWidth: number;
}
export interface RectElement {
  type: 'rect';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
  filled: boolean;
}
export interface EllipseElement {
  type: 'ellipse';
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  strokeWidth: number;
  filled: boolean;
}
export interface TextElement {
  type: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}
export interface AngleElement {
  type: 'angle';
  id: string;
  p0: Point;
  p1: Point; // vertex
  p2: Point;
  color: string;
  strokeWidth: number;
  angle: number; // degrees
}

export type AnnotationElement =
  | PathElement
  | LineElement
  | ArrowElement
  | RectElement
  | EllipseElement
  | TextElement
  | AngleElement;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  elements: AnnotationElement[];
}

export interface Recording {
  id: string;
  name: string;
  blob?: Blob;        // undefined for disk-backed recordings (loaded from filesystem)
  url: string;        // object URL (fresh) or localfile:// URL (disk-backed)
  createdAt: Date;
  duration: number;
}

export interface Capture {
  id: string;
  name: string;
  blob?: Blob;        // undefined for disk-backed captures (loaded from filesystem)
  url: string;        // object URL (fresh) or localfile:// URL (disk-backed)
  createdAt: Date;
  paneLabel?: string; // 'A' | 'B' | undefined (single mode)
}

export type AppMode = 'capture' | 'playback';

export type PaneSourceType = 'camera' | 'recording' | 'none';
export type PaneSource =
  | { type: 'camera'; deviceId: string }
  | { type: 'recording'; recording: Recording }
  | { type: 'none' };

export interface VideoConfig {
  deviceId: string;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  audioEnabled: boolean;
}

export type Discipline = 'route' | 'gravel' | 'clm' | 'vtt';

export interface Client {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  weight?: number;
  height?: number;
  createdAt: string;
  folderPath: string;
}

export interface Session {
  id: string;
  clientId: string;
  discipline: Discipline;
  bikeFitDate: string;
  notes?: string;
  createdAt: string;
  folderPath: string;
}

// ── Session state persistence ──────────────────────────────────────────────────
// Saved in <session>/session-state.json; blob/url are ephemeral and not stored.
export type SavedPaneSource =
  | { type: 'none' }
  | { type: 'camera'; deviceId: string }
  | { type: 'recording'; filename: string };

export interface SavedPaneState {
  source: SavedPaneSource;
  playbackTime: number;
  layers: Layer[];
  activeLayerId: string;
}

export interface PersistedSessionState {
  paneA: SavedPaneState;
  paneB: SavedPaneState;
}

export interface CompanySettings {
  name: string;
  subtitle: string;
  logoDataUrl: string; // base64 data URL (resized at pick time)
}

export const DEFAULT_COMPANY: CompanySettings = { name: '', subtitle: '', logoDataUrl: '' };

export interface ReportData {
  // Pratique
  practiceLevel: '' | 'loisir' | 'sport' | 'competition' | 'pro';
  practiceYears: string;
  weeklyVolume: string;
  annualVolume: string;
  // Diagnostic
  motif: string;
  douleurs: string;
  anciennesBlessures: string;
  blessuresRecentes: string;
  veloDepuis: string;
  veloPrecedent: string;
  autresSports: string;
  // Tests physios
  piedAllure: '' | 'neutre' | 'varus' | 'valgus';
  piedNote: string;
  genouAllure: '' | 'neutre' | 'dedans' | 'dehors';
  genouNote: string;
  souplesseChaine: '' | 'bonne' | 'moyenne' | 'limitee';
  souplesseNote: string;
  squat: '' | 'bon' | 'moyen' | 'compensations';
  squatNote: string;
  fente: '' | 'bonne' | 'moyenne' | 'asymetrique';
  fenteNote: string;
  // Bilan
  bilan: string;
  // Matériel
  veloModele: string;
  veloTaille: string;
  selleMateriel: string;
  pedales: string;
  chaussures: string;
  // Cotes (cm)
  cotesA: string; cotesD: string; cotesC: string; cotesG: string;
  cotesP: string; cotesR: string; cotesS: string; cotesM: string;
  cotes1: string; cotes2: string; cotes3: string;
  cotes4: string; cotes5: string;
  // Captures
  capturesBefore: string[];
  capturesAfter: string[];
}

export const DEFAULT_REPORT: ReportData = {
  practiceLevel: '', practiceYears: '', weeklyVolume: '', annualVolume: '',
  motif: '', douleurs: '', anciennesBlessures: '', blessuresRecentes: '',
  veloDepuis: '', veloPrecedent: '', autresSports: '',
  piedAllure: '', piedNote: '', genouAllure: '', genouNote: '',
  souplesseChaine: '', souplesseNote: '', squat: '', squatNote: '',
  fente: '', fenteNote: '',
  bilan: '',
  veloModele: '', veloTaille: '', selleMateriel: '', pedales: '', chaussures: '',
  cotesA: '', cotesD: '', cotesC: '', cotesG: '', cotesP: '', cotesR: '', cotesS: '', cotesM: '',
  cotes1: '', cotes2: '', cotes3: '', cotes4: '', cotes5: '',
  capturesBefore: [],
  capturesAfter: [],
};

export const RESOLUTIONS: Record<string, { width: number; height: number; label: string }> = {
  '480p':  { width: 854,  height: 480,  label: '480p  (854×480)' },
  '720p':  { width: 1280, height: 720,  label: '720p  (1280×720)' },
  '1080p': { width: 1920, height: 1080, label: '1080p (1920×1080)' },
  '1440p': { width: 2560, height: 1440, label: '1440p (2560×1440)' },
};

export const FRAMERATES = [24, 30, 60] as const;
