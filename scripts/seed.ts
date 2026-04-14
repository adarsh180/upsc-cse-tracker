import "dotenv/config";

import { ensureSeeded } from "@/lib/seed";

async function run() {
  await ensureSeeded();
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
