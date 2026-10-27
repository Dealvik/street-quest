import { Router } from "express";
import { z } from "zod";
import { currentUser, requireUser } from "../auth/middleware";
import { hashPassword, verifyPassword } from "../auth/passwords";
import { signSession } from "../auth/tokens";
import { getPool } from "../db/pool";
import { asyncRoute, HttpError, rateLimit } from "../http";

const credentials = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(40).optional(),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  rateLimit(20, 10 * 60 * 1000),
  asyncRoute(async (req, res) => {
    const body = credentials.parse(req.body);
    const email = body.email.toLowerCase();
    const displayName = body.displayName?.trim() || email.split("@")[0] || "Walker";
    const passwordHash = await hashPassword(body.password);
    try {
      const inserted = await getPool().query<{ id: string; email: string; display_name: string }>(
        `INSERT INTO users (email, password_hash, display_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name`,
        [email, passwordHash, displayName],
      );
      const user = inserted.rows[0];
      if (!user) throw new HttpError(500, "Could not create the account.");
      const token = await signSession({ id: user.id, email: user.email });
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, displayName: user.display_name },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "An account with that email already exists.");
      }
      throw error;
    }
  }),
);

authRouter.post(
  "/login",
  rateLimit(20, 10 * 60 * 1000),
  asyncRoute(async (req, res) => {
    const body = credentials.omit({ displayName: true }).parse(req.body);
    const email = body.email.toLowerCase();
    const found = await getPool().query<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
    }>("SELECT id, email, display_name, password_hash FROM users WHERE email = $1", [email]);
    const user = found.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new HttpError(401, "Email or password is wrong.");
    }
    const token = await signSession({ id: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  }),
);

authRouter.get(
  "/me",
  requireUser,
  asyncRoute(async (_req, res) => {
    const session = currentUser(res);
    const found = await getPool().query<{ id: string; email: string; display_name: string }>(
      "SELECT id, email, display_name FROM users WHERE id = $1",
      [session.id],
    );
    const user = found.rows[0];
    if (!user) throw new HttpError(401, "Sign in required.");
    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
  }),
);

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
