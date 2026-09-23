import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function runAudit() {
  console.log("==========================================================");
  console.log(" 🧪 FINAL STRUCTURED OUTPUT INTEGRITY AUDIT (ZAKIR AI)");
  console.log("==========================================================");

  // 1. Cognitive Advisor / Agent Chat Audit
  console.log("\n--- AUDITING COGNITIVE ADVISOR (/api/agent/chat) ---");
  const resChat = await fetch(`${BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer mock_token_admin" },
    body: JSON.stringify({
      prompt: "ما هي القرارات المتخذة بشأن مستودع جدة؟",
      query: "ما هي القرارات المتخذة بشأن مستودع جدة؟",
      memories: [{ title: "مستودع جدة", category: "Operations", riskLevel: "Critical", decision: "تأجيل 40%" }],
      riskAlerts: [],
      lang: "ar"
    })
  });
  const chatData = await resChat.json() as any;
  console.log("Cognitive Advisor Response Type:", typeof chatData);
  console.log("Cognitive Advisor Keys:", Object.keys(chatData));
  console.log("Text Snippet:", (chatData.text || "").substring(0, 100));

  // 2. Smart Evolution Audit
  console.log("\n--- AUDITING SMART EVOLUTION (/api/smart-evolution/run) ---");
  const resSmart = await fetch(`${BASE_URL}/api/smart-evolution/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer mock_token_admin" },
    body: JSON.stringify({
      workspaceId: "ws_audit_test",
      userId: "usr_audit",
      memories: [{ title: "تأجيل مستودع جدة", category: "Operations", riskLevel: "Critical", decision: "تأجيل 40%" }],
      riskAlerts: [{ title: "مخاطر العملة", severity: "High" }],
      lang: "ar"
    })
  });
  const smartRawText = await resSmart.text();
  let smartJson: any = null;
  let isNativeJsonSmart = false;
  try {
    smartJson = JSON.parse(smartRawText);
    isNativeJsonSmart = Boolean(smartJson.executiveSummary || smartJson.risksList);
  } catch (e) {
    // Check if JSON exists in markdown fence
    const match = smartRawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        smartJson = JSON.parse(match[0]);
      } catch {}
    }
  }
  console.log("Smart Evolution Raw Text Length:", smartRawText.length);
  console.log("Smart Evolution Native JSON:", isNativeJsonSmart ? "YES" : "NO");
  console.log("Smart Evolution Parsed Keys:", smartJson ? Object.keys(smartJson) : "None");

  // 3. Market Intelligence Audit
  console.log("\n--- AUDITING MARKET INTELLIGENCE (/api/market-intelligence/run) ---");
  const resMarket = await fetch(`${BASE_URL}/api/market-intelligence/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer mock_token_admin" },
    body: JSON.stringify({
      topic: "أسعار عقود إيجارات المستودعات",
      industry: "الخدمات اللوجستية",
      context: "جدة والرياض",
      countries: ["السعودية"],
      focus: "تأثير إيجارات المستودعات",
      lang: "ar",
      internalEvidence: [{ title: "تأجيل مستودع جدة", detail: "ارتفاع الإيجارات 28%" }]
    })
  });
  const marketRawText = await resMarket.text();
  let marketJson: any = null;
  let isNativeJsonMarket = false;
  try {
    marketJson = JSON.parse(marketRawText);
    isNativeJsonMarket = Boolean(marketJson.summary || marketJson.marketOverview);
  } catch (e) {
    const match = marketRawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        marketJson = JSON.parse(match[0]);
      } catch {}
    }
  }
  console.log("Market Intelligence Raw Text Length:", marketRawText.length);
  console.log("Market Intelligence Native JSON:", isNativeJsonMarket ? "YES" : "NO");
  console.log("Market Intelligence Parsed Keys:", marketJson ? Object.keys(marketJson) : "None");

  console.log("==========================================================");
  console.log(" 🏁 AUDIT DATA GATHERED SUCCESSFULLY");
  console.log("==========================================================");
}

runAudit();
