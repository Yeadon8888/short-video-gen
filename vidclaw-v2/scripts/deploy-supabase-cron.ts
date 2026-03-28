import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnv(path.join(process.cwd(), ".env.local"));
  loadEnv(path.join(process.cwd(), ".env.vercel.production"));

  const databaseUrl = process.env.DATABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }
  if (!cronSecret) {
    throw new Error("CRON_SECRET is missing.");
  }

  const tickUrl = "https://video.yeadon.top/api/internal/tasks/tick";
  const sql = postgres(databaseUrl, { ssl: "require", prepare: false });
  const escapedTickUrl = tickUrl.replace(/'/g, "''");
  const escapedCronSecret = cronSecret.replace(/'/g, "''");
  const tickCommand = `
    select
      net.http_post(
        url := '${escapedTickUrl}',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ${escapedCronSecret}'
        ),
        body := '{}'::jsonb
      );
  `.trim();

  try {
    await sql`create extension if not exists pg_cron`;
    await sql`create extension if not exists pg_net`;

    await sql`select cron.unschedule(jobid) from cron.job where jobname in ('vidclaw-task-tick', 'vidclaw-timeout-fallback')`;

    await sql.unsafe(`
      select cron.schedule(
        'vidclaw-task-tick',
        '* * * * *',
        $$${tickCommand}$$
      )
    `);

    await sql.unsafe(`
      select cron.schedule(
        'vidclaw-timeout-fallback',
        '15 * * * *',
        $$${tickCommand}$$
      )
    `);

    const jobs = await sql`
      select jobid, jobname, schedule, active
      from cron.job
      where jobname in ('vidclaw-task-tick', 'vidclaw-timeout-fallback')
      order by jobname
    `;

    console.log(JSON.stringify(jobs, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
