import assert from "node:assert/strict";
import path from "node:path";
import { loadConfigFromFile } from "vite";

const names = ["VITE_BASE_URL", "VITE_API_BASE_URL", "VITE_DEV_PROXY_TARGET"];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
try {
  for (const prefix of ["", "/transit-hub"]) {
    process.env.VITE_BASE_URL = prefix || "/";
    process.env.VITE_API_BASE_URL = prefix;
    process.env.VITE_DEV_PROXY_TARGET = "http://127.0.0.1:7060";
    const loaded = await loadConfigFromFile({ command: "serve", mode: "development" }, path.resolve("vite.config.ts"));
    const proxy = loaded.config.server.proxy;
    const match = pathname => Object.entries(proxy).find(([key]) => key.startsWith("^") ? new RegExp(key).test(pathname) : pathname.startsWith(key));
    for (const endpoint of ["/mcp", "/mcp?session=demo", "/admin/auth/me", "/api/me", "/v1/models", "/bailian/v1/test", "/minimax/v1/test"]) {
      const matched = match(prefix + endpoint);
      assert.ok(matched, `missing proxy: ${prefix}${endpoint}`);
      assert.equal(matched[1].target, "http://127.0.0.1:7060");
      assert.equal(matched[1].rewrite(prefix + endpoint), endpoint);
    }
    for (const page of ["/mcp-access", "/api-keys", "/organizations", "/routing"]) {
      assert.equal(match(prefix + page), undefined, `SPA page was proxied: ${prefix}${page}`);
    }
  }
  console.log("Vite proxy path boundaries, subpaths and configurable target passed.");
} finally {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
}
