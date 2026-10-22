/** H3 resolution 11: average edge about 25 m, street and park scale. */
export const H3_RESOLUTION = 11;

/** Drop fixes worse than this. A missing accuracy is kept. */
export const MAX_ACCURACY_METERS = 20;

/** While moving, keep a sample about this far from the previous kept fix. */
export const MIN_SAMPLE_DISTANCE_METERS = 12;

/**
 * Stationary heartbeats. GPS can sleep between these, and the gap still
 * counts as time spent in the cell.
 */
export const STATIONARY_HEARTBEAT_SECONDS = 60;

/** Implied speed above this, inside a short window, is a GPS glitch. */
export const MAX_IMPLIED_SPEED_MPS = 70;

/** Glitches only count inside this window. Longer gaps start a new segment. */
export const TELEPORT_WINDOW_SECONDS = 30;

/** Do not treat a GPS outage as time spent standing in a cell. */
export const MAX_DWELL_GAP_SECONDS = 10 * 60;

/** At or above this, a cell is a sojourn (park, plaza) rather than a passage. */
export const SOJOURN_SECONDS = 120;

export const DARK_MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export const LONG_MEADOW_CENTER = {
  latitude: 40.66572,
  longitude: -73.97016,
} as const;
