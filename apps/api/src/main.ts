import "reflect-metadata";
import { getEnv } from "./config/env";
import { API_PREFIX, createApp } from "./bootstrap";

async function main() {
  const env = getEnv();
  const app = await createApp();
  await app.listen(env.PORT);
  console.log(`Tobacco ERP API listening on http://localhost:${env.PORT}/${API_PREFIX}  (docs: /api/docs)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
