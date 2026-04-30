export async function fetchGithubRepoCode(githubUrl: string): Promise<{ text: string, reason?: string }> {
  try {
    let url = githubUrl.replace("https://github.com/", "").replace(/\/$/, "");
    const parts = url.split("/");
    if (parts.length < 2) return { text: "", reason: "Invalid GitHub URL format." };
    const owner = parts[0];
    const repo = parts[1];

    console.log(`Fetching GitHub tree for ${owner}/${repo}...`);
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) return { text: "", reason: "Could not access GitHub repo. Make sure it is public." };
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
    if (!treeRes.ok) return { text: "", reason: "Could not fetch repository tree." };
    const treeData = await treeRes.json();
    
    if (!treeData || !treeData.tree) {
      return { text: "", reason: "Could not read repository tree (maybe GitHub API rate limit)." };
    }

    const backendFiles = treeData.tree.filter((file: any) => {
      if (file.type !== "blob") return false;
      const path = file.path.toLowerCase();
      if (path.includes("node_modules") || path.includes(".next") || path.includes("dist") || path.includes("build")) return false;
      if (path.includes("package-lock.json") || path.includes("yarn.lock") || path.includes(".png") || path.includes(".jpg")) return false;
      return path.includes("route.ts") || path.includes("route.js") || path.includes("server.js") || path.includes("schema.prisma") || path.includes("db.ts") || path.includes("db.js") || path.endsWith(".go") || path.endsWith(".py") || path.includes("actions.ts");
    }).slice(0, 5);

    if (backendFiles.length === 0) return { text: "", reason: "No obvious backend files found in the repository." };

    let codeText = `Repository: ${owner}/${repo}\n\n`;
    for (const file of backendFiles) {
      const fileRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`);
      if (fileRes.ok) {
        const content = await fileRes.text();
        codeText += `--- File: ${file.path} ---\n${content.substring(0, 3000)}\n\n`;
      }
    }

    return { text: codeText.substring(0, 15000) };
  } catch (e: any) {
    return { text: "", reason: `GitHub fetch error: ${e.message}` };
  }
}
