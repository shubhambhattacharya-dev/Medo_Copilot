import type { BackendMetrics } from "@/types/audit";

/**
 * A lightweight Static Code Analyzer that acts as a "Lighthouse for Backend".
 * It runs deterministic regex checks over the entire repository text
 * to calculate Security, Quality, and Maintainability scores.
 */
export class StaticAnalyzer {
  static analyze(githubCodeText: string): BackendMetrics {
    if (!githubCodeText || githubCodeText.trim().length === 0) {
      return { security: 0, codeQuality: 0, maintainability: 0 };
    }

    const files = githubCodeText.split(/=== FILE:.*?===/g).filter(Boolean);
    const totalFiles = files.length || 1;

    let securityScore = 100;
    let qualityScore = 100;
    let maintainabilityScore = 100;

    // ─── 1. SECURITY CHECKS (Weight: Heavy penalties) ───
    
    // Check 1: Hardcoded Secrets
    const secretRegex = /['"](sk_test_|sk_live_|pk_|ghp_|AKIA|eyJ)[a-zA-Z0-9_-]{10,}['"]/g;
    const secretsFound = (githubCodeText.match(secretRegex) || []).length;
    securityScore -= Math.min(secretsFound * 25, 60);

    // Check 2: Missing env validation
    if (!githubCodeText.includes("process.env.") && githubCodeText.includes("DATABASE_URL")) {
      securityScore -= 10;
    }

    // Check 3: Dangerous usage
    const dangerousRegex = /(eval\(|exec\(|dangerouslySetInnerHTML)/g;
    const dangerousFound = (githubCodeText.match(dangerousRegex) || []).length;
    securityScore -= Math.min(dangerousFound * 15, 30);

    // ─── 2. CODE QUALITY CHECKS ───
    
    // Check 1: Excessive console.logs (excluding error logs)
    const logRegex = /console\.log\(/g;
    const logsFound = (githubCodeText.match(logRegex) || []).length;
    if (logsFound > totalFiles * 2) {
      qualityScore -= Math.min((logsFound - totalFiles * 2) * 2, 30);
    }

    // Check 2: 'any' types in TypeScript
    const anyRegex = /:\s*any[\s,;>]/g;
    const anyFound = (githubCodeText.match(anyRegex) || []).length;
    if (anyFound > 0) {
      qualityScore -= Math.min(anyFound * 5, 40);
    }

    // Check 3: Missing Try/Catch in Async (heuristic)
    const asyncRegex = /async\s+function|async\s*\(/g;
    const tryCatchRegex = /try\s*\{/g;
    const asyncFound = (githubCodeText.match(asyncRegex) || []).length;
    const tryCatchFound = (githubCodeText.match(tryCatchRegex) || []).length;
    if (asyncFound > 0 && tryCatchFound < asyncFound / 2) {
      qualityScore -= 20; // Penalty if fewer than half of async functions have try/catch
    }

    // ─── 3. MAINTAINABILITY CHECKS ───

    // Check 1: Monolithic files
    let monolithicFiles = 0;
    let deepNesting = 0;

    for (const fileText of files) {
      const lineCount = fileText.split('\n').length;
      if (lineCount > 400) monolithicFiles++;
      
      // Heuristic for deep nesting (e.g. 5 tabs/spaces deep)
      const deepIndentRegex = /^( {10,}|\t{5,})/gm;
      const deeplyNestedLines = (fileText.match(deepIndentRegex) || []).length;
      if (deeplyNestedLines > 10) deepNesting++;
    }

    maintainabilityScore -= Math.min(monolithicFiles * 15, 50);
    maintainabilityScore -= Math.min(deepNesting * 10, 40);

    // Final Boundaries
    return {
      security: Math.max(0, Math.min(100, securityScore)),
      codeQuality: Math.max(0, Math.min(100, qualityScore)),
      maintainability: Math.max(0, Math.min(100, maintainabilityScore)),
    };
  }
}
