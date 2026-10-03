import type { LngLat } from './geo';

export interface RouteStep {
  instruction: string;
  street: string;
  distance_meters: number;
  duration_seconds: number;
  type: string;
  modifier: string;
  location: LngLat;
}

export interface RouteFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: LngLat[] };
  properties: { distance_meters: number; duration_seconds: number; steps: RouteStep[] };
}

/** Polish turn-by-turn text for an OSRM-style maneuver type/modifier. */
export function translateManeuver(type: string, modifier?: string, name?: string): string {
  const street = name && name.trim() ? `w ul. ${name.trim()}` : '';
  const streetTarget = name && name.trim() ? `ul. ${name.trim()}` : 'celu';

  switch (type) {
    case 'depart':
      return name && name.trim() ? `Ruszaj ${street}` : 'Rozpocznij marsz';
    case 'arrive':
      return modifier === 'left'
        ? 'Cel znajduje się po Twojej lewej stronie'
        : modifier === 'right'
        ? 'Cel znajduje się po Twojej prawej stronie'
        : 'Dotarłaś bezpiecznie do celu!';
    case 'turn':
    case 'end of road':
    case 'fork':
      if (modifier === 'left' || modifier === 'sharp left') return `Skręć w lewo ${street}`.trim();
      if (modifier === 'right' || modifier === 'sharp right') return `Skręć w prawo ${street}`.trim();
      if (modifier === 'slight left') return `Łagodnie w lewo ${street}`.trim();
      if (modifier === 'slight right') return `Łagodnie w prawo ${street}`.trim();
      return `Skręć ${street}`.trim();
    case 'continue':
    case 'new name':
      return name && name.trim() ? `Kontynuuj ${street}` : 'Idź dalej prosto';
    case 'roundabout':
    case 'rotary':
      return `Na rondzie kieruj się w stronę ${streetTarget}`;
    default:
      if (modifier === 'left') return `Skręć w lewo ${street}`.trim();
      if (modifier === 'right') return `Skręć w prawo ${street}`.trim();
      return name && name.trim() ? `Kieruj się ${street}` : 'Idź prosto';
  }
}
