import type { CoverageCell } from "@street-quest/geo";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { formatDuration } from "../../src/format";
import { fonts, theme } from "../../src/theme";
import { useTrail } from "../../src/trail";

export default function LedgerScreen() {
  const cells = useTrail((state) => state.cells);
  const durationSeconds = useTrail((state) => state.durationSeconds);

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>LEDGER</Text>
      <Text style={styles.title}>Where the light held.</Text>
      <Text style={styles.lead}>
        {cells.length === 0
          ? "No cells yet. A passage is a street you crossed. A sojourn is a place you stayed."
          : `${formatDuration(durationSeconds)} mapped across ${cells.length} cells. Parks and corners you lingered in outshine the blocks you only passed.`}
      </Text>
      <FlatList
        data={cells}
        keyExtractor={(cell) => cell.h3Index}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>The meadow is still dark.</Text>}
        renderItem={({ item }) => <Row cell={item} />}
      />
    </View>
  );
}

function Row({ cell }: { cell: CoverageCell }) {
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: cell.fill, opacity: Math.max(0.45, cell.opacity) }]} />
      <View style={styles.copy}>
        <Text style={styles.kind}>{cell.kind === "sojourn" ? "Sojourn" : "Passage"}</Text>
        <Text style={styles.meta}>
          {formatDuration(cell.durationSeconds)} · {cell.visitCount} visit{cell.visitCount === 1 ? "" : "s"} ·{" "}
          {cell.pointCount} fixes
        </Text>
      </View>
      <Text style={styles.index}>{cell.h3Index.slice(0, 8)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ink, paddingTop: 28, paddingHorizontal: 20 },
  kicker: { color: theme.phosphor, fontFamily: fonts.monoMedium, letterSpacing: 3, fontSize: 12 },
  title: { color: theme.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 46, marginTop: 8 },
  lead: { color: theme.paperDim, fontFamily: fonts.body, fontSize: 17, lineHeight: 24, marginTop: 8 },
  list: { paddingTop: 18, paddingBottom: 24, gap: 8 },
  empty: { color: theme.moss, fontFamily: fonts.body, fontSize: 16, marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  swatch: { width: 14, height: 36 },
  copy: { flex: 1, gap: 2 },
  kind: { color: theme.paper, fontFamily: fonts.body, fontSize: 18 },
  meta: { color: theme.moss, fontFamily: fonts.mono, fontSize: 12 },
  index: { color: theme.paperDim, fontFamily: fonts.mono, fontSize: 11 },
});
