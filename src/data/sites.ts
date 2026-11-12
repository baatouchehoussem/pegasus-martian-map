export type SiteId = 'sharp' | 'jezero';
export type LayerId = 'optical' | 'slope' | 'radiation' | 'spectral';

export interface LayerState {
  on: boolean;
  opacity: number;
}
export type Layers = Record<LayerId, LayerState>;

export interface RouteStats {
  distance: number; // metres
  gain: number; // metres
  loss: number; // metres
  maxSlope: number; // degrees
  duration: number; // hours
  o2: number; // % of suit supply
}

export interface Crater {
  x: number;
  z: number;
  r: number;
  d: number;
}

export interface Site {
  id: SiteId;
  name: string;
  region: string;
  lat: string;
  lon: string;
  note: string;
  terrain: SiteId;
  craters: Crater[];
  route: [number, number][];
  waypoints: string[];
  cam: { pos: [number, number, number]; target: [number, number, number] };
}

export const SIZE = 240; // terrain width in world units
export const WORLD_M = 10; // metres per horizontal unit
export const VERT_M = 4; // metres per vertical unit
export const SIM_SECONDS = 80; // length of the EVA animation

export const LAYER_IDS: LayerId[] = ['optical', 'slope', 'radiation', 'spectral'];

export const LAYER_META: Record<LayerId, { label: string; source: string; icon: string; color: string }> = {
  optical: { label: 'Optical Surface', source: 'HiRISE / CTX', icon: '◐', color: '#e0a070' },
  slope: { label: 'Slope Hazard', source: 'MOLA / HiRISE DEM', icon: '△', color: '#5fe08a' },
  radiation: { label: 'Radiation & Thermal', source: 'MSL RAD / THEMIS', icon: '☢', color: '#ffb347' },
  spectral: { label: 'Spectral Minerals', source: 'CRISM', icon: '✦', color: '#ff7ae0' },
};

export const DEFAULT_LAYERS: Layers = {
  optical: { on: true, opacity: 1 },
  slope: { on: false, opacity: 0.4 },
  radiation: { on: false, opacity: 0.45 },
  spectral: { on: false, opacity: 0.4 },
};

export const SITES: Record<SiteId, Site> = {
  sharp: {
    id: 'sharp',
    name: 'Mount Sharp',
    region: 'Gale Crater',
    lat: '-5.40° S',
    lon: '137.80° E',
    note: 'Aeolis Mons · Boxwork formations',
    terrain: 'sharp',
    craters: [
      { x: -35, z: 10, r: 14, d: 4 },
      { x: 30, z: 25, r: 10, d: 3 },
      { x: 55, z: -10, r: 18, d: 5 },
      { x: -60, z: -30, r: 9, d: 2.5 },
      { x: 10, z: 60, r: 7, d: 2 },
      { x: -10, z: -35, r: 12, d: 3 },
    ],
    route: [
      [-60, 70],
      [-38, 45],
      [-12, 30],
      [8, 8],
      [22, -14],
      [38, -38],
    ],
    waypoints: ['Hab Airlock', 'Dust Flats', 'Boxwork Gate', 'Sulfate Outcrop', 'Ridge Survey', 'Sample Cache'],
    cam: { pos: [-82, 26, 100], target: [0, 10, -20] },
  },
  jezero: {
    id: 'jezero',
    name: 'Jezero Crater',
    region: 'Isidis Planitia rim',
    lat: '18.44° N',
    lon: '77.45° E',
    note: 'Ancient river delta · Carbonates',
    terrain: 'jezero',
    craters: [
      { x: -45, z: 25, r: 11, d: 3 },
      { x: 40, z: 40, r: 8, d: 2 },
      { x: 55, z: -20, r: 14, d: 4 },
      { x: -65, z: -35, r: 8, d: 2 },
    ],
    route: [
      [-70, 70],
      [-45, 50],
      [-20, 28],
      [0, 5],
      [-15, -25],
      [-30, -50],
    ],
    waypoints: ['Landing Pad', 'Crater Floor', 'Regolith Lane', 'Delta Foot', 'Channel Cut', 'Delta Front'],
    cam: { pos: [62, 28, 96], target: [-10, 8, -20] },
  },
};
