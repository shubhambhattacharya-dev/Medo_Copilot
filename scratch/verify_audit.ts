import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { AiService } from '../src/services/ai-service';
import { buildRuleIssues, buildMeasuredResult } from '../src/lib/audit-helpers';
import { FRONTEND_CATEGORIES } from '../src/types/audit';

async function testScenario(name: string, signals: any) {
  console.log(`\n--- Testing Scenario: ${name} ---`);
  
  const issues = buildRuleIssues(signals);
  const result = buildMeasuredResult({
    issues,
    url: "https://example.com",
    lighthouse: null,
    backendMetrics: null
  });

  console.log(`Frontend Score: ${result.launchScore}`);
  console.log(`Issues Count: ${result.issues.length}`);
  console.log(`Issues: ${result.issues.map(i => `[${i.severity}] ${i.title}`).join(', ')}`);
}

async function main() {
  // Scenario 1: High Quality Site
  await testScenario("High Quality (CTA present, Good content)", {
    title: "Medo Copilot",
    metaDescription: "Launch your app with confidence.",
    text: "The ultimate audit tool for your startup. Join thousands of founders.",
    contentLength: 1500,
    ctas: ["Get Started", "Learn More"],
    links: ["/pricing", "/docs"],
    imageCount: 10,
    imagesMissingAlt: 0,
    hasViewport: true
  });

  // Scenario 2: Poor Site (Missing CTA, Sparse)
  await testScenario("Poor Quality (No CTA, Sparse)", {
    title: "Empty Page",
    metaDescription: "",
    text: "Hello world.",
    contentLength: 10,
    ctas: [],
    links: [],
    imageCount: 0,
    imagesMissingAlt: 0,
    hasViewport: true
  });

  // Scenario 3: Broken (Non-responsive, missing metadata)
  await testScenario("Broken (Missing Meta, Missing Alt Text)", {
    title: "Test",
    metaDescription: "",
    text: "Some random text here.",
    contentLength: 100,
    ctas: ["Click me"],
    links: [],
    imageCount: 5,
    imagesMissingAlt: 5,
    hasViewport: false
  });
}

main().catch(console.error);
