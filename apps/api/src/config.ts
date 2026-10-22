const DEV_JWT_SECRET = "dev-only-street-quest-jwt-secret";

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;
  if (nodeEnv === "production" && jwtSecret === DEV_JWT_SECRET) {
    throw new Error("Set JWT_SECRET before running in production.");
  }
  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 4000),
    databaseUrl:
      process.env.DATABASE_URL ?? "postgres://ubuntu@/streetquest?host=/var/run/postgresql",
    jwtSecret,
    bcryptRounds: 10,
  };
}
