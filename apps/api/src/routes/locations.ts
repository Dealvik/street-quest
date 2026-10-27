import type { TrackPoint } from "@street-quest/geo";
import { Router } from "express";
import { z } from "zod";
import { currentUser, requireUser } from "../auth/middleware";
import { asyncRoute } from "../http";
import { ingestPoints } from "../services/coverage";

const batchSchema = z.object({
  points: z
    .array(
      z.object({
        clientId: z.string().trim().min(1).max(80),
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
        altitude: z.number().nullable(),
        accuracyMeters: z.number().nullable(),
        speedMps: z.number().nullable(),
        recordedAt: z.string().datetime(),
      }),
    )
    .max(1000),
});

export const locationRouter = Router();
locationRouter.use(requireUser);

locationRouter.post(
  "/batch",
  asyncRoute(async (req, res) => {
    const body = batchSchema.parse(req.body);
    const points: TrackPoint[] = body.points;
    const result = await ingestPoints(currentUser(res).id, points);
    res.status(201).json(result);
  }),
);
