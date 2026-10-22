import bcrypt from "bcryptjs";
import { getConfig } from "../config";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getConfig().bcryptRounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
