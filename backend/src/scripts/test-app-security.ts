import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp, isCorsOriginAllowed, sanitizeApiResponseBody } from "../app.js";
import { configuredCorsOrigins, DEFAULT_BIND_HOST, DEFAULT_CORS_ORIGINS } from "../core/config.js";

assert.equal(DEFAULT_BIND_HOST, "127.0.0.1");
assert.deepEqual(DEFAULT_CORS_ORIGINS, ["http://localhost:51773", "http://127.0.0.1:51773"]);
assert.deepEqual(configuredCorsOrigins("*"), [...DEFAULT_CORS_ORIGINS], "wildcard CORS must never be enabled");
assert.deepEqual(configuredCorsOrigins("https://editor.example"), ["https://editor.example"]);
assert.equal(isCorsOriginAllowed(undefined, DEFAULT_CORS_ORIGINS), true);
assert.equal(isCorsOriginAllowed("http://localhost:51773", DEFAULT_CORS_ORIGINS), true);
assert.equal(isCorsOriginAllowed("http://127.0.0.1:51773", DEFAULT_CORS_ORIGINS), true);
assert.equal(isCorsOriginAllowed("http://localhost:51774", DEFAULT_CORS_ORIGINS), false);

const leaked = "upstream https://vendor.invalid failed: Bearer sk-super-secret";
assert.deepEqual(sanitizeApiResponseBody({ error: leaked, stack: leaked }, 500, "en"), {
  error: "Service temporarily unavailable. Please try again.",
});
assert.deepEqual(sanitizeApiResponseBody({ ok: false, model: "test", error: leaked }, 200, "zh"), {
  ok: false,
  model: "test",
  error: "服务暂时不可用，请稍后重试。",
});
assert.deepEqual(
  sanitizeApiResponseBody(
    { research: { unavailableSources: [`Exa article search: ${leaked}`] } },
    200,
    "en"
  ),
  { research: { unavailableSources: ["Exa article search: temporarily unavailable"] } },
  "raw provider diagnostics and secret sentinels must not leave in successful research responses"
);

const app = createApp({ corsOrigins: DEFAULT_CORS_ORIGINS });
let mutationCount = 0;
app.get("/__test-provider-error", (_req, res) => {
  res.status(500).json({ error: leaked, stack: leaked });
});
app.post("/__test-side-effect", (_req, res) => {
  mutationCount += 1;
  res.json({ ok: true });
});
const server = app.listen(0, DEFAULT_BIND_HOST);
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

try {
  const address = server.address() as AddressInfo;
  assert.equal(address.address, DEFAULT_BIND_HOST, "the local server must bind only to loopback by default");
  const url = `http://${DEFAULT_BIND_HOST}:${address.port}/api/gzh/themes?lang=en`;
  const redacted = await fetch(`http://${DEFAULT_BIND_HOST}:${address.port}/__test-provider-error`);
  assert.deepEqual(await redacted.json(), { error: "Service temporarily unavailable. Please try again." });

  for (const origin of DEFAULT_CORS_ORIGINS) {
    const res = await fetch(url, { headers: { Origin: origin } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), origin);
  }

  const denied = await fetch(url, { headers: { Origin: "http://localhost:51774" } });
  assert.equal(denied.status, 403, "disallowed browser origins must be rejected before route handlers run");
  assert.equal(denied.headers.get("access-control-allow-origin"), null);

  const form = new FormData();
  form.set("title", "must not run");
  const deniedMutation = await fetch(`http://${DEFAULT_BIND_HOST}:${address.port}/__test-side-effect`, {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
    body: form,
  });
  assert.equal(deniedMutation.status, 403, "simple cross-origin POSTs must also be rejected server-side");
  assert.equal(mutationCount, 0, "a rejected cross-origin request must have no application side effects");

  const cli = await fetch(url);
  assert.equal(cli.status, 200, "same-origin/CLI requests without Origin remain supported");

  const preflight = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:51773",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:51773");

  console.log("Backend binding, CORS, and error-redaction security tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
