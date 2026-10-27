import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverageFromPoints } from "./aggregate";
import { SOJOURN_SECONDS } from "./constants";
import { filterTrack } from "./filter";
import { coverageIntensity } from "./glow";
import { cellFor } from "./h3";
import { longMeadowRoam } from "./trace";
import type { TrackPoint } from "./types";

const start = Date.parse("2026-06-14T14:00:00.000Z");

function point(partial: Partial<TrackPoint> & Pick<TrackPoint, "latitude" | "longitude" | "recordedAt">): TrackPoint {
  return {
    clientId: partial.clientId ?? partial.recordedAt,
    latitude: partial.latitude,
    longitude: partial.longitude,
    altitude: partial.altitude ?? 10,
    accuracyMeters: partial.accuracyMeters === undefined ? 5 : partial.accuracyMeters,
    speedMps: partial.speedMps ?? 1.2,
    recordedAt: partial.recordedAt,
  };
}

function at(seconds: number): string {
  return new Date(start + seconds * 1000).toISOString();
}

describe("filterTrack", () => {
  it("drops inaccurate fixes and keeps a clean one", () => {
    const result = filterTrack([
      point({ latitude: 40.66, longitude: -73.97, recordedAt: at(0), accuracyMeters: 48, clientId: "bad" }),
      point({ latitude: 40.66, longitude: -73.97, recordedAt: at(10), accuracyMeters: 8, clientId: "good" }),
    ]);
    assert.deepEqual(result.kept.map((item) => item.clientId), ["good"]);
    assert.equal(result.dropped[0]?.reason, "accuracy");
  });

  it("keeps a fix when accuracy is missing", () => {
    const result = filterTrack([
      point({ latitude: 40.66, longitude: -73.97, recordedAt: at(0), accuracyMeters: null }),
    ]);
    assert.equal(result.kept.length, 1);
  });

  it("drops a short teleport and keeps a later trip after a long gap", () => {
    const result = filterTrack([
      point({ latitude: 40.6657, longitude: -73.9702, recordedAt: at(0), clientId: "home" }),
      point({ latitude: 40.7, longitude: -73.97, recordedAt: at(5), clientId: "glitch" }),
      point({ latitude: 34.05, longitude: -118.25, recordedAt: at(3 * 60 * 60), clientId: "later" }),
      point({ latitude: 34.0502, longitude: -118.2502, recordedAt: at(3 * 60 * 60 + 20), clientId: "later-2" }),
    ]);
    assert.deepEqual(result.kept.map((item) => item.clientId), ["home", "later", "later-2"]);
    assert.equal(result.dropped[0]?.reason, "teleport");
  });

  it("suppresses stationary noise and keeps a one-minute heartbeat", () => {
    const result = filterTrack([
      point({ latitude: 40.66572, longitude: -73.97016, recordedAt: at(0), speedMps: 0, clientId: "a" }),
      point({ latitude: 40.66573, longitude: -73.97016, recordedAt: at(15), speedMps: 0, clientId: "noise" }),
      point({ latitude: 40.66572, longitude: -73.97016, recordedAt: at(60), speedMps: 0, clientId: "beat" }),
    ]);
    assert.deepEqual(result.kept.map((item) => item.clientId), ["a", "beat"]);
    assert.equal(result.dropped[0]?.reason, "stationary");
  });

  it("keeps the Long Meadow roam intact", () => {
    const roam = longMeadowRoam();
    const result = filterTrack(roam);
    assert.equal(result.dropped.length, 0);
    assert.equal(result.kept.length, roam.length);
    assert.ok(roam.length > 40);
  });
});

describe("coverageFromPoints", () => {
  it("adds residence time only inside a cell and splits visits across a long gap", () => {
    const latitude = 40.66572;
    const longitude = -73.97016;
    const model = coverageFromPoints([
      point({ latitude, longitude, recordedAt: at(0), clientId: "1" }),
      point({ latitude, longitude, recordedAt: at(60), clientId: "2" }),
      point({ latitude, longitude, recordedAt: at(120), clientId: "3" }),
      point({ latitude, longitude, recordedAt: at(120 + 700), clientId: "4" }),
    ]);
    assert.equal(model.cells.length, 1);
    assert.equal(model.cells[0]?.durationSeconds, 120);
    assert.equal(model.cells[0]?.visitCount, 2);
    assert.equal(model.cells[0]?.polygon[0]?.join(","), model.cells[0]?.polygon.at(-1)?.join(","));
  });

  it("lights a sojourn in the meadow more than a street passage", () => {
    const model = coverageFromPoints(filterTrack(longMeadowRoam()).kept);
    const sojourns = model.cells.filter((cell) => cell.kind === "sojourn");
    const passages = model.cells.filter((cell) => cell.kind === "passage");
    assert.ok(sojourns.length >= 1);
    assert.ok(passages.length >= 1);
    const meadow = cellFor(40.66572, -73.97016);
    const brightest = sojourns[0];
    assert.equal(brightest?.h3Index, meadow);
    assert.ok((brightest?.durationSeconds ?? 0) >= SOJOURN_SECONDS);
    assert.ok(passages.every((cell) => cell.durationSeconds < SOJOURN_SECONDS));
    assert.ok((brightest?.intensity ?? 0) > (passages[0]?.intensity ?? 1));
    assert.ok(coverageIntensity(3600) > coverageIntensity(20));
  });
});
