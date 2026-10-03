import fs from 'fs';
import path from 'path';

export interface PlaceRecord {
  id: string;
  name: string;
  category: 'Police' | 'SafeHaven' | 'Personal' | 'Medical';
  address: string;
  lat: number;
  lng: number;
  icon?: string;
  created_at: string;
}

export interface ReportRecord {
  report_id: string;
  author_id?: string;
  category: 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle';
  description?: string;
  validation_count: number;
  status: 'Active' | 'Resolved' | 'Shadowbanned';
  lat: number;
  lng: number;
  created_at: string;
}

interface DatabaseSchema {
  places: PlaceRecord[];
  reports: ReportRecord[];
}

function getDbFilePath(): string {
  const candidates = [
    path.resolve(__dirname, '../../../data/lumina_db.json'),
    path.resolve(process.cwd(), 'data/lumina_db.json'),
    path.resolve(process.cwd(), '../data/lumina_db.json'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  const fallback = candidates[0];
  const dir = path.dirname(fallback);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fallback;
}

export function readDb(): DatabaseSchema {
  try {
    const filePath = getDbFilePath();
    if (!fs.existsSync(filePath)) {
      return { places: [], reports: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db file in backend:', err);
    return { places: [], reports: [] };
  }
}

export function writeDb(data: DatabaseSchema): void {
  try {
    const filePath = getDbFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db file in backend:', err);
  }
}

export function getLocalPlaces(): PlaceRecord[] {
  return readDb().places;
}

export function addLocalPlace(place: Omit<PlaceRecord, 'id' | 'created_at'>): PlaceRecord {
  const db = readDb();
  const newPlace: PlaceRecord = {
    ...place,
    id: 'place_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    created_at: new Date().toISOString(),
  };
  db.places = [newPlace, ...db.places];
  writeDb(db);
  return newPlace;
}

export function deleteLocalPlace(id: string): boolean {
  const db = readDb();
  const len = db.places.length;
  db.places = db.places.filter((p) => p.id !== id);
  if (db.places.length !== len) {
    writeDb(db);
    return true;
  }
  return false;
}

export function getLocalReports(): ReportRecord[] {
  return readDb().reports.filter((r) => r.status === 'Active');
}

export function addLocalReport(report: Omit<ReportRecord, 'report_id' | 'created_at' | 'validation_count' | 'status'> & { author_id?: string; status?: ReportRecord['status'] }): ReportRecord {
  const db = readDb();
  const newReport: ReportRecord = {
    report_id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    author_id: report.author_id,
    category: report.category,
    description: report.description,
    validation_count: 1,
    status: report.status || 'Active',
    lat: report.lat,
    lng: report.lng,
    created_at: new Date().toISOString(),
  };
  db.reports = [newReport, ...db.reports];
  writeDb(db);
  return newReport;
}
