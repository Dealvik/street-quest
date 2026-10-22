import type { CoverageCell } from "@street-quest/geo";
import { create } from "zustand";
import { localCoverage } from "./db";

type TrailState = {
  cells: CoverageCell[];
  distanceMeters: number;
  durationSeconds: number;
  pending: number;
  tracking: boolean;
  status: string;
  focusToken: number;
  refresh: () => Promise<void>;
  setTracking: (tracking: boolean) => void;
  setStatus: (status: string) => void;
  bumpFocus: () => void;
};

export const useTrail = create<TrailState>((set, get) => ({
  cells: [],
  distanceMeters: 0,
  durationSeconds: 0,
  pending: 0,
  tracking: false,
  status: "",
  focusToken: 0,
  async refresh() {
    const model = await localCoverage();
    set({
      cells: model.cells,
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
  bumpFocus() {
    set({ focusToken: get().focusToken + 1 });
  },
}));
