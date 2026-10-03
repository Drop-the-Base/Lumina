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

export async function getRoutes(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<OsrmRoute[]> {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=3`;

  const { data } = await axios.get(url, { timeout: 8000 });

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM returned no routes');
  }

  return data.routes.map((route: any) => ({
    type: 'Feature',
    geometry: route.geometry,
    properties: {
      distance_meters: Math.round(route.distance),
      duration_seconds: Math.round(route.duration),
    },
  }));
}

export async function getRouteViaWaypoint(
  fromLng: number,
  fromLat: number,
  viaLng: number,
  viaLat: number,
  toLng: number,
  toLat: number
): Promise<OsrmRoute> {
  const coords = `${fromLng},${fromLat};${viaLng},${viaLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  const { data } = await axios.get(url, { timeout: 8000 });

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM returned no routes for waypoint path');
  }

  return {
    type: 'Feature',
    geometry: data.routes[0].geometry,
    properties: {
      distance_meters: Math.round(data.routes[0].distance),
      duration_seconds: Math.round(data.routes[0].duration),
    },
  };
}
