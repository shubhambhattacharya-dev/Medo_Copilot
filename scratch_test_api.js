async function testApi() {
  console.log("Sending request to local /api/analyze...");
  try {
    const res = await fetch("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://gigienergy.com/" })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("API Error:", data);
      return;
    }
    console.log("\n=== AUDIT SUCCESS ===");
    console.log("Score:", data.launchScore);
    console.log("Provider:", data.provider || "unknown");
    console.log("\nThinking Process:");
    console.log(data.thoughtProcess ? data.thoughtProcess.join("\n") : "None");
    console.log("\nIssues:");
    data.issues.forEach((iss, i) => {
      console.log(`${i+1}. [${iss.severity}] ${iss.title}`);
    });
  } catch (err) {
    console.error("Network Error:", err);
  }
}
testApi();
