import axios from 'axios';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

interface OsrmRoute {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    distance_meters: number;
    duration_seconds: number;
  };
}

export async function getRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  via?: [number, number]
): Promise<OsrmRoute> {
  let coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  if (via) {
    coords = `${fromLng},${fromLat};${via[0]},${via[1]};${toLng},${toLat}`;
  }

  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  const { data } = await axios.get(url, { timeout: 8000 });

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM returned no routes');
  }

  const route = data.routes[0];

  return {
    type: 'Feature',
    geometry: route.geometry,
    properties: {
      distance_meters: Math.round(route.distance),
      duration_seconds: Math.round(route.duration),
    },
  };
}
