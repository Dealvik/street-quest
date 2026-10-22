import type { Response } from "express";
import { asyncRoute, HttpError } from "../http";
import { readSession } from "./tokens";

export type SessionUser = { id: string; email: string };

export const requireUser = asyncRoute(async (req, res, next) => {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new HttpError(401, "Sign in required.");
  try {
    res.locals.user = await readSession(match[1]);
  } catch {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  next();
});

export function currentUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new HttpError(401, "Sign in required.");
  return user;
}
