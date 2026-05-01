import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { AuditService } from '../src/services/audit-service';
import { AiService } from '../src/services/ai-service';

async function runMasterTest() {
  console.log("🏆 MASTER AUDIT TEST: Combined Frontend + Backend Analysis");
  console.log("=========================================================");

  // 1. Mock Signals (Frontend)
  const signals = {
    title: "Portfolio",
    metaDescription: "My developer portfolio",
    text: "I build amazing apps. Contact me.",
    contentLength: 50,
    ctas: ["Contact Me"],
    links: ["/github"],
    imageCount: 1,
    imagesMissingAlt: 1,
    hasViewport: true
  };

  // 2. Mock Backend Code (GitHub)
  const githubCode = `
    const API_KEY = "AIzaSyD-12345";
    async function getData() {
      return await fetch('/api'); // No try-catch
    }
  `;

  console.log("Step 1: Running Orchestration Logic...");
  const visionProvider = AiService.getVisionModel();
  
  // We'll simulate runFullAudit results by calling the internals or mocking the providers
  // But to be MOST authentic, let's just use the real AuditService with our mock data
  
  const result = await AuditService.runFullAudit(
    visionProvider!,
    null, // Skip AI Code Provider for this test
    [],   // No screenshots
    githubCode,
    { url: "https://mysite.com", title: "Portfolio", text: signals.text, signals }
  );

  console.log("\n📊 COMBINED RESULTS:");
  console.log(`   - Launch Score: ${result.launchScore} (Average of Frontend & Backend)`);
  console.log(`   - Frontend Score: ${result.frontendScore}`);
  console.log(`   - Backend Score: ${result.backendScore}`);
  console.log(`   - Verdict: ${result.verdict.toUpperCase()}`);
  console.log(`   - Analysis Mode: ${result.analysisMode}`);
  
  console.log("\n🚩 Integrated Issues:");
  result.issues.forEach(i => {
    console.log(`   [${i.category}] [${i.severity.toUpperCase()}] ${i.title}`);
  });

  console.log("\n📝 Summary:");
  console.log(`   ${result.summary}`);

  // Verification Logic
  if (result.launchScore > 0 && result.issues.length > 0) {
    console.log("\n✅ MASTER TEST PASSED: Full pipeline orchestration verified.");
  } else {
    console.log("\n❌ MASTER TEST FAILED: Score or Issues missing.");
  }
}

runMasterTest().catch(console.error);
