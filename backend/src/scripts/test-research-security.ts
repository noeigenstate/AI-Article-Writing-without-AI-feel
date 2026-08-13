import assert from "node:assert/strict";
import {
  buildMcporterInvocation,
  mcporterExecOptions,
  parseAgentReachSearchOutput,
} from "../services/research/agentReach.js";
import { enrichResearchImages, fetchSafeImageBinary } from "../services/research/images.js";
import {
  fetchBinaryWithOutboundPolicy,
  isBlockedOutboundAddress,
  isBlockedOutboundHostname,
  validateOutboundUrl,
} from "../services/research/networkSafety.js";
import type { ResearchItem } from "../services/research/types.js";

const blockedIpv4 = [
  "0.0.0.0",
  "10.1.2.3",
  "100.64.0.1",
  "127.0.0.1",
  "169.254.169.254",
  "172.16.0.1",
  "192.168.1.1",
  "198.18.0.1",
  "224.0.0.1",
  "240.0.0.1",
  "168.63.129.16",
];
for (const address of blockedIpv4) {
  assert.equal(isBlockedOutboundAddress(address), true, `${address} must be blocked`);
}

const blockedIpv6 = [
  "::1",
  "::ffff:127.0.0.1",
  "::ffff:168.63.129.16",
  "64:ff9b::7f00:1",
  "2001:db8::1",
  "2002:7f00:1::",
  "fc00::1",
  "fe80::1",
  "ff02::1",
];
for (const address of blockedIpv6) {
  assert.equal(isBlockedOutboundAddress(address), true, `${address} must be blocked`);
}
assert.equal(isBlockedOutboundAddress("8.8.8.8"), false);
assert.equal(isBlockedOutboundAddress("2606:4700:4700::1111"), false);

for (const hostname of [
  "localhost",
  "api.localhost",
  "printer.local",
  "metadata.google.internal",
  "service.home.arpa",
]) {
  assert.equal(isBlockedOutboundHostname(hostname), true, `${hostname} must be blocked`);
}
assert.equal(isBlockedOutboundHostname("example.com"), false);

await assert.rejects(() => validateOutboundUrl("file:///etc/passwd"), /仅允许 http\(s\)/);
await assert.rejects(() => validateOutboundUrl("http://user:pass@example.com"), /不允许包含凭据/);
await assert.rejects(() => validateOutboundUrl("https://example.com:8443/image.png"), /仅允许标准/);
await assert.rejects(() => validateOutboundUrl("http://2130706433/admin"), /安全策略阻止/);
await assert.rejects(() => validateOutboundUrl("http://[::1]/admin"), /安全策略阻止/);
await assert.rejects(
  () =>
    validateOutboundUrl("https://mixed.example", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
  /DNS 结果包含受限地址/
);

const lookupCalls: string[] = [];
const transportCalls: string[] = [];
let redirectClosed = false;
const redirected = await fetchBinaryWithOutboundPolicy(
  "https://public.example/start",
  { label: "redirect-test", timeoutMs: 1_000, maxBytes: 32 },
  {
    lookup: async (hostname) => {
      lookupCalls.push(hostname);
      return [{ address: "93.184.216.34", family: 4 }];
    },
    transport: async (url) => {
      transportCalls.push(url.toString());
      if (url.pathname === "/start") {
        return {
          status: 302,
          headers: { location: "https://cdn.example/final" },
          body: emptyBody(),
          close: () => {
            redirectClosed = true;
          },
        };
      }
      return {
        status: 200,
        headers: { "content-type": "text/plain" },
        body: bodyFrom(Buffer.from("ok")),
        close: () => undefined,
      };
    },
  }
);
assert.equal(redirected.bytes.toString("utf8"), "ok");
assert.deepEqual(lookupCalls, ["public.example", "cdn.example"]);
assert.equal(transportCalls.length, 2);
assert.equal(redirectClosed, true);

let unsafeRedirectTransportCalls = 0;
await assert.rejects(
  () =>
    fetchBinaryWithOutboundPolicy(
      "https://public.example/start",
      { label: "unsafe-redirect-test", timeoutMs: 1_000, maxBytes: 32 },
      {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => {
          unsafeRedirectTransportCalls += 1;
          return {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data" },
            body: emptyBody(),
            close: () => undefined,
          };
        },
      }
    ),
  /安全策略阻止/
);
assert.equal(unsafeRedirectTransportCalls, 1, "blocked redirect must not reach a second transport call");

let yieldedChunks = 0;
let oversizedResponseClosed = false;
await assert.rejects(
  () =>
    fetchBinaryWithOutboundPolicy(
      "https://public.example/large",
      { label: "stream-limit-test", timeoutMs: 1_000, maxBytes: 8 },
      {
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => ({
          status: 200,
          headers: {},
          body: (async function* () {
            for (let i = 0; i < 4; i += 1) {
              yieldedChunks += 1;
              yield Buffer.alloc(4, i);
            }
          })(),
          close: () => {
            oversizedResponseClosed = true;
          },
        }),
      }
    ),
  /响应过大/
);
assert.equal(yieldedChunks, 3, "stream reader must stop as soon as the cap is crossed");
assert.equal(oversizedResponseClosed, true);

const dangerousQuery = `topic & calc.exe | whoami > pwned.txt %PATH% $(touch /tmp/pwned) "quoted"`;
assert.equal(buildMcporterInvocation(dangerousQuery, 6, "win32"), undefined);
assert.equal(mcporterExecOptions("win32").shell, false);
const unixInvocation = buildMcporterInvocation(dangerousQuery, 6, "linux");
assert.ok(unixInvocation);
assert.equal(unixInvocation.options.shell, false);
assert.equal(unixInvocation.args.length, 2);
assert.equal(unixInvocation.args[0], "call");
assert.match(unixInvocation.args[1], /& calc\.exe/);
assert.match(unixInvocation.args[1], /numResults: 6/);

const parsedPublisher = parseAgentReachSearchOutput(
  JSON.stringify({ results: [{ title: "A domestic source", url: "https://www.36kr.com/p/123" }] }),
  "test"
)[0];
assert.equal(parsedPublisher.sourceName, "36kr.com");
assert.equal(parsedPublisher.region, "domestic");

assert.equal(await fetchSafeImageBinary("http://127.0.0.1/private.png", 100, 100), undefined);
const unsafeImageItem: ResearchItem = {
  id: "unsafe-image",
  sourceKind: "article",
  sourceName: "Example",
  sourceId: "example",
  region: "global",
  title: "Unsafe image",
  summary: "",
  url: "https://example.com/article",
  imageUrl: "http://169.254.169.254/image.png",
  publishedAt: "",
  authors: [],
  query: "test",
};
const [sanitizedImageItem] = await enrichResearchImages([unsafeImageItem], 1);
assert.equal(sanitizedImageItem.imageUrl, undefined);

console.log("Research network security tests passed.");

function emptyBody(): AsyncIterable<Uint8Array> {
  return bodyFrom();
}

function bodyFrom(...chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}
