export interface TextFetchOptions {
  label: string;
  timeoutMs: number;
  maxBytes: number;
}

export interface TextFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
