import { cached } from "./cache.js";
import {
  fetchBinaryWithOutboundPolicy,
  fetchTextWithOutboundPolicy,
  validateOutboundUrl,
} from "./networkSafety.js";
import type { ResearchItem } from "./types.js";

const SOURCE_PAGE_MAX_BYTES = 700_000;
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export interface SafeImageBinary {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif";
  finalUrl: string;
}

/**
 * Attach a representative image URL to the first few items that lack one.
 *
 * Fetches each source page and reads its og:image/twitter:image; failures are
 * ignored so enrichment never blocks generation.
 *
 * @param items Research items.
 * @param limit Max items to attempt (default 12).
 * @returns The items, with `imageUrl` filled in where found.
 */
export async function enrichResearchImages(items: ResearchItem[], limit = 12): Promise<ResearchItem[]> {
  const candidates = items.slice(0, limit);
  const imageEntries = await Promise.all(
    candidates.map(async (item) => {
      if (item.imageUrl) {
        const safeUrl = await validateOutboundUrl(item.imageUrl)
          .then(() => item.imageUrl)
          .catch(() => undefined);
        return [item.id, safeUrl] as const;
      }
      const imageUrl = await fetchSourceImage(item.url).catch(() => undefined);
      return [item.id, imageUrl] as const;
    })
  );
  const imageMap = new Map<string, string | undefined>(imageEntries);

  return items.map((item) => {
    if (!imageMap.has(item.id)) {
      return item;
    }
    const imageUrl = imageMap.get(item.id);
    return { ...item, imageUrl };
  });
}

/** Fetch a page and extract its social-preview image (cached 24h). */
async function fetchSourceImage(url: string): Promise<string | undefined> {
  return cached(`source-image:${url}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetchTextWithOutboundPolicy(
      url,
      {
        label: "source image",
        timeoutMs: 8_000,
        maxBytes: SOURCE_PAGE_MAX_BYTES,
        headers: {
          "User-Agent": "SpeakPlainlyResearch/0.1 (+local development)",
          Accept: "text/html,application/xhtml+xml",
        },
      }
    );
    if (!res.ok) {
      return undefined;
    }
    const imageUrl = extractSourceImageFromHtml(res.text, res.url);
    if (!imageUrl) {
      return undefined;
    }
    await validateOutboundUrl(imageUrl);
    return imageUrl;
  });
}

/**
 * Download a raster image through the SSRF-safe outbound policy.
 *
 * This is the single binary-image fetch entry point intended for article.ts:
 * it revalidates every redirect, pins the checked DNS result, streams with a
 * hard byte cap, and rejects SVG or MIME-spoofed content.
 */
export async function fetchSafeImageBinary(
  url: string,
  timeoutMs = 8_000,
  maxBytes = IMAGE_MAX_BYTES
): Promise<SafeImageBinary | undefined> {
  try {
    const res = await fetchBinaryWithOutboundPolicy(url, {
      label: "source image binary",
      timeoutMs,
      maxBytes,
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9" },
    });
    if (!res.ok || res.bytes.length === 0) {
      return undefined;
    }

    const declaredMime = normalizeImageMime(res.headers["content-type"]);
    const detectedMime = detectRasterImageMime(res.bytes);
    if (!declaredMime || !detectedMime || declaredMime !== detectedMime) {
      return undefined;
    }
    return { bytes: res.bytes, mimeType: detectedMime, finalUrl: res.url };
  } catch {
    return undefined;
  }
}

/**
 * Extract a preview image URL from HTML (og:image, twitter:image, image_src).
 *
 * @param html The page HTML.
 * @param pageUrl The page URL, used to resolve relative image URLs.
 * @returns An absolute http(s) image URL, or undefined.
 */
export function extractSourceImageFromHtml(html: string, pageUrl: string): string | undefined {
  const patterns = [
    /<meta\b[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta\b[^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link\b[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const raw = pattern.exec(html)?.[1];
    const resolved = resolveImageUrl(raw, pageUrl);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

/** Resolve a raw image reference against the page URL; accept only http(s). */
function resolveImageUrl(raw: string | undefined, pageUrl: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw.replace(/&amp;/g, "&"), pageUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function normalizeImageMime(value: string | undefined): SafeImageBinary["mimeType"] | undefined {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/gif" ||
    mime === "image/webp" ||
    mime === "image/avif"
  ) {
    return mime;
  }
  return undefined;
}

function detectRasterImageMime(bytes: Buffer): SafeImageBinary["mimeType"] | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const signature = bytes.subarray(0, 12).toString("ascii");
  if (signature.startsWith("GIF87a") || signature.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return "image/avif";
    }
  }
  return undefined;
}
