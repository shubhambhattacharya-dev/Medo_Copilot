import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { AuditService } from '../src/services/audit-service';
import { AiService } from '../src/services/ai-service';
import { getPageSignals } from '../src/lib/audit-helpers';

async function runRealAudit(url: string) {
  console.log(`\n🚀 Starting Real Audit for: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log("Step 1: Navigating to URL...");
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    
    console.log("Step 2: Extracting content and signals...");
    const content = await page.content();
    const title = await page.title();
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const screenshotBase64 = screenshot.toString('base64');
    
    const $ = cheerio.load(content);
    const signals = getPageSignals($);
    
    console.log(`Extracted Signals: ${signals.ctas.length} CTAs, Title: ${signals.title}`);

    console.log("Step 3: Initializing AI Provider...");
    const providerName = process.argv[3];
    const visionProvider = providerName 
      ? AiService.getVisionModel(providerName) 
      : AiService.getVisionModel();

    if (!visionProvider) {
      throw new Error(`Failed to initialize AI provider ${providerName || 'default'}. Check API keys.`);
    }

    console.log(`Step 4: Running Full AI Audit using ${visionProvider.name}...`);
    const result = await AuditService.runFullAudit(
      visionProvider,
      null, // No code analysis for this test
      [screenshotBase64],
      null,
      { url, title, text: signals.text, signals }
    );

    console.log("\n✅ Audit Complete!");
    console.log(`Score: ${result.launchScore}`);
    console.log(`Verdict: ${result.verdict}`);
    console.log(`Summary: ${result.summary}`);
    console.log(`Total Issues Found: ${result.issues.length}`);
    
    if (result.issues.length > 0) {
      console.log("Top Issues:");
      result.issues.slice(0, 3).forEach(i => console.log(` - [${i.severity}] ${i.title}`));
    }

  } catch (err) {
    console.error("❌ Audit Failed:", err);
  } finally {
    await browser.close();
  }
}

async function main() {
  const targetUrl = process.argv[2] || "https://www.openai.com";
  await runRealAudit(targetUrl);
}

main().catch(console.error);
