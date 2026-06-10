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
  | 'h-angle'
  | 'v-angle'
  | 'skeleton'
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

export interface HVAngleElement {
  type: 'hv-angle';
  id: string;
  p1: Point; // origin
  p2: Point; // end of measured line
  color: string;
  strokeWidth: number;
  angle: number; // degrees from fixed axis
  mode: 'h' | 'v'; // h = horizontal reference, v = vertical reference
}

/** Ordered list of skeleton joint keys — index = handle index */
export const SKELETON_KEYS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toes', 'head'] as const;
export type SkeletonKey = typeof SKELETON_KEYS[number];

export interface SkeletonElement {
  type: 'skeleton';
  id: string;
  color: string;
  strokeWidth: number;
  points: Record<SkeletonKey, Point>;
}

export type AnnotationElement =
  | PathElement
  | LineElement
  | ArrowElement
  | RectElement
  | EllipseElement
  | TextElement
  | AngleElement
  | HVAngleElement
  | SkeletonElement;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  elements: AnnotationElement[];
  coteKey?: string; // lien persistant vers une cote du guide (clé i18n guide.<key>)
}

export interface Recording {
  id: string;
  name: string;
  blob?: Blob;
  url: string;
  createdAt: Date;
  duration: number;
  filePath?: string;  // absolute path on disk (disk-backed only)
}

export interface Capture {
  id: string;
  name: string;
  blob?: Blob;
  url: string;
  createdAt: Date;
  paneLabel?: string;
  filePath?: string;  // absolute path on disk (disk-backed only)
}

export type AppMode = 'capture' | 'playback';

export type PaneSourceType = 'camera' | 'recording' | 'image' | 'none';
export type PaneSource =
  | { type: 'camera'; deviceId: string }
  | { type: 'recording'; recording: Recording }
  | { type: 'image'; capture: Capture }
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
  | { type: 'recording'; filename: string }
  | { type: 'image'; captureId: string };

export interface SavedPaneState {
  source: SavedPaneSource;
  playbackTime: number;
  layers: Layer[];
  activeLayerId: string;
}

export interface PersistedSessionState {
  paneA: SavedPaneState;
  paneB: SavedPaneState;
  /** Display-name overrides for captures and recordings (keyed by id). */
  mediaLabels?: {
    captures:   Record<string, string>;
    recordings: Record<string, string>;
  };
}

export interface CompanySettings {
  name: string;
  subtitle: string;
  email: string;
  phone: string;
  logoDataUrl: string; // base64 data URL (resized at pick time)
}

export const DEFAULT_COMPANY: CompanySettings = { name: '', subtitle: '', email: '', phone: '', logoDataUrl: '' };

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
