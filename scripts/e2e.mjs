import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

// Playwright itself does not read the backend's .env, and `source`-ing it breaks on any
// unquoted `&` or `#` in a value (the Redis URL has both). Parse it instead: the admin
// specs need ADMIN_BOOTSTRAP_*, which are the same variables Spring booted with.
const ENV_FILE = "../NexusCommerce/.env";
const env = { ...process.env };

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] ??= value;
  }
}

// The specs assume the local Spring app on :3001. A developer's `.env.local` may point the
// dev server at a deployed backend on purpose; that is fine for poking around, but an e2e run
// must not depend on it (a CDN in front of the API answers server-to-server calls with
// challenges). Next gives a real shell variable precedence over `.env.local`.
env.API_BASE_URL ??= "http://localhost:3001";

const child = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
