import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterTrack } from "./filter";
import { longMeadowRoam } from "./trace";
import { trailFromPoints } from "./trail";
import type { TrackPoint } from "./types";

describe("trailFromPoints", () => {
  it("draws the Long Meadow walk as connected street segments", () => {
    const segments = trailFromPoints(filterTrack(longMeadowRoam()).kept);
    assert.ok(segments.length > 20);
    const [firstLng, firstLat] = segments[0]!.coordinates[0];
    assert.ok(firstLat > 40.66 && firstLat < 40.68);
    assert.ok(firstLng < -73.96 && firstLng > -73.98);
    const dwell = segments.reduce((longest, segment) => Math.max(longest, segment.durationSeconds), 0);
    assert.ok(dwell >= 60);
    const brightest = segments.reduce((best, segment) => (segment.lineWidth > best.lineWidth ? segment : best));
    const dimmest = segments.reduce((best, segment) => (segment.lineWidth < best.lineWidth ? segment : best));
    assert.ok(brightest.lineWidth > dimmest.lineWidth);
  });

  it("does not connect a later trip across a long gap or a far jump", () => {
    const start = Date.parse("2026-06-14T14:00:00.000Z");
    const at = (seconds: number) => new Date(start + seconds * 1000).toISOString();
    const point = (id: string, latitude: number, longitude: number, seconds: number): TrackPoint => ({
      clientId: id,
      latitude,
      longitude,
      altitude: null,
      accuracyMeters: 5,
      speedMps: 1,
      recordedAt: at(seconds),
    });
    const segments = trailFromPoints([
      point("a", 40.66, -73.97, 0),
      point("b", 40.6601, -73.97, 10),
      point("c", 40.6601, -73.97, 800),
      point("d", 40.75, -73.97, 820),
    ]);
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.id, "a:b");
  });
});