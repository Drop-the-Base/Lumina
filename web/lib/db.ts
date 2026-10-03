import fs from 'fs';
import path from 'path';
import { supabaseServer } from './supabaseServer';
import seedData from '@/data/lumina_db.json';

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

export type ReportCategory = 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle';
export type ReportStatus = 'Active' | 'Resolved' | 'Shadowbanned';

export interface ReportRecord {
  report_id: string;
  author_id?: string;
  category: ReportCategory;
  description?: string;
  validation_count: number;
  status: ReportStatus;
  lat: number;
  lng: number;
  created_at: string;
}

export type Verdict = 'confirm' | 'deny';

export type SosTrigger =
  | 'Manual'
  | 'Accelerometer'
  | 'GPS_Deviation'
  | 'Timeout'
  | 'LowBattery'
  | 'DeadManSwitch';

/**
 * Where data actually lives:
 * - supabase: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (production)
 * - file:     local dev without Supabase, persisted to data/lumina_db.json
 * - memory:   serverless without Supabase — NOT persistent, reported to the client
 */
export type StorageMode = 'supabase' | 'file' | 'memory';

export function storageMode(): StorageMode {
  if (supabaseServer) return 'supabase';
  return process.env.VERCEL ? 'memory' : 'file';
}

export class DbError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

// ── Reputation (shadow trust metric) ─────────────────────────────────────────
// Users never see their score. Confirmations from trusted users raise the
// author's reputation, denials lower it; authors below the threshold get their
// reports silently shadowbanned so they no longer influence routing.
export const NEW_USER_REPUTATION = 0.5;
export const SHADOWBAN_THRESHOLD = 0.3;
const CONFIRM_BOOST = 0.1;
const DENY_PENALTY = 0.2;
/** A single (possibly fresh, throwaway) account must not be able to remove a report. */
const MIN_DENIES_TO_RESOLVE = 2;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface VoteRow {
  verdict: Verdict;
  voter_reputation: number;
}

function voteOutcome(authorReputation: number, votes: VoteRow[], previousCount: number, verdict: Verdict) {
  const confirms = votes.filter((v) => v.verdict === 'confirm');
  const confirmWeight = authorReputation + confirms.reduce((s, v) => s + v.voter_reputation, 0);
  const denies = votes.filter((v) => v.verdict === 'deny');
  const denyWeight = denies.reduce((s, v) => s + v.voter_reputation, 0);
  const resolved = denies.length >= MIN_DENIES_TO_RESOLVE && denyWeight > confirmWeight;

  return {
    // Incremented rather than recomputed: seeded/imported reports carry counts without vote rows
    validation_count: previousCount + (verdict === 'confirm' ? 1 : 0),
    status: (resolved ? 'Resolved' : 'Active') as ReportStatus,
  };
}

function authorDelta(verdict: Verdict, voterReputation: number) {
  return verdict === 'confirm' ? CONFIRM_BOOST * voterReputation : -DENY_PENALTY * voterReputation;
}

// ── Local fallback store (file in dev, memory on serverless) ─────────────────

interface LocalUser {
  reputation: number;
}

interface LocalSchema {
  places: PlaceRecord[];
  reports: ReportRecord[];
  users: Record<string, LocalUser>;
  votes: Record<string, VoteRow & { report_id: string; user_id: string }>;
  sos_events: Array<{ event_id: string; user_id?: string; trigger_type: SosTrigger; lat: number; lng: number; created_at: string }>;
}

const SEED_USERS: Record<string, LocalUser> = {
  '11111111-1111-1111-1111-111111111111': { reputation: 0.95 },
  '22222222-2222-2222-2222-222222222222': { reputation: 0.42 },
};

const dbFilePath = () => path.join(process.cwd(), 'data', 'lumina_db.json');

const globalStore = globalThis as unknown as { __luminaLocalDb?: LocalSchema };

function localDb(): LocalSchema {
  if (globalStore.__luminaLocalDb) return globalStore.__luminaLocalDb;

  // The statically imported seed is always bundled; in local dev the file on
  // disk may contain newer data written by saveLocal().
  let parsed = seedData as unknown as Partial<LocalSchema>;
  if (storageMode() === 'file') {
    try {
      parsed = JSON.parse(fs.readFileSync(dbFilePath(), 'utf-8'));
    } catch (err) {
      console.warn('[db] Could not read local DB file, using bundled seed:', err);
    }
  }

  globalStore.__luminaLocalDb = {
    places: Array.isArray(parsed.places) ? parsed.places : [],
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    users: { ...SEED_USERS, ...(parsed.users || {}) },
    votes: parsed.votes || {},
    sos_events: Array.isArray(parsed.sos_events) ? parsed.sos_events : [],
  };
  return globalStore.__luminaLocalDb;
}

function saveLocal() {
  if (storageMode() !== 'file') return;
  const file = dbFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Errors propagate on purpose: a failed write must not be reported as saved.
  fs.writeFileSync(file, JSON.stringify(localDb(), null, 2), 'utf-8');
}

