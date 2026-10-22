const EARTH_RADIUS_METERS = 6_371_000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const φ1 = toRadians(a.latitude);
  const φ2 = toRadians(b.latitude);
  const Δφ = toRadians(b.latitude - a.latitude);
  const Δλ = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle point at fraction t between a and b. */
export function interpolate(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  t: number,
): { latitude: number; longitude: number } {
  const φ1 = toRadians(a.latitude);
  const λ1 = toRadians(a.longitude);
  const φ2 = toRadians(b.latitude);
  const λ2 = toRadians(b.longitude);
  const Δ =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((φ2 - φ1) / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
        ),
      ),
    );
  if (Δ === 0) {
    return { latitude: a.latitude, longitude: a.longitude };
  }
  const A = Math.sin((1 - t) * Δ) / Math.sin(Δ);
  const B = Math.sin(t * Δ) / Math.sin(Δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return {
    latitude: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI,
    longitude: (Math.atan2(y, x) * 180) / Math.PI,
  };
}
