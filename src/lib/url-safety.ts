import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "@/lib/custom-errors";

export function isPrivateOrLocalUrl(targetUrl: URL) {
  const hostname = targetUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (["localhost", "127.0.0.1", "0.0.0.0", "::", "::1"].includes(hostname)) {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return mapped.includes(".") ? isPrivateAddress(mapped) : true;
  }

  if (normalized.includes(".")) {
    return isPrivateOrLocalUrl(new URL(`http://${normalized}`));
  }

  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) {
    return true;
  }

  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  return false;
}

export async function assertPublicHttpUrl(targetUrl: URL) {
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    throw new ValidationError("Only HTTP and HTTPS URLs can be audited");
  }

  if (isPrivateOrLocalUrl(targetUrl)) {
    throw new ValidationError("Use a public preview URL. Localhost and private network URLs cannot be audited safely.");
  }

  if (isIP(targetUrl.hostname)) {
    return;
  }

  try {
    const addresses = await lookup(targetUrl.hostname, { all: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new ValidationError("Use a public preview URL. URLs resolving to private network addresses cannot be audited safely.");
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Could not resolve the URL hostname. Use a publicly reachable preview URL.");
  }
}
