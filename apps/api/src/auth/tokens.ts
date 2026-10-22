import { jwtVerify, SignJWT } from "jose";
import { getConfig } from "../config";

function key() {
  return new TextEncoder().encode(getConfig().jwtSecret);
}

export async function signSession(user: { id: string; email: string }): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function readSession(token: string): Promise<{ id: string; email: string }> {
  const { payload } = await jwtVerify(token, key());
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Session is missing its subject.");
  }
  return { id: payload.sub, email: payload.email };
}
