import fs from "node:fs";
import path from "node:path";
import { runTaskMaintenance } from "@/lib/tasks/runner";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.vercel.production"));

  const result = await runTaskMaintenance({
    scheduledLimit: 10,
    taskGroupLimit: 30,
    groupProcessLimit: 3,
    activeTaskLimit: 200,
    timeoutLimit: 50,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
