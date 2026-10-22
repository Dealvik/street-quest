import { Router } from "express";
import { z } from "zod";
import { currentUser, requireUser } from "../auth/middleware";
import { asyncRoute, HttpError } from "../http";
import { coverageInBBox, coverageSummary } from "../services/coverage";

const bboxSchema = z.object({
  west: z.coerce.number().gte(-180).lte(180),
  south: z.coerce.number().gte(-90).lte(90),
  east: z.coerce.number().gte(-180).lte(180),
  north: z.coerce.number().gte(-90).lte(90),
});

export const coverageRouter = Router();
coverageRouter.use(requireUser);

coverageRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const bbox = bboxSchema.parse(req.query);
    if (!(bbox.west < bbox.east) || !(bbox.south < bbox.north)) {
      throw new HttpError(400, "Bounding box is empty.");
    }
    if (bbox.east - bbox.west > 1.2 || bbox.north - bbox.south > 1.2) {
      throw new HttpError(400, "Zoom in to load coverage.");
    }
    const cells = await coverageInBBox(currentUser(res).id, bbox);
    res.json({ cells });
  }),
);

coverageRouter.get(
  "/summary",
  asyncRoute(async (_req, res) => {
    res.json(await coverageSummary(currentUser(res).id));
  }),
);
