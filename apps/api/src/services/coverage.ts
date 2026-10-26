import {
  cellFor,
  coverageFromPoints,
  decorateCell,
  filterTrack,
  H3_RESOLUTION,
  type BBox,
  type CoverageCell,
  type CoverageModel,
  type TrackPoint,
} from "@street-quest/geo";
import type { PoolClient } from "pg";
import { withTransaction } from "../db/pool";

const FUTURE_SKEW_MS = 5 * 60 * 1000;

type PointRow = {
  client_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy_m: number | null;
  speed_mps: number | null;
  recorded_at: Date | string;
};

export type IngestResult = {
  accepted: number;
  rejected: number;
  duplicates: number;
  cellCount: number;
  durationSeconds: number;
};

function rowToPoint(row: PointRow): TrackPoint {
  return {
    clientId: row.client_id,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    accuracyMeters: row.accuracy_m,
    speedMps: row.speed_mps,
    recordedAt: new Date(row.recorded_at).toISOString(),
  };
}

function plausible(point: TrackPoint): boolean {
  const recorded = Date.parse(point.recordedAt);
  return Number.isFinite(recorded) && recorded <= Date.now() + FUTURE_SKEW_MS;
}

export async function ingestPoints(userId: string, incoming: TrackPoint[]): Promise<IngestResult> {
  return withTransaction(async (client) => {
    const anchorResult = await client.query<PointRow>(
      `SELECT client_id, latitude, longitude, altitude, accuracy_m, speed_mps, recorded_at
       FROM location_points
       WHERE user_id = $1
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
      [userId],
    );
    const anchor = anchorResult.rows[0] ? rowToPoint(anchorResult.rows[0]) : undefined;
    const candidates = incoming.filter(plausible);
    const filtered = filterTrack(anchor ? [anchor, ...candidates] : candidates);
    const anchorWasResent = anchor != null && incoming.some((point) => point.clientId === anchor.clientId);
    const fresh = filtered.kept.filter((point) => point.clientId !== anchor?.clientId);
    const seen = new Set<string>();
    const unique: TrackPoint[] = [];
    let repeated = 0;
    for (const point of fresh) {
      if (seen.has(point.clientId)) {
        repeated += 1;
        continue;
      }
      seen.add(point.clientId);
      unique.push(point);
    }
    const inserted = await insertPoints(client, userId, unique);
    const model = inserted > 0 ? await recomputeCoverage(client, userId) : await readStats(client, userId);
    return {
      accepted: inserted,
      rejected: incoming.length - fresh.length - (anchorWasResent ? 1 : 0),
      duplicates: repeated + (unique.length - inserted) + (anchorWasResent ? 1 : 0),
      cellCount: model.cellCount,
      durationSeconds: model.durationSeconds,
    };
  });
}

async function insertPoints(client: PoolClient, userId: string, points: TrackPoint[]): Promise<number> {
  let inserted = 0;
  for (let offset = 0; offset < points.length; offset += 200) {
    const chunk = points.slice(offset, offset + 200);
    const values: unknown[] = [];
    const rows = chunk.map((point, index) => {
      const base = index * 10;
      const h3Index = cellFor(point.latitude, point.longitude, H3_RESOLUTION);
      values.push(
        userId,
        point.clientId,
        point.recordedAt,
        point.latitude,
        point.longitude,
        point.altitude,
        point.accuracyMeters,
        point.speedMps,
        h3Index,
        H3_RESOLUTION,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, ST_SetSRID(ST_MakePoint($${base + 5}, $${base + 4}), 4326))`;
    });
    const result = await client.query(
      `INSERT INTO location_points (
         user_id, client_id, recorded_at, latitude, longitude, altitude, accuracy_m, speed_mps, h3_index, resolution, geom
       ) VALUES ${rows.join(", ")}
       ON CONFLICT (user_id, client_id) DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function recomputeCoverage(
  client: PoolClient,
  userId: string,
): Promise<{ cellCount: number; durationSeconds: number }> {
  const points = await client.query<PointRow>(
    `SELECT client_id, latitude, longitude, altitude, accuracy_m, speed_mps, recorded_at
     FROM location_points
     WHERE user_id = $1
     ORDER BY recorded_at ASC, id ASC`,
    [userId],
  );
  const model = coverageFromPoints(points.rows.map(rowToPoint));
  await client.query("DELETE FROM user_coverage_cells WHERE user_id = $1", [userId]);
  await insertCells(client, userId, model.cells);
  await writeStats(client, userId, model);
  return { cellCount: model.cells.length, durationSeconds: model.durationSeconds };
}

async function insertCells(client: PoolClient, userId: string, cells: CoverageCell[]): Promise<void> {
  if (cells.length === 0) return;
  await client.query(
    `INSERT INTO user_coverage_cells (
       user_id, h3_index, resolution, duration_seconds, visit_count, point_count,
       first_seen, last_seen, kind, centroid, cell_geom
     )
     SELECT
       $1::uuid,
       h3,
       resolution,
       duration_seconds,
       visit_count,
       point_count,
       first_seen::timestamptz,
       last_seen::timestamptz,
       kind,
       ST_SetSRID(ST_MakePoint(lng, lat), 4326),
       ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326)
     FROM unnest(
       $2::text[],
       $3::int[],
       $4::float8[],
       $5::int[],
       $6::int[],
       $7::text[],
       $8::text[],
       $9::text[],
       $10::float8[],
       $11::float8[],
       $12::text[]
     ) AS t(
       h3, resolution, duration_seconds, visit_count, point_count,
       first_seen, last_seen, kind, lng, lat, geom
     )`,
    [
      userId,
      cells.map((cell) => cell.h3Index),
      cells.map((cell) => cell.resolution),
      cells.map((cell) => cell.durationSeconds),
      cells.map((cell) => cell.visitCount),
      cells.map((cell) => cell.pointCount),
      cells.map((cell) => cell.firstSeen),
      cells.map((cell) => cell.lastSeen),
      cells.map((cell) => cell.kind),
      cells.map((cell) => cell.centroid[0]),
      cells.map((cell) => cell.centroid[1]),
      cells.map((cell) =>
        JSON.stringify({ type: "Polygon", coordinates: [cell.polygon] }),
      ),
    ],
  );
}

async function writeStats(client: PoolClient, userId: string, model: CoverageModel): Promise<void> {
  const sojournCount = model.cells.filter((cell) => cell.kind === "sojourn").length;
  await client.query(
    `INSERT INTO user_stats (user_id, distance_meters, duration_seconds, cell_count, sojourn_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       distance_meters = EXCLUDED.distance_meters,
       duration_seconds = EXCLUDED.duration_seconds,
       cell_count = EXCLUDED.cell_count,
       sojourn_count = EXCLUDED.sojourn_count,
       updated_at = now()`,
    [userId, model.distanceMeters, model.durationSeconds, model.cells.length, sojournCount],
  );
}

async function readStats(
  client: PoolClient,
  userId: string,
): Promise<{ cellCount: number; durationSeconds: number }> {
  const result = await client.query<{ cell_count: number; duration_seconds: number }>(
    `SELECT cell_count, duration_seconds FROM user_stats WHERE user_id = $1`,
    [userId],
  );
  return {
    cellCount: result.rows[0]?.cell_count ?? 0,
    durationSeconds: result.rows[0]?.duration_seconds ?? 0,
  };
}

type CellRow = {
  h3_index: string;
  resolution: number;
  duration_seconds: number;
  visit_count: number;
  point_count: number;
  first_seen: Date;
  last_seen: Date;
  lng: number;
  lat: number;
  geom: string;
};

export async function trailInBBox(userId: string, bbox: BBox): Promise<TrackPoint[]> {
  const { getPool } = await import("../db/pool");
  const result = await getPool().query<PointRow>(
    `SELECT client_id, latitude, longitude, altitude, accuracy_m, speed_mps, recorded_at
     FROM location_points
     WHERE user_id = $1
       AND geom && ST_Expand(ST_MakeEnvelope($2, $3, $4, $5, 4326), 0.001)
     ORDER BY recorded_at ASC, id ASC
     LIMIT 8000`,
    [userId, bbox.west, bbox.south, bbox.east, bbox.north],
  );
  return result.rows.map(rowToPoint);
}

export async function coverageInBBox(userId: string, bbox: BBox): Promise<CoverageCell[]> {
  const { getPool } = await import("../db/pool");
  const result = await getPool().query<CellRow>(
    `SELECT h3_index, resolution, duration_seconds, visit_count, point_count, first_seen, last_seen,
            ST_X(centroid) AS lng, ST_Y(centroid) AS lat, ST_AsGeoJSON(cell_geom) AS geom
     FROM user_coverage_cells
     WHERE user_id = $1
       AND cell_geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
     ORDER BY duration_seconds DESC
     LIMIT 5000`,
    [userId, bbox.west, bbox.south, bbox.east, bbox.north],
  );
  return result.rows.map((row) => {
    const geometry = JSON.parse(row.geom) as { coordinates: [number, number][][] };
    const ring = geometry.coordinates[0] ?? [];
    return decorateCell({
      h3Index: row.h3_index,
      resolution: row.resolution,
      durationSeconds: row.duration_seconds,
      visitCount: row.visit_count,
      pointCount: row.point_count,
      firstSeen: new Date(row.first_seen).toISOString(),
      lastSeen: new Date(row.last_seen).toISOString(),
      centroid: [row.lng, row.lat],
      polygon: ring,
    });
  });
}

export async function coverageSummary(userId: string): Promise<{
  cellCount: number;
  durationSeconds: number;
  distanceMeters: number;
  sojournCount: number;
}> {
  const { getPool } = await import("../db/pool");
  const result = await getPool().query<{
    cell_count: number;
    duration_seconds: number;
    distance_meters: number;
    sojourn_count: number;
  }>(
    `SELECT cell_count, duration_seconds, distance_meters, sojourn_count
     FROM user_stats WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    cellCount: row?.cell_count ?? 0,
    durationSeconds: row?.duration_seconds ?? 0,
    distanceMeters: row?.distance_meters ?? 0,
    sojournCount: row?.sojourn_count ?? 0,
  };
}
