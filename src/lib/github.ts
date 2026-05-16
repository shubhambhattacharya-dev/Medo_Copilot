// Server-safe rate-limit cache (replaces browser-only sessionStorage)
const rateLimitCache = new Map<string, number>();

function parseGithubUrl(githubUrl: string) {
  const parsed = new URL(githubUrl);
  if (parsed.hostname !== "github.com") {
    return null;
  }

  const [owner, repo, treeSegment, ...branchParts] = parsed.pathname
    .split("/")
    .filter(Boolean);

  if (!owner || !repo) return null;
  if (treeSegment && treeSegment !== "tree") return null;

  return {
    owner,
    repo: repo.replace(/\.git$/i, ""),
    branch: branchParts.length > 0 ? branchParts.join("/") : null,
  };
}

function encodePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

export async function fetchGithubRepoCode(githubUrl: string): Promise<{ text: string, reason?: string }> {
  const RATE_LIMIT_KEY = "github-rl";
  try {
    // Check cached rate limit
    const cachedReset = rateLimitCache.get(RATE_LIMIT_KEY) ?? 0;
    if (cachedReset > Date.now()) {
      return { text: "", reason: "GitHub API rate limited. Try again later." };
    }

    const parsed = parseGithubUrl(githubUrl);
    if (!parsed) return { text: "", reason: "Invalid GitHub URL format." };
    const { owner, repo } = parsed;

    console.log(`Fetching GitHub tree for ${owner}/${repo}...`);
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "Accept": "application/vnd.github.v3+json" }
    });

    // Handle 403 rate limit
    if (repoRes.status === 403) {
      const reset = repoRes.headers.get("X-RateLimit-Reset");
      if (reset) {
        rateLimitCache.set(RATE_LIMIT_KEY, parseInt(reset) * 1000);
      }
      return { text: "", reason: "GitHub API rate limit reached." };
    }

    if (!repoRes.ok) return { text: "", reason: "Could not access GitHub repo. Make sure it is public." };
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";
    const branch = parsed.branch || defaultBranch;

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
      headers: { "Accept": "application/vnd.github.v3+json" }
    });

    // Handle 403 rate limit
    if (treeRes.status === 403) {
      const reset = treeRes.headers.get("X-RateLimit-Reset");
      if (reset) {
        rateLimitCache.set(RATE_LIMIT_KEY, parseInt(reset) * 1000);
      }
      return { text: "", reason: "GitHub API rate limit reached." };
    }

    if (!treeRes.ok) return { text: "", reason: "Could not fetch repository tree." };
    const treeData = await treeRes.json();

    if (!treeData || !treeData.tree) {
      return { text: "", reason: "Could not read repository tree (maybe GitHub API rate limit)." };
    }

    interface GitTreeItem {
      path: string;
      type: string;
    }

    const backendFiles = treeData.tree.filter((file: GitTreeItem) => {
      if (file.type !== "blob") return false;
      const path = file.path.toLowerCase();
      if (path.includes("node_modules") || path.includes(".next") || path.includes("dist") || path.includes("build")) return false;
      if (path.includes("package-lock.json") || path.includes("yarn.lock") || path.includes(".png") || path.includes(".jpg")) return false;
      return path.includes("route.ts") || path.includes("route.js") || path.includes("server.js") || path.includes("schema.prisma") || path.includes("db.ts") || path.includes("db.js") || path.endsWith(".go") || path.endsWith(".py") || path.includes("actions.ts");
    }).sort((a: GitTreeItem, b: GitTreeItem) => {
      const scorePath = (value: string) => {
        const path = value.toLowerCase();
        let score = 0;
        if (path.includes("route.")) score += 8;
        if (path.includes("actions.")) score += 7;
        if (path.includes("auth") || path.includes("api/")) score += 6;
        if (path.includes("db") || path.includes("schema.prisma")) score += 5;
        if (path.includes("middleware") || path.includes("proxy")) score += 4;
        return score;
      };
      return scorePath(b.path) - scorePath(a.path);
    }).slice(0, 20);

    if (backendFiles.length === 0) return { text: "", reason: "No obvious backend files found in the repository." };

    let codeText = `Repository: ${owner}/${repo}\nBranch: ${branch}\n\n`;
    for (const file of backendFiles) {
      const fileRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${encodePath(branch)}/${encodePath(file.path)}`);
      if (fileRes.ok) {
        const content = await fileRes.text();
        codeText += `--- File: ${file.path} ---\n${content.substring(0, 6000)}\n\n`;
      }
    }

    return { text: codeText.substring(0, 60000) };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    return { text: "", reason: `GitHub fetch error: ${errMsg}` };
  }
}
