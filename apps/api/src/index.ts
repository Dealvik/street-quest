import { createApp } from "./app";
import { getConfig } from "./config";
import { migrate } from "./db/migrate";
import { getPool } from "./db/pool";

const config = getConfig();
const app = createApp();

migrate()
  .then(() => {
    app.listen(config.port, "0.0.0.0", () => {
      console.log(`street-quest api listening on ${config.port}`);
    });
  })
  .catch((error: unknown) => {
    console.error(error);
    void getPool().end();
    process.exit(1);
  });
