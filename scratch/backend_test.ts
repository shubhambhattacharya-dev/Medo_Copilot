import { StaticAnalyzer } from '../src/lib/static-analyzer';

const sampleCode = `
const express = require('express');
const app = express();

// Issue 1: Hardcoded secret (Security)
const API_KEY = "AIzaSyD-1234567890abcdef";

app.get('/data', async (req, res) => {
  // Issue 2: Missing error handling (Reliability)
  const data = await db.query("SELECT * FROM users");
  
  // Issue 3: Console log in production (Maintainability)
  console.log("Fetched data:", data);
  
  res.json(data);
});

app.listen(3000);
`;

function testBackendAnalysis() {
  console.log("🔍 Testing Backend Static Analysis...");
  
  const metrics = StaticAnalyzer.analyze(sampleCode);
  
  console.log("\n📊 Backend Scores:");
  console.log(`   - Security: ${metrics.security}/100`);
  console.log(`   - Code Quality: ${metrics.codeQuality}/100`);
  console.log(`   - Maintainability: ${metrics.maintainability}/100`);
  
  const avg = Math.round((metrics.security + metrics.codeQuality + metrics.maintainability) / 3);
  console.log(`\n✅ Final Backend Score: ${avg}`);
}

testBackendAnalysis();
