import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGithubRepoCode } from "@/lib/github";
import { resetEnvCacheForTests } from "@/lib/env";

describe("github fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it("fetches prioritized backend files and sends an optional token", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    resetEnvCacheForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/app")) {
        return Response.json({ default_branch: "main" });
      }
      if (url.includes("/git/trees/main")) {
        return Response.json({
          tree: [
            { path: "src/app/api/analyze/route.ts", type: "blob" },
            { path: "README.md", type: "blob" },
          ],
        });
      }
      if (url.includes("raw.githubusercontent.com")) {
        return new Response("export async function POST() { return Response.json({ ok: true }); }");
      }
      return new Response("not found", { status: 404 });
    });

    const result = await fetchGithubRepoCode("https://github.com/acme/app");

    expect(result.text).toContain("src/app/api/analyze/route.ts");
    expect(result.text).toContain("POST");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
  });
});
