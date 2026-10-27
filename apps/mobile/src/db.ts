import type { CoverageModel, TrackPoint } from "@street-quest/geo";
import { coverageFromPoints } from "@street-quest/geo";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

type PointRow = TrackPoint & { synced: boolean };

type PointBackend = {
  ensureOwner(userId: string): Promise<void>;
  loadPoints(): Promise<TrackPoint[]>;
  lastPoint(): Promise<TrackPoint | null>;
  insertPoint(point: TrackPoint): Promise<void>;
  unsyncedPoints(): Promise<TrackPoint[]>;
  markSynced(clientIds: string[]): Promise<void>;
  pendingCount(): Promise<number>;
};

const WEB_POINTS = "streetquest.points";
const WEB_OWNER = "streetquest.owner";

function createWebBackend(): PointBackend {
  const read = (): PointRow[] => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(WEB_POINTS);
    if (!raw) return [];
    return JSON.parse(raw) as PointRow[];
  };
  const write = (rows: PointRow[]) => {
    window.localStorage.setItem(WEB_POINTS, JSON.stringify(rows));
  };
  const strip = (row: PointRow): TrackPoint => ({
    clientId: row.clientId,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    accuracyMeters: row.accuracyMeters,
    speedMps: row.speedMps,
    recordedAt: row.recordedAt,
  });

  return {
    async ensureOwner(userId) {
      const current = window.localStorage.getItem(WEB_OWNER);
      if (current === userId) return;
      window.localStorage.setItem(WEB_OWNER, userId);
      write([]);
    },
    async loadPoints() {
      return read()
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
        .map(strip);
    },
    async lastPoint() {
      const rows = read().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      const last = rows.at(-1);
      return last ? strip(last) : null;
    },
    async insertPoint(point) {
      const rows = read();
      if (rows.some((row) => row.clientId === point.clientId)) return;
      rows.push({ ...point, synced: false });
      write(rows);
    },
    async unsyncedPoints() {
      return read()
        .filter((row) => !row.synced)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
        .map(strip);
    },
    async markSynced(clientIds) {
      const ids = new Set(clientIds);
      write(read().map((row) => (ids.has(row.clientId) ? { ...row, synced: true } : row)));
    },
    async pendingCount() {
      return read().filter((row) => !row.synced).length;
    },
  };
}

async function createSqliteBackend(): Promise<PointBackend> {
  const db = await SQLite.openDatabaseAsync("streetquest.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS points (
      client_id TEXT PRIMARY KEY NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      accuracy_m REAL,
      speed_mps REAL,
      recorded_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const fromRow = (row: {
    client_id: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy_m: number | null;
    speed_mps: number | null;
    recorded_at: string;
  }): TrackPoint => ({
    clientId: row.client_id,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    accuracyMeters: row.accuracy_m,
    speedMps: row.speed_mps,
    recordedAt: row.recorded_at,
  });

  return {
    async ensureOwner(userId) {
      const current = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'owner'");
      if (current?.value === userId) return;
      await db.execAsync("DELETE FROM points");
      await db.runAsync(
        "INSERT INTO meta (key, value) VALUES ('owner', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        userId,
      );
    },
    async loadPoints() {
      const rows = await db.getAllAsync<{
        client_id: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        accuracy_m: number | null;
        speed_mps: number | null;
        recorded_at: string;
      }>("SELECT * FROM points ORDER BY recorded_at ASC");
      return rows.map(fromRow);
    },
    async lastPoint() {
      const row = await db.getFirstAsync<{
        client_id: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        accuracy_m: number | null;
        speed_mps: number | null;
        recorded_at: string;
      }>("SELECT * FROM points ORDER BY recorded_at DESC LIMIT 1");
      return row ? fromRow(row) : null;
    },
    async insertPoint(point) {
      await db.runAsync(
        `INSERT INTO points (client_id, latitude, longitude, altitude, accuracy_m, speed_mps, recorded_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(client_id) DO NOTHING`,
        point.clientId,
        point.latitude,
        point.longitude,
        point.altitude,
        point.accuracyMeters,
        point.speedMps,
        point.recordedAt,
      );
    },
    async unsyncedPoints() {
      const rows = await db.getAllAsync<{
        client_id: string;
        latitude: number;
        longitude: number;
        altitude: number | null;
        accuracy_m: number | null;
        speed_mps: number | null;
        recorded_at: string;
      }>("SELECT * FROM points WHERE synced = 0 ORDER BY recorded_at ASC");
      return rows.map(fromRow);
    },
    async markSynced(clientIds) {
      for (let offset = 0; offset < clientIds.length; offset += 200) {
        const chunk = clientIds.slice(offset, offset + 200);
        const marks = chunk.map(() => "?").join(", ");
        await db.runAsync(`UPDATE points SET synced = 1 WHERE client_id IN (${marks})`, ...chunk);
      }
    },
    async pendingCount() {
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM points WHERE synced = 0",
      );
      return row?.count ?? 0;
    },
  };
}

let backendPromise: Promise<PointBackend> | null = null;

function backend(): Promise<PointBackend> {
  if (!backendPromise) {
    backendPromise =
      Platform.OS === "web" ? Promise.resolve(createWebBackend()) : createSqliteBackend();
  }
  return backendPromise;
}

export async function ensureOwner(userId: string): Promise<void> {
  const store = await backend();
  await store.ensureOwner(userId);
}

export async function loadPoints(): Promise<TrackPoint[]> {
  return (await backend()).loadPoints();
}

export async function lastPoint(): Promise<TrackPoint | null> {
  return (await backend()).lastPoint();
}

export async function insertPoint(point: TrackPoint): Promise<void> {
  return (await backend()).insertPoint(point);
}

export async function unsyncedPoints(): Promise<TrackPoint[]> {
  return (await backend()).unsyncedPoints();
}

export async function markSynced(clientIds: string[]): Promise<void> {
  return (await backend()).markSynced(clientIds);
}

export async function pendingCount(): Promise<number> {
  return (await backend()).pendingCount();
}

export async function localCoverage(): Promise<CoverageModel & { pending: number; points: TrackPoint[] }> {
  const store = await backend();
  const [points, pending] = await Promise.all([store.loadPoints(), store.pendingCount()]);
  return { ...coverageFromPoints(points), pending, points };
}
