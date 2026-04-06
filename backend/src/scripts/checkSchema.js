import { loadConfig } from "../config.js";
import { assertRequiredAiTables, createSupabaseAdminClient } from "../lib/supabase.js";
import { loadLocalEnvFiles } from "../localEnv.js";

async function main() {
  loadLocalEnvFiles();
  const config = loadConfig(process.env);
  const supabase = createSupabaseAdminClient(config);
  const result = await assertRequiredAiTables(supabase);

  if (result.ok) {
    // eslint-disable-next-line no-console
    console.log("[schema] OK - required AI tables are present.");
    return;
  }

  // eslint-disable-next-line no-console
  console.error("[schema] Missing or inaccessible required tables:");
  for (const entry of result.missing) {
    // eslint-disable-next-line no-console
    console.error(`- ${entry.table}: ${entry.error?.code || "UNKNOWN"} ${entry.error?.message || ""}`.trim());
  }
  process.exitCode = 1;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[schema] check failed", error);
  process.exitCode = 1;
});
