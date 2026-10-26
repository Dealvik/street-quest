import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { longMeadowRoam } from "@street-quest/geo";
import "./env";
import { createApp } from "../src/app";
import { migrate } from "../src/db/migrate";
import { getPool } from "../src/db/pool";

let server: Server;
let base = "";

async function request(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

before(async () => {
  await migrate();
  await getPool().query("TRUNCATE users CASCADE");
  const app = createApp();
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await getPool().end();
});

describe("street quest api", () => {
  it("reports PostGIS on the health check", async () => {
    const health = await request("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.match(String(health.body.postgis), /3\./);
  });

  it("registers, rejects a bad password, and reads the session", async () => {
    const created = await request("/v1/auth/register", {
      body: { email: "ada@streetquest.app", password: "meadow-walk", displayName: "Ada" },
    });
    assert.equal(created.status, 201);
    const token = String(created.body.token);
    const duplicate = await request("/v1/auth/register", {
      body: { email: "ada@streetquest.app", password: "meadow-walk" },
    });
    assert.equal(duplicate.status, 409);
    const wrong = await request("/v1/auth/login", {
      body: { email: "ada@streetquest.app", password: "not-the-password" },
    });
    assert.equal(wrong.status, 401);
    const me = await request("/v1/auth/me", { token });
    assert.equal(me.status, 200);
    assert.equal((me.body.user as { displayName: string }).displayName, "Ada");
  });

  it("stores a roam, ignores noise, and serves the lit cells for the viewport", async () => {
    const created = await request("/v1/auth/register", {
      body: { email: "walker@streetquest.app", password: "meadow-walk", displayName: "Walker" },
    });
    const token = String(created.body.token);
    const roam = longMeadowRoam();
    const noisy = {
      ...roam[0],
      clientId: "noise-jump",
      latitude: roam[0]!.latitude + 0.05,
      longitude: roam[0]!.longitude,
      recordedAt: new Date(Date.parse(roam[0]!.recordedAt) + 4000).toISOString(),
    };
    const uploaded = await request("/v1/locations/batch", {
      token,
      body: { points: [...roam, noisy] },
    });
    assert.equal(uploaded.status, 201);
    assert.equal(uploaded.body.rejected, 1);
    assert.ok(Number(uploaded.body.accepted) > 40);
    assert.ok(Number(uploaded.body.durationSeconds) > 300);

    const again = await request("/v1/locations/batch", { token, body: { points: roam } });
    assert.equal(again.status, 201);
    assert.equal(again.body.accepted, 0);
    assert.equal(again.body.duplicates, roam.length);

    const denied = await request("/v1/coverage?west=-73.98&south=40.66&east=-73.96&north=40.68");
    assert.equal(denied.status, 401);

    const coverage = await request(
      "/v1/coverage?west=-73.98&south=40.66&east=-73.96&north=40.68",
      { token },
    );
    assert.equal(coverage.status, 200);
    const cells = coverage.body.cells as Array<{ kind: string; durationSeconds: number; h3Index: string }>;
    assert.ok(cells.some((cell) => cell.kind === "sojourn" && cell.durationSeconds >= 120));
    assert.ok(cells.every((cell) => cell.h3Index.length > 10));

    const trail = await request(
      "/v1/coverage/trail?west=-73.98&south=40.66&east=-73.96&north=40.68",
      { token },
    );
    assert.equal(trail.status, 200);
    assert.ok((trail.body.points as unknown[]).length > 20);

    const far = await request("/v1/coverage?west=-118.3&south=34.0&east=-118.2&north=34.1", { token });
    assert.equal(far.status, 200);
    assert.equal((far.body.cells as unknown[]).length, 0);

    const summary = await request("/v1/coverage/summary", { token });
    assert.equal(summary.status, 200);
    assert.ok(Number(summary.body.sojournCount) >= 1);
    assert.ok(Number(summary.body.distanceMeters) > 1000);
  });
});
