import assert from "node:assert/strict";
import { fetchTextWithTimeout } from "../services/research/http.js";

const originalFetch = globalThis.fetch;

try {
  let produced = 0;
  let cancelled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>(
        {
          pull(stream) {
            produced += 1;
            stream.enqueue(new Uint8Array(6).fill(65 + produced));
            if (produced === 10) stream.close();
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 }
      )
    );

  await assert.rejects(
    () =>
      fetchTextWithTimeout("https://example.test/chunked", {}, {
        label: "chunked-test",
        timeoutMs: 1_000,
        maxBytes: 8,
      }),
    /chunked-test 响应过大/
  );
  assert.equal(cancelled, true, "an oversized stream must be cancelled");
  assert.equal(produced, 2, "streaming must stop on the first chunk that crosses the cap");

  const chineseBytes = new TextEncoder().encode("中");
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(chineseBytes);
          stream.close();
        },
      })
    );
  await assert.rejects(
    () =>
      fetchTextWithTimeout("https://example.test/unicode", {}, {
        label: "unicode-test",
        timeoutMs: 1_000,
        maxBytes: 2,
      }),
    /unicode-test 响应过大/,
    "the limit must count UTF-8 bytes rather than JavaScript characters"
  );

  globalThis.fetch = async () => new Response(null, { status: 204 });
  const empty = await fetchTextWithTimeout("https://example.test/empty", {}, {
    label: "empty-test",
    timeoutMs: 1_000,
    maxBytes: 8,
  });
  assert.deepEqual(empty, { ok: true, status: 204, text: "" });

  globalThis.fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const rejectAbort = () => reject(new DOMException("aborted", "AbortError"));
      if (signal?.aborted) rejectAbort();
      else signal?.addEventListener("abort", rejectAbort, { once: true });
    });
  await assert.rejects(
    () =>
      fetchTextWithTimeout("https://example.test/slow", {}, {
        label: "timeout-test",
        timeoutMs: 5,
        maxBytes: 8,
      }),
    /timeout-test 请求超时/
  );

  console.log("Research HTTP streaming security tests passed.");
} finally {
  globalThis.fetch = originalFetch;
}
