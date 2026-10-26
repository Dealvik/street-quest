export const trailGlowPaint = {
  "line-color": ["coalesce", ["get", "line"], "#d6ff4a"],
  "line-width": ["+", ["to-number", ["get", "lineWidth"], 3], 6],
  "line-blur": 4,
  "line-opacity": 0.85,
};

export const trailLinePaint = {
  "line-color": ["coalesce", ["get", "line"], "#f4ffd0"],
  "line-width": ["+", ["to-number", ["get", "lineWidth"], 2], 3],
  "line-opacity": 1,
};

export const userDotPaint = {
  "circle-radius": 7,
  "circle-color": "#d6ff4a",
  "circle-stroke-width": 2,
  "circle-stroke-color": "#10140f",
};

export const lineLayout = {
  "line-cap": "round",
  "line-join": "round",
};
