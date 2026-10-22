import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { getPool } from "./db/pool";
import { HttpError } from "./http";
import { authRouter } from "./routes/auth";
import { coverageRouter } from "./routes/coverage";
import { locationRouter } from "./routes/locations";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", async (_req, res, next) => {
    try {
      const result = await getPool().query<{ postgis: string }>("SELECT PostGIS_Version() AS postgis");
      res.json({ ok: true, postgis: result.rows[0]?.postgis ?? "unknown" });
    } catch (error) {
      next(error);
    }
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1/locations", locationRouter);
  app.use("/v1/coverage", coverageRouter);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Check the fields and try again." });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}