function localReputation(userId?: string): number {
  if (!userId) return NEW_USER_REPUTATION;
  const db = localDb();
  if (!db.users[userId]) db.users[userId] = { reputation: NEW_USER_REPUTATION };
  return db.users[userId].reputation;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Supabase helpers ─────────────────────────────────────────────────────────

function sb() {
  return supabaseServer!;
}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[db] ${what} failed:`, res.error);
    throw new DbError(`${what} failed: ${res.error.message}`);
  }
  return res.data;
}

/** Like check(), for queries that must return a row. */
function checkOne<T>(res: { data: T; error: { message: string; code?: string } | null }, what: string): NonNullable<T> {
  const data = check(res, what);
  if (data === null || data === undefined) throw new DbError(`${what} failed: no row returned`);
  return data as NonNullable<T>;
}

async function ensureUser(userId: string): Promise<number> {
  const existing = check(
    await sb().from('users').select('reputation_score').eq('user_id', userId).maybeSingle(),
    'Load user'
  );
  if (existing) return existing.reputation_score;

  check(
    await sb()
      .from('users')
      .upsert({ user_id: userId, reputation_score: NEW_USER_REPUTATION }, { onConflict: 'user_id', ignoreDuplicates: true }),
    'Create user'
  );
  return NEW_USER_REPUTATION;
}

const REPORT_COLUMNS = 'report_id, author_id, category, description, validation_count, status, created_at, lat, lng';

function toReport(row: any): ReportRecord {
  return {
    report_id: row.report_id,
    author_id: row.author_id ?? undefined,
    category: row.category,
    description: row.description ?? undefined,
    validation_count: row.validation_count ?? 0,
    status: row.status,
    lat: Number(row.lat),
    lng: Number(row.lng),
    created_at: row.created_at,
  };
}

const wktPoint = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;

// ── Places ───────────────────────────────────────────────────────────────────

export async function getPlaces(): Promise<PlaceRecord[]> {
  if (storageMode() !== 'supabase') return localDb().places;

  const rows = check(
    await sb().from('places').select('*').order('created_at', { ascending: false }),
    'Load places'
  );
  return (rows || []).map((p: any) => ({ ...p, address: p.address ?? '', icon: p.icon ?? undefined }));
}

export async function addPlace(
  place: Omit<PlaceRecord, 'id' | 'created_at'>,
  ownerId?: string
): Promise<PlaceRecord> {
  if (storageMode() !== 'supabase') {
    const newPlace: PlaceRecord = { ...place, id: newId('place'), created_at: new Date().toISOString() };
    const db = localDb();
    db.places = [newPlace, ...db.places];
    saveLocal();
    return newPlace;
  }

  if (isUuid(ownerId)) await ensureUser(ownerId);
  const row = checkOne(
    await sb()
      .from('places')
      .insert({ ...place, owner_id: isUuid(ownerId) ? ownerId : null })
      .select('*')
      .single(),
    'Save place'
  );
  return row as PlaceRecord;
}

export async function deletePlace(id: string): Promise<boolean> {
  if (storageMode() !== 'supabase') {
    const db = localDb();
    const before = db.places.length;
    db.places = db.places.filter((p) => p.id !== id);
    if (db.places.length === before) return false;
    saveLocal();
    return true;
  }

  const rows = check(await sb().from('places').delete().eq('id', id).select('id'), 'Delete place');
  return (rows || []).length > 0;
}

// ── Reports ──────────────────────────────────────────────────────────────────

/** Active reports only — shadowbanned/resolved ones never reach the map or the router. */
export async function getReports(): Promise<ReportRecord[]> {
  if (storageMode() !== 'supabase') return localDb().reports.filter((r) => r.status === 'Active');

  const rows = check(
    await sb()
      .from('reports_with_coords')
      .select(REPORT_COLUMNS)
      .eq('status', 'Active')
      .order('created_at', { ascending: false }),
    'Load reports'
  );
  return (rows || []).map(toReport);
}

export async function addReport(input: {
  lat: number;
  lng: number;
  category: ReportCategory;
  description?: string;
  author_id?: string;
}): Promise<ReportRecord> {
  const authorId = isUuid(input.author_id) ? input.author_id : undefined;

  if (storageMode() !== 'supabase') {
    const reputation = localReputation(authorId);
    const report: ReportRecord = {
      report_id: newId('rep'),
      author_id: authorId,
      category: input.category,
      description: input.description,
      validation_count: 1,
      status: reputation < SHADOWBAN_THRESHOLD ? 'Shadowbanned' : 'Active',
      lat: input.lat,
      lng: input.lng,
      created_at: new Date().toISOString(),
    };
    const db = localDb();
    db.reports = [report, ...db.reports];
    saveLocal();
    return report;
  }

  const reputation = authorId ? await ensureUser(authorId) : NEW_USER_REPUTATION;
  const inserted = checkOne(
    await sb()
      .from('reports')
      .insert({
        author_id: authorId ?? null,
        location: wktPoint(input.lat, input.lng),
        category: input.category,
        description: input.description ?? null,
        validation_count: 1,
        status: reputation < SHADOWBAN_THRESHOLD ? 'Shadowbanned' : 'Active',
      })
      .select('report_id')
      .single(),
    'Save report'
  );

  const row = checkOne(
    await sb().from('reports_with_coords').select(REPORT_COLUMNS).eq('report_id', inserted.report_id).single(),
    'Load saved report'
  );
  return toReport(row);
}

export async function voteReport(reportId: string, userId: string, verdict: Verdict): Promise<ReportRecord> {
  if (!isUuid(userId)) throw new DbError('Invalid user id', 400);

  if (storageMode() !== 'supabase') {
    const db = localDb();
    const report = db.reports.find((r) => r.report_id === reportId);
    if (!report || report.status !== 'Active') throw new DbError('Zgłoszenie nie istnieje lub zostało zamknięte', 404);
    if (report.author_id === userId) throw new DbError('Nie możesz oceniać własnego zgłoszenia', 403);

    const key = `${reportId}:${userId}`;
    if (db.votes[key]) throw new DbError('Już oceniłaś to zgłoszenie', 409);

    const voterRep = localReputation(userId);
    db.votes[key] = { report_id: reportId, user_id: userId, verdict, voter_reputation: voterRep };

    const authorRep = report.author_id
      ? (db.users[report.author_id] = {
          reputation: clamp01(localReputation(report.author_id) + authorDelta(verdict, voterRep)),
        }).reputation
      : NEW_USER_REPUTATION;

    const votes = Object.values(db.votes).filter((v) => v.report_id === reportId);
    Object.assign(report, voteOutcome(authorRep, votes, report.validation_count, verdict));

    if (report.author_id && authorRep < SHADOWBAN_THRESHOLD) {
      db.reports
        .filter((r) => r.author_id === report.author_id && r.status === 'Active')
        .forEach((r) => (r.status = 'Shadowbanned'));
    }
    saveLocal();
    return report;
  }

  const report = check(
    await sb().from('reports_with_coords').select(REPORT_COLUMNS).eq('report_id', reportId).maybeSingle(),
    'Load report'
  );
  if (!report || report.status !== 'Active') throw new DbError('Zgłoszenie nie istnieje lub zostało zamknięte', 404);
  if (report.author_id === userId) throw new DbError('Nie możesz oceniać własnego zgłoszenia', 403);

  const voterRep = await ensureUser(userId);
  const voteRes = await sb()
    .from('report_votes')
    .insert({ report_id: reportId, user_id: userId, verdict, voter_reputation: voterRep });
  if (voteRes.error?.code === '23505') throw new DbError('Już oceniłaś to zgłoszenie', 409);
  check(voteRes, 'Save vote');

  let authorRep = NEW_USER_REPUTATION;
  if (report.author_id) {
    authorRep = clamp01((await ensureUser(report.author_id)) + authorDelta(verdict, voterRep));
    check(
      await sb().from('users').update({ reputation_score: authorRep }).eq('user_id', report.author_id),
      'Update reputation'
    );
  }

  const votes = check(
    await sb().from('report_votes').select('verdict, voter_reputation').eq('report_id', reportId),
    'Load votes'
  ) as VoteRow[];
  const outcome = voteOutcome(authorRep, votes, report.validation_count ?? 0, verdict);
  check(await sb().from('reports').update(outcome).eq('report_id', reportId), 'Update report');

  if (report.author_id && authorRep < SHADOWBAN_THRESHOLD) {
    check(
      await sb()
        .from('reports')
        .update({ status: 'Shadowbanned' })
        .eq('author_id', report.author_id)
        .eq('status', 'Active'),
      'Shadowban author'
    );
  }

  // Non-critical bookkeeping
  await sb().rpc('increment_validated', { uid: userId });

  return toReport({ ...report, ...outcome });
}

// ── SOS ──────────────────────────────────────────────────────────────────────

export async function recordSos(event: {
  user_id?: string;
  trigger_type: SosTrigger;
  lat: number;
  lng: number;
  dispatched_via: 'API' | 'SMS';
  contacts_notified: number;
}): Promise<string> {
  const userId = isUuid(event.user_id) ? event.user_id : undefined;

  if (storageMode() !== 'supabase') {
    const id = newId('sos');
    localDb().sos_events.push({
      event_id: id,
      user_id: userId,
      trigger_type: event.trigger_type,
      lat: event.lat,
      lng: event.lng,
      created_at: new Date().toISOString(),
    });
    saveLocal();
    return id;
  }

  if (userId) await ensureUser(userId);
  const row = checkOne(
    await sb()
      .from('sos_events')
      .insert({
        user_id: userId ?? null,
        trigger_type: event.trigger_type,
        location: wktPoint(event.lat, event.lng),
        dispatched_via: event.dispatched_via,
        contacts_notified: event.contacts_notified,
      })
      .select('event_id')
      .single(),
    'Save SOS event'
  );
  return row.event_id;
}
