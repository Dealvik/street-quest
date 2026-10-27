import type { CoverageCell, TrackPoint } from "@street-quest/geo";
import { create } from "zustand";
import { localCoverage } from "./db";

type UserFix = { longitude: number; latitude: number };

type TrailState = {
  cells: CoverageCell[];
  points: TrackPoint[];
  distanceMeters: number;
  durationSeconds: number;
  pending: number;
  tracking: boolean;
  status: string;
  user: UserFix | null;
  refresh: () => Promise<void>;
  setTracking: (tracking: boolean) => void;
  setStatus: (status: string) => void;
  setUser: (user: UserFix) => void;
};

export const useTrail = create<TrailState>((set) => ({
  cells: [],
  points: [],
  distanceMeters: 0,
  durationSeconds: 0,
  pending: 0,
  tracking: false,
  status: "",
  user: null,
  async refresh() {
    const model = await localCoverage();
    set({
      cells: model.cells,
      points: model.points,
      distanceMeters: model.distanceMeters,
      durationSeconds: model.durationSeconds,
      pending: model.pending,
    });
  },
  setTracking(tracking) {
    set({ tracking });
  },
  setStatus(status) {
    set({ status });
  },
  setUser(user) {
    set({ user });
  },
}));
