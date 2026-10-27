# Street Quest

A personal fog-of-war map. Streets and parks you have actually walked light up. The longer you stay, the brighter the cell. Everywhere else stays dim.

Street Quest is an Expo app for iOS and Android, plus a TypeScript API. Coverage is stored as Uber H3 cells at resolution 11 (about 25 meters across), which covers both street passages and open ground such as parks without snapping you onto a road.

## Layout

```
apps/mobile     Expo Router app (TypeScript, strict)
apps/api        Express API, JWT auth, PostGIS
packages/geo    Shared filter, H3 aggregation, glow ramp, and the Long Meadow trace
scripts         Cloud Agent install and boot scripts
```

## How a trail becomes light

1. GPS fixes are sampled about every 12 meters while you move. Motion activity slows the radio when you are still, and a heartbeat once a minute keeps a sojourn on the clock.
2. Fixes worse than 20 meters, or a jump faster than 70 m/s inside 30 seconds, are dropped. A longer gap starts a new segment instead of deleting the rest of the day.
3. Kept fixes are written immediately: SQLite on a phone, local storage in the browser preview. The same points are quantized to H3 and consecutive fixes in one cell accumulate `duration_seconds`.
4. A cell under two minutes is a **passage**. Two minutes or more is a **sojourn** (a park, a corner, a bench).
5. When you are on Wi-Fi or charging, or you tap Sync, batches upload to `POST /v1/locations/batch`. The server rebuilds `user_coverage_cells` in PostGIS.
6. The map requests only the current viewport (`ST_Intersects` via `&&` and `ST_MakeEnvelope`).

## Run it locally

PostgreSQL with PostGIS is required. On the Cloud Agent image the database is peer-authenticated:

```bash
npm ci
npm run build
npm run migrate
npm run dev:api
npm run dev:web
```

The API listens on port 4000. The web preview listens on port 8081. Register an account. The map follows you and draws a line along the streets you walk.

For a phone, build a development client. MapLibre native and background location are not available in Expo Go.

```bash
npm run dev:mobile
```

Set `EXPO_PUBLIC_API_URL` to a URL the phone can reach. Copy `.env.example` for `DATABASE_URL` and `JWT_SECRET`. Docker Compose can start PostGIS if you do not have it installed:

```bash
docker compose up -d
DATABASE_URL=postgres://streetquest:streetquest@127.0.0.1:5432/streetquest npm run migrate
```

## Checks

```bash
npm test
npm run typecheck
```
