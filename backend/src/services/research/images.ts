import { cached } from "./cache.js";
import { fetchTextWithTimeout } from "./http.js";
import type { ResearchItem } from "./types.js";

/**
 * Attach a representative image URL to the first few items that lack one.
 *
 * Fetches each source page and reads its og:image/twitter:image; failures are
 * ignored so enrichment never blocks generation.
 *
 * @param items Research items.
 * @param limit Max items to attempt (default 6).
 * @returns The items, with `imageUrl` filled in where found.
 */
export async function enrichResearchImages(items: ResearchItem[], limit = 6): Promise<ResearchItem[]> {
  const candidates = items.slice(0, limit);
  const imageEntries = await Promise.all(
    candidates.map(async (item) => {
      if (item.imageUrl) {
        return [item.id, item.imageUrl] as const;
      }
      const imageUrl = await fetchSourceImage(item.url).catch(() => undefined);
      return imageUrl ? ([item.id, imageUrl] as const) : undefined;
    })
  );
  const imageMap = new Map(imageEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)));

  return items.map((item) => {
    const imageUrl = imageMap.get(item.id);
    return imageUrl ? { ...item, imageUrl } : item;
  });
}

/** Fetch a page and extract its social-preview image (cached 24h). */
async function fetchSourceImage(url: string): Promise<string | undefined> {
  return cached(`source-image:${url}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetchTextWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "SpeakPlainlyResearch/0.1 (+local development)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      { label: "source image", timeoutMs: 8_000, maxBytes: 700_000 }
    );
    if (!res.ok) {
      return undefined;
    }
    return extractSourceImageFromHtml(res.text, url);
  });
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
