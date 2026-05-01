import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { AuditService } from '../src/services/audit-service';
import { AiService } from '../src/services/ai-service';
import { getPageSignals } from '../src/lib/audit-helpers';

async function testDynamicUrl(url: string) {
  console.log(`\n---------------------------------------------------------`);
  console.log(`🔍 DYNAMIC TESTING: ${url}`);
  console.log(`---------------------------------------------------------`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Step 1: Fetching Dynamic DOM...");
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    
    // Wait for any lazy-loaded content
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    const title = await page.title();
    const screenshot = await page.screenshot({ type: 'png' });
    const screenshotBase64 = screenshot.toString('base64');
    
    console.log("Step 2: Signal Extraction from Live DOM...");
    const $ = cheerio.load(content);
    const signals = getPageSignals($);
    
    console.log(`   - Title: "${title}"`);
    console.log(`   - CTAs Found: ${signals.ctas.length} (${signals.ctas.slice(0,3).join(', ')}...)`);
    console.log(`   - Total Text Length: ${signals.text.length} chars`);
    console.log(`   - Images Found: ${signals.imageCount} (Missing Alt: ${signals.imagesMissingAlt})`);
    console.log(`   - Mobile Viewport Detected: ${signals.hasViewport ? "✅ Yes" : "❌ No"}`);

    console.log("Step 3: Running Audit Pipeline...");
    const visionProvider = AiService.getVisionModel();
    
    const result = await AuditService.runFullAudit(
      visionProvider!,
      null,
      [screenshotBase64],
      null,
      { url, title, text: signals.text, signals }
    );

    console.log(`\n✅ RESULT FOR ${url}:`);
    console.log(`   - Score: ${result.launchScore}`);
    console.log(`   - Verdict: ${result.verdict.toUpperCase()}`);
    console.log(`   - Analysis Mode: ${result.analysisMode}`);
    console.log(`   - Summary: ${result.summary.substring(0, 100)}...`);

  } catch (err) {
    console.error(`❌ Dynamic Test Failed for ${url}:`, err);
  } finally {
    await browser.close();
  }
}

async function main() {
  const urls = ["https://example.com", "https://stripe.com"];
  for (const url of urls) {
    await testDynamicUrl(url);
  }
}

main().catch(console.error);
