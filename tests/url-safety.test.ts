import { describe, expect, it } from "vitest";
import { isPrivateAddress, isPrivateOrLocalUrl } from "@/lib/url-safety";

describe("url safety", () => {
  it("blocks local and private IPv4 targets", () => {
    expect(isPrivateOrLocalUrl(new URL("http://localhost:3000"))).toBe(true);
    expect(isPrivateOrLocalUrl(new URL("http://127.0.0.1"))).toBe(true);
    expect(isPrivateOrLocalUrl(new URL("http://10.0.0.5"))).toBe(true);
    expect(isPrivateOrLocalUrl(new URL("http://172.16.0.1"))).toBe(true);
    expect(isPrivateOrLocalUrl(new URL("http://192.168.1.10"))).toBe(true);
  });

  it("allows ordinary public hosts and public IPv4 targets", () => {
    expect(isPrivateOrLocalUrl(new URL("https://example.com"))).toBe(false);
    expect(isPrivateOrLocalUrl(new URL("https://8.8.8.8"))).toBe(false);
  });

  it("blocks private IPv6 addresses", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
  });
});
