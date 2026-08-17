const CONTROL_OR_ENCODED_CONTROL = /\p{Cc}|%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f]|c2%(?:8[0-9a-f]|9[0-9a-f]))/iu;

/**
 * Keep attribution links on ordinary public HTTP(S) pages.
 *
 * Research metadata is untrusted. In particular, do not turn credentials,
 * local-network targets, or unusual ports into clickable links in the UI or
 * exported Markdown.
 */
export function safePublicSourcePageUrl(value: string | undefined): string | undefined {
  if (!value || value.length > 2048 || CONTROL_OR_ENCODED_CONTROL.test(value)) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.port) return undefined;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
    if (!hostname || isLocalHostname(hostname) || isNonPublicIpLiteral(hostname)) return undefined;

    return url.href;
  } catch {
    return undefined;
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "localhost.localdomain"
    || hostname === "ip6-localhost"
    || hostname === "ip6-loopback"
    || hostname === "metadata"
    || hostname === "metadata.google.internal"
    || hostname === "instance-data"
    || hostname.endsWith(".localhost")
    || hostname === "local"
    || hostname.endsWith(".local")
    || hostname === "internal"
    || hostname.endsWith(".internal")
    || hostname === "lan"
    || hostname.endsWith(".lan")
    || hostname === "home"
    || hostname.endsWith(".home")
    || hostname === "home.arpa"
    || hostname.endsWith(".home.arpa");
}

function isNonPublicIpLiteral(hostname: string): boolean {
  const ipv4 = parseIpv4(hostname);
  if (ipv4) return isNonPublicIpv4(ipv4);
  if (!hostname.includes(":")) return false;

  const normalized = hostname.toLowerCase();
  if (normalized.startsWith("::")) return true;
  if (/^(?:fc|fd)/u.test(normalized) || /^fe[89a-f]/u.test(normalized) || /^ff/u.test(normalized)) return true;
  if (normalized.startsWith("2001:db8:") || normalized === "2001:db8::") return true;
  if (normalized.startsWith("2001::") || normalized.startsWith("2001:0:") || normalized.startsWith("2001:2:")) return true;
  if (/^2001:(?:1[0-9a-f]|2[0-9a-f]):/u.test(normalized)) return true;
  if (normalized.startsWith("64:ff9b:") || normalized.startsWith("100:") || normalized.startsWith("2002:")) return true;

  const mapped = normalized.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/u);
  return mapped ? isNonPublicIpv4(parseIpv4(mapped[1]) ?? [0, 0, 0, 0]) : false;
}

function parseIpv4(hostname: string): [number, number, number, number] | undefined {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)) return undefined;
  const octets = hostname.split(".").map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return undefined;
  return octets as [number, number, number, number];
}

function isNonPublicIpv4([a, b, c, d]: [number, number, number, number]): boolean {
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 168 && b === 63 && c === 129 && d === 16)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}
