import {
  DARK_MAP_STYLE,
  FOG_COLOR,
  FOG_MASK,
  FOG_OPACITY,
  trailToLines,
  type BBox,
  type TrailSegment,
} from "@street-quest/geo";
import { Camera, GeoJSONSource, Layer, Map, UserLocation } from "@maplibre/maplibre-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LocateButton } from "./LocateButton";
import { lineLayout, trailGlowPaint, trailLinePaint } from "./paint";

type Props = {
  segments: TrailSegment[];
  user: { longitude: number; latitude: number } | null;
  onViewport: (bbox: BBox) => void;
};

export function GlowMap({ segments, onViewport }: Props) {
  const [following, setFollowing] = useState(true);

  return (
    <View style={styles.frame}>
      <Map
        style={styles.map}
        mapStyle={DARK_MAP_STYLE}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) setFollowing(false);
        }}
        onRegionDidChange={(event) => {
          const [west, south, east, north] = event.nativeEvent.bounds;
          onViewport({ west, south, east, north });
        }}
      >
        <Camera initialViewState={{ zoom: 16 }} trackUserLocation={following ? "default" : undefined} />
        <UserLocation />
        <GeoJSONSource id="fog" data={{ type: "FeatureCollection", features: [FOG_MASK] }}>
          <Layer
            id="fog-fill"
            type="fill"
            source="fog"
            paint={{ "fill-color": FOG_COLOR, "fill-opacity": FOG_OPACITY } as never}
          />
        </GeoJSONSource>
        <GeoJSONSource id="trail" data={trailToLines(segments)}>
          <Layer
            id="trail-glow"
            type="line"
            source="trail"
            layout={lineLayout as never}
            paint={trailGlowPaint as never}
          />
          <Layer
            id="trail-line"
            type="line"
            source="trail"
            layout={lineLayout as never}
            paint={trailLinePaint as never}
          />
        </GeoJSONSource>
      </Map>
      <LocateButton following={following} onPress={() => setFollowing(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, position: "relative" },
  map: { flex: 1 },
});
