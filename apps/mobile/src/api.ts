import type { BBox, CoverageCell } from "@street-quest/geo";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export type SessionUser = { id: string; email: string; displayName: string };

export function login(email: string, password: string) {
  return api<{ token: string; user: SessionUser }>("/v1/auth/login", {
    body: { email, password },
  });
}

export function register(email: string, password: string, displayName: string) {
  return api<{ token: string; user: SessionUser }>("/v1/auth/register", {
    body: { email, password, displayName },
  });
}

export function fetchCoverage(token: string, bbox: BBox) {
  const query = new URLSearchParams({
    west: String(bbox.west),
    south: String(bbox.south),
    east: String(bbox.east),
    north: String(bbox.north),
  });
  return api<{ cells: CoverageCell[] }>(`/v1/coverage?${query.toString()}`, { token });
}
