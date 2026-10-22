export const fillPaint = {
  "fill-color": ["get", "fill"],
  "fill-opacity": ["get", "opacity"],
};

export const glowPaint = {
  "line-color": ["get", "line"],
  "line-width": ["*", ["get", "lineWidth"], 3.4],
  "line-blur": 7,
  "line-opacity": ["*", ["get", "opacity"], 0.9],
};

export const linePaint = {
  "line-color": ["get", "line"],
  "line-width": ["get", "lineWidth"],
  "line-opacity": 0.95,
};

export const bloomPaint = {
  "circle-color": ["get", "line"],
  "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 8, 1, 28],
  "circle-blur": 0.85,
  "circle-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.16, 1, 0.82],
};
