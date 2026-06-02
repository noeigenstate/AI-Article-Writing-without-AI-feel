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
    const text = await readLimitedText(res, options.maxBytes);
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${options.label} 请求超时`);
    }
    if (error instanceof ResponseTooLargeError) {
      throw new Error(`${options.label} 响应过大`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class ResponseTooLargeError extends Error {}

/** Read a response as text, rejecting if it exceeds `maxBytes`. */
async function readLimitedText(res: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new ResponseTooLargeError();
  }

  const text = await res.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ResponseTooLargeError();
  }

  return text;
}

/** True if the error is a fetch abort (timeout). */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
