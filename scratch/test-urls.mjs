import fs from 'fs';

async function testUrl(url) {
  console.log(`\nTesting DOM & Audit for: ${url}...`);
  const formData = new FormData();
  formData.append('url', url);
  
  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      console.log(`Error ${res.status}: ${await res.text()}`);
      return;
    }
    
    const data = await res.json();
    console.log(`\n--- Audit Results for ${url} ---`);
    console.log(`Title: ${data.title}`);
    console.log(`Score: ${data.launchScore}`);
    console.log(`Verdict: ${data.verdict}`);
    console.log(`Total Issues Found: ${data.issues ? data.issues.length : 0}`);
    console.log(`Lighthouse Fetched: ${!!data.lighthouse}`);
    console.log(`AI Provider Used: ${data.provider}`);
    if (data.warning) console.log(`Warning: ${data.warning}`);
    
    const filename = `scratch/result-${new URL(url).hostname}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Saved full report to ${filename}`);
  } catch (err) {
    console.error(`Failed to test ${url}:`, err.message);
  }
}

async function run() {
  await testUrl('https://shubhambhattacharya.dev/#home');
  await testUrl('https://gigienergy.com/');
}

run();
