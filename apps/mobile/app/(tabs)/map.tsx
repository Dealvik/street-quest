import { cellInBBox, mergeCells, type BBox, type CoverageCell } from "@street-quest/geo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fetchCoverage } from "../../src/api";
import { formatDistance, formatDuration } from "../../src/format";
import { GlowMap } from "../../src/map/GlowMap";
import { useSession } from "../../src/session";
import { theme, fonts } from "../../src/theme";
import { startTrail, stopTrail } from "../../src/tracking/controls";
import { playLongMeadow, syncPending } from "../../src/tracking/pipeline";
import { useTrail } from "../../src/trail";

export default function MapScreen() {
  const cells = useTrail((state) => state.cells);
  const durationSeconds = useTrail((state) => state.durationSeconds);
  const distanceMeters = useTrail((state) => state.distanceMeters);
  const pending = useTrail((state) => state.pending);
  const tracking = useTrail((state) => state.tracking);
  const status = useTrail((state) => state.status);
  const focusToken = useTrail((state) => state.focusToken);
  const setStatus = useTrail((state) => state.setStatus);
  const token = useSession((state) => state.token);
  const [shown, setShown] = useState<CoverageCell[]>(cells);
  const [playing, setPlaying] = useState(false);
  const bboxRef = useRef<BBox | null>(null);

  const loadViewport = useCallback(
    async (bbox: BBox) => {
      bboxRef.current = bbox;
      const local = useTrail.getState().cells.filter((cell) => cellInBBox(cell, bbox));
      let remote: CoverageCell[] = [];
      if (token) {
        try {
          const response = await fetchCoverage(token, bbox);
          remote = response.cells;
        } catch {
          remote = [];
        }
      }
      setShown(mergeCells([local, remote]));
    },
    [token],
  );

  useEffect(() => {
    if (bboxRef.current) void loadViewport(bboxRef.current);
    else setShown(cells);
  }, [cells, loadViewport]);

  const sojourns = cells.filter((cell) => cell.kind === "sojourn").length;

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <GlowMap cells={shown.length > 0 ? shown : cells} focusToken={focusToken} onViewport={(bbox) => void loadViewport(bbox)} />
        <View pointerEvents="none" style={styles.top}>
          <Text style={styles.kicker}>STREET QUEST</Text>
          <Text style={styles.mode}>{tracking ? "Trail running" : "Trail paused"}</Text>
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
            {sojourns} sojourn{sojourns === 1 ? "" : "s"} burn brighter than a street you only crossed
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.primary}
            onPress={() => void (tracking ? stopTrail() : startTrail())}
          >
            <Text style={styles.primaryText}>{tracking ? "Pause trail" : "Start trail"}</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            disabled={playing}
            onPress={() => {
              setPlaying(true);
              void playLongMeadow()
                .catch((error: unknown) => {
                  setStatus(error instanceof Error ? error.message : "The replay could not finish.");
                })
                .finally(() => setPlaying(false));
            }}
          >
            <Text style={styles.secondaryText}>{playing ? "Lighting…" : "Replay meadow"}</Text>
          </Pressable>
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
  top: { position: "absolute", top: 18, left: 18 },
  kicker: {
    color: theme.paper,
    fontFamily: fonts.monoMedium,
    letterSpacing: 2.4,
    fontSize: 13,
  },
  mode: {
    color: theme.phosphor,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: 2,
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
  actions: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    backgroundColor: theme.phosphor,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: theme.ink, fontFamily: fonts.monoMedium, fontSize: 14 },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.phosphor,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: theme.phosphor, fontFamily: fonts.monoMedium, fontSize: 14 },
  status: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  sync: { color: theme.phosphor, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
});
