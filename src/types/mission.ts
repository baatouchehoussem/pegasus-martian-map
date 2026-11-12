export type Coordinate = [number, number]; // longitude, latitude
export type LayerId = 'optical' | 'terrain' | 'weather' | 'mineral';
export type LayerState = Record<LayerId, { enabled: boolean; opacity: number }>;
export interface Waypoint { id: string; name: string; coordinates: Coordinate; elevation: number; type: 'base' | 'science' | 'custom'; priority: string; composition: string; hazards: string; image: string; imageCredit: string; description: string }
export interface Hazard { coordinates: Coordinate; radius: number; kind: 'boulder' | 'slope' | 'radiation'; severity: number }
export interface Zone { id: string; name: string; short: string; coordinates: Coordinate; subtitle: string; waypoints: Waypoint[]; hazards: Hazard[] }
export interface RouteMetrics { distance: number; gain: number; loss: number; slope: number; duration: number; oxygen: number; battery: number; dose: number }
