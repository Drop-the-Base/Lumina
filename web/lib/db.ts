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
  const primary = path.join(process.cwd(), 'data', 'lumina_db.json');
  if (fs.existsSync(primary)) return primary;

  const parent = path.join(process.cwd(), '..', 'data', 'lumina_db.json');
  if (fs.existsSync(parent)) return parent;

  const dir = path.dirname(primary);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return primary;
}

const DEFAULT_DB: DatabaseSchema = {
  places: [
    {
      id: 'sh_police_1',
      name: 'Komisariat I Policji w Krakowie',
      category: 'Police',
      address: 'ul. Szeroka 35',
      lat: 50.0515,
      lng: 19.9480,
      icon: '🚓',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_police_2',
      name: 'Komisariat II Policji w Krakowie',
      category: 'Police',
      address: 'ul. Radziwiłłowska 18',
      lat: 50.0635,
      lng: 19.9470,
      icon: '🚓',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_haven_1',
      name: 'Kawiarnia "Safe Haven" (Akcja Ask for Angela)',
      category: 'SafeHaven',
      address: 'ul. Floriańska 22',
      lat: 50.0625,
      lng: 19.9395,
      icon: '🛡️',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_haven_2',
      name: 'Pub Oaza (Bezpieczny Punkt Schronienia)',
      category: 'SafeHaven',
      address: 'ul. Szewska 12',
      lat: 50.0620,
      lng: 19.9340,
      icon: '🛡️',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_medical_1',
      name: 'Całodobowy Punkt Medyczny & Apteka 24/7',
      category: 'Medical',
      address: 'ul. Basztowa 15',
      lat: 50.0650,
      lng: 19.9410,
      icon: '🏥',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_personal_1',
      name: 'Mój Dom (Bezpieczny Cel)',
      category: 'Personal',
      address: 'ul. Grodzka 10',
      lat: 50.0575,
      lng: 19.9380,
      icon: '🏠',
      created_at: new Date().toISOString(),
    },
    {
      id: 'sh_personal_2',
      name: 'Dom Mamy (Kasia)',
      category: 'Personal',
      address: 'ul. Karmelicka 14',
      lat: 50.0640,
      lng: 19.9310,
      icon: '❤️',
      created_at: new Date().toISOString(),
    },
  ],
  reports: [
    {
      report_id: 'rep_seed_1',
      author_id: '11111111-1111-1111-1111-111111111111',
      category: 'Suspicious Activity',
      description: 'Group of men following women near tram stop',
      validation_count: 4,
      status: 'Active',
      lat: 50.0570,
      lng: 19.9380,
      created_at: new Date().toISOString(),
    },
    {
      report_id: 'rep_seed_2',
      author_id: '11111111-1111-1111-1111-111111111111',
      category: 'Lighting Issue',
      description: 'Street lights broken for past 3 days',
      validation_count: 6,
      status: 'Active',
      lat: 50.0590,
      lng: 19.9395,
      created_at: new Date().toISOString(),
    },
    {
      report_id: 'rep_seed_3',
      author_id: '22222222-2222-2222-2222-222222222222',
      category: 'Obstacle',
      description: 'Construction blocking the sidewalk, forced into road',
      validation_count: 2,
      status: 'Active',
      lat: 50.0600,
      lng: 19.9360,
      created_at: new Date().toISOString(),
    },
    {
      report_id: 'rep_seed_4',
      author_id: '22222222-2222-2222-2222-222222222222',
      category: 'Suspicious Activity',
      description: 'Aggressive panhandling, feel unsafe',
      validation_count: 3,
      status: 'Active',
      lat: 50.0595,
      lng: 19.9390,
      created_at: new Date().toISOString(),
    },
    {
      report_id: 'rep_seed_5',
      author_id: '11111111-1111-1111-1111-111111111111',
      category: 'Lighting Issue',
      description: 'Entire alleyway is dark at night',
      validation_count: 5,
      status: 'Active',
      lat: 50.0630,
      lng: 19.9405,
      created_at: new Date().toISOString(),
    },
    {
      report_id: 'rep_seed_6',
      author_id: '22222222-2222-2222-2222-222222222222',
      category: 'Suspicious Activity',
      description: 'Someone was following me here last night',
      validation_count: 2,
      status: 'Active',
      lat: 50.0605,
      lng: 19.9340,
      created_at: new Date().toISOString(),
    },
  ],
};

export function readDb(): DatabaseSchema {
  try {
    const filePath = getDbFilePath();
    if (!fs.existsSync(filePath)) {
      writeDb(DEFAULT_DB);
      return DEFAULT_DB;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      places: Array.isArray(parsed.places) ? parsed.places : DEFAULT_DB.places,
      reports: Array.isArray(parsed.reports) ? parsed.reports : DEFAULT_DB.reports,
    };
  } catch (err) {
    console.error('Failed reading DB file, using default data:', err);
    return DEFAULT_DB;
  }
}

export function writeDb(data: DatabaseSchema): void {
  try {
    const filePath = getDbFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing DB file:', err);
  }
}

// Places CRUD
export function getPlaces(): PlaceRecord[] {
  return readDb().places;
}

export function addPlace(place: Omit<PlaceRecord, 'id' | 'created_at'>): PlaceRecord {
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

export function deletePlace(id: string): boolean {
  const db = readDb();
  const initialLen = db.places.length;
  db.places = db.places.filter(p => p.id !== id);
  if (db.places.length !== initialLen) {
    writeDb(db);
    return true;
  }
  return false;
}

// Reports CRUD
export function getReports(): ReportRecord[] {
  return readDb().reports.filter(r => r.status === 'Active');
}

export function addReport(report: Omit<ReportRecord, 'report_id' | 'created_at' | 'validation_count' | 'status'> & { author_id?: string; status?: ReportRecord['status'] }): ReportRecord {
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
