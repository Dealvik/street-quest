import { trailFromPoints, type BBox, type TrackPoint, type TrailSegment } from "@street-quest/geo";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import { fetchTrail } from "../../src/api";
import { formatDistance, formatDuration } from "../../src/format";
import { useSession } from "../../src/session";
import { theme, fonts } from "../../src/theme";
import { syncPending } from "../../src/tracking/pipeline";
import { useTrail } from "../../src/trail";

function mapLibreReady(): boolean {
  if (Platform.OS === "web") return true;
  return TurboModuleRegistry.get("MLRNMapViewModule") != null;
}

export default function MapScreen() {
  const cells = useTrail((state) => state.cells);
  const points = useTrail((state) => state.points);
  const durationSeconds = useTrail((state) => state.durationSeconds);
  const distanceMeters = useTrail((state) => state.distanceMeters);
  const pending = useTrail((state) => state.pending);
  const status = useTrail((state) => state.status);
  const user = useTrail((state) => state.user);
  const setStatus = useTrail((state) => state.setStatus);
  const token = useSession((state) => state.token);
  const [remote, setRemote] = useState<TrackPoint[]>([]);

  const loadViewport = useCallback(
    async (bbox: BBox) => {
      if (!token) return;
      try {
        const response = await fetchTrail(token, bbox);
        setRemote(
          response.points.map((point) => ({
            clientId: point.clientId,
            latitude: point.latitude,
            longitude: point.longitude,
            altitude: null,
            accuracyMeters: null,
            speedMps: null,
            recordedAt: point.recordedAt,
          })),
        );
      } catch {
        // Keep the trail already on screen if this viewport cannot load.
      }
    },
    [token],
  );

  const segments = useMemo(() => mergeTrail(points, remote), [points, remote]);
  const sojourns = cells.filter((cell) => cell.kind === "sojourn").length;

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <StreetMap segments={segments} user={user} onViewport={(bbox) => void loadViewport(bbox)} />
        <View pointerEvents="none" style={styles.top}>
          <Text style={styles.kicker}>STREET QUEST</Text>
        </View>
      </View>
      <View style={styles.sheet}>
        <View style={styles.stats}>
          <Stat value={String(cells.length)} label="cells lit" />
          <Stat value={formatDuration(durationSeconds)} label="on the ground" />
          <Stat value={formatDistance(distanceMeters)} label="walked" />
        </View>
        <View style={styles.legend}>
          <View style={styles.swatchDim} />
          <View style={styles.swatchMid} />
          <View style={styles.swatchHot} />
          <Text style={styles.legendText}>
            {sojourns === 1
              ? "1 sojourn burns brighter than a street you only crossed"
              : `${sojourns} sojourns burn brighter than a street you only crossed`}
          </Text>
        </View>
        <Text style={styles.status}>
          {status || (pending > 0 ? `${pending} fixes waiting to sync.` : "Unlit streets are the ones you have not walked.")}
        </Text>
        {pending > 0 ? (
          <Pressable
            onPress={() => {
              void syncPending()
                .then((result) => {
                  setStatus(
                    result.deferred
                      ? "Sync is waiting for Wi-Fi or a charger."
                      : `Sent ${result.uploaded} fixes.`,
                  );
                })
                .catch((error: unknown) => {
                  setStatus(error instanceof Error ? error.message : "Sync failed.");
                });
            }}
          >
            <Text style={styles.sync}>Sync now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StreetMap({
  segments,
  user,
  onViewport,
}: {
  segments: TrailSegment[];
  user: { longitude: number; latitude: number } | null;
  onViewport: (bbox: BBox) => void;
}) {
  if (!mapLibreReady()) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Expo Go does not include the street map. Sign in still works. A development build is required to draw the map on a phone.
        </Text>
      </View>
    );
  }
  const { GlowMap } = require("../../src/map/GlowMap") as typeof import("../../src/map/GlowMap");
  return <GlowMap segments={segments} user={user} onViewport={onViewport} />;
}

function mergeTrail(local: TrackPoint[], remote: TrackPoint[]): TrailSegment[] {
  const byId = new Map<string, TrackPoint>();
  for (const point of remote) byId.set(point.clientId, point);
  for (const point of local) byId.set(point.clientId, point);
  return trailFromPoints([...byId.values()]);
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ink },
  map: { flex: 1 },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  fallbackText: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 18, lineHeight: 26, textAlign: "center" },
  top: { position: "absolute", top: 18, left: 18 },
  kicker: {
    color: theme.paper,
    fontFamily: fonts.monoMedium,
    letterSpacing: 2.4,
    fontSize: 13,
  },
  sheet: {
    backgroundColor: theme.ink,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { gap: 2 },
  statValue: { color: theme.paper, fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  statLabel: { color: theme.moss, fontFamily: fonts.mono, fontSize: 11 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatchDim: { width: 18, height: 8, backgroundColor: "#31421f" },
  swatchMid: { width: 18, height: 8, backgroundColor: "#9ec04a" },
  swatchHot: { width: 18, height: 8, backgroundColor: "#f4ffd0" },
  legendText: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 13, flex: 1 },
  status: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  sync: { color: theme.phosphor, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
});
