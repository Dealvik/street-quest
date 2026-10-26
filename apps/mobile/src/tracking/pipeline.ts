import { filterTrack, type TrackPoint } from "@street-quest/geo";
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import { api } from "../api";
import { insertPoint, lastPoint, markSynced, unsyncedPoints } from "../db";
import { useSession } from "../session";
import { useTrail } from "../trail";

export async function recordPoints(incoming: TrackPoint[]): Promise<number> {
  if (incoming.length === 0) return 0;
  const previous = await lastPoint();
  const filtered = filterTrack(previous ? [previous, ...incoming] : incoming);
  const fresh = filtered.kept.filter((point) => point.clientId !== previous?.clientId);
  for (const point of fresh) {
    await insertPoint(point);
  }
  if (fresh.length > 0) await useTrail.getState().refresh();
  return fresh.length;
}

export async function syncPending(): Promise<{ uploaded: number; deferred: boolean }> {
  const token = useSession.getState().token;
  if (!token) return { uploaded: 0, deferred: false };
  const pending = await unsyncedPoints();
  if (pending.length === 0) return { uploaded: 0, deferred: false };
  if (await shouldDefer(pending.length)) return { uploaded: 0, deferred: true };

  let uploaded = 0;
  for (let offset = 0; offset < pending.length; offset += 400) {
    const chunk = pending.slice(offset, offset + 400);
    await api("/v1/locations/batch", { token, body: { points: chunk } });
    await markSynced(chunk.map((point) => point.clientId));
    uploaded += chunk.length;
  }
  await useTrail.getState().refresh();
  return { uploaded, deferred: false };
}

async function shouldDefer(pending: number): Promise<boolean> {
  if (pending < 80) return false;
  try {
    const [network, battery] = await Promise.all([
      Network.getNetworkStateAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    const unmetered =
      network.type === Network.NetworkStateType.WIFI ||
      network.type === Network.NetworkStateType.ETHERNET ||
      network.type === Network.NetworkStateType.UNKNOWN ||
      network.type == null;
    const charging =
      battery === Battery.BatteryState.CHARGING || battery === Battery.BatteryState.FULL;
    return !unmetered && !charging;
  } catch {
    return false;
  }
}
