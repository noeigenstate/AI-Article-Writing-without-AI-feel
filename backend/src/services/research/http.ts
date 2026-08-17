/** Options bounding a text fetch: a label for errors, a timeout, and a size cap. */
export interface TextFetchOptions {
  label: string;
  timeoutMs: number;
  maxBytes: number;
}

/** Result of a bounded text fetch. */
export interface TextFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

/**
 * Fetch text with an abort timeout and a maximum response size.
 *
 * @param input URL or Request input.
 * @param init Fetch init (headers, method, etc.).
 * @param options Label, timeout, and byte cap.
 * @returns `{ ok, status, text }`.
 * @throws Error on timeout or when the response exceeds `maxBytes`.
 */
export async function fetchTextWithTimeout(
  input: string | URL,
  init: RequestInit,
  options: TextFetchOptions
): Promise<TextFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    const text = await readLimitedText(res, options.maxBytes, controller);
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      throw new Error(`${options.label} 响应过大`);
    }
    if (isAbortError(error)) {
      throw new Error(`${options.label} 请求超时`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class ResponseTooLargeError extends Error {}

/**
 * Stream and decode a response, stopping as soon as the decoded body crosses
 * `maxBytes`. Fetch transparently decodes content encodings before exposing
 * `res.body`, so the counter bounds the bytes the application actually reads.
 */
async function readLimitedText(res: Response, maxBytes: number, controller: AbortController): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("maxBytes must be a non-negative safe integer");
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    await cancelResponseBody(res, controller);
    throw new ResponseTooLargeError();
  }

  if (!res.body) return "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parts: string[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        try {
          await reader.cancel("response body exceeded configured limit");
        } catch {
          // The size error remains authoritative even if transport teardown fails.
        }
        controller.abort();
        throw new ResponseTooLargeError();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

/** Cancel an unread/partially-read body and its request without masking the size error. */
async function cancelResponseBody(res: Response, controller: AbortController): Promise<void> {
  try {
    await res.body?.cancel("response body exceeded configured limit");
  } catch {
    // Best-effort transport teardown.
  }
  controller.abort();
}

/** True if the error is a fetch abort (timeout). */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
