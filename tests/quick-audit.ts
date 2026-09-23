import fetch from "node-fetch";

async function quickAudit() {
  const res = await fetch("http://localhost:3000/api/smart-evolution/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer mock_token_admin" },
    body: JSON.stringify({
      workspaceId: "ws_quick",
      userId: "usr_quick",
      memories: [{ title: "مستودع جدة", category: "Operations", riskLevel: "Critical", decision: "تأجيل 40%" }],
      riskAlerts: [],
      lang: "ar"
    })
  });
  const text = await res.text();
  console.log("SMART RAW RESPONSE START:", text.substring(0, 300));
  try {
    const json = JSON.parse(text);
    console.log("SMART NATIVE JSON: YES, Keys:", Object.keys(json));
  } catch {
    console.log("SMART NATIVE JSON: NO (requires extraction/repair)");
  }
}
quickAudit();
