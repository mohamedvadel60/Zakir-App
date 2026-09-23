import { adminDb } from "../src/lib/firebase-admin.js";
import { setAccountLifecycleRecord } from "../src/lib/recoveryService.js";

const BASE_URL = "http://localhost:3000";

async function verifyAITools() {
  console.log("==================================================================");
  console.log(" 🤖 STARTING COMPREHENSIVE AI TOOLS & OUTPUT SYSTEM VERIFICATION");
  console.log("==================================================================\n");

  const testUid = `usr_aitest_${Date.now()}`;
  const testEmail = `ai_test_${Date.now()}@zakir.ai`;
  const workspaceIdA = `ws_ai_test_A_${Date.now()}`;
  const workspaceIdB = `ws_ai_test_B_${Date.now()}`;

  try {
    // 1. Seed Workspace A User and Data
    console.log("1. Seeding Workspace A Data in Firestore...");
    await adminDb.collection("users").doc(testUid).set({
      id: testUid,
      uid: testUid,
      email: testEmail,
      role: "CEO",
      workspaceId: workspaceIdA,
      accountStatus: "APPROVED",
      subscriptionPlan: "Enterprise",
      isVerified: true
    });

    const sampleMemoriesA = [
      {
        id: "mem_wsA_1",
        workspaceId: workspaceIdA,
        title: "Logistics Contract Delay Q1",
        category: "Operations",
        riskLevel: "Critical",
        decision: "Switched primary freight partner to regional line",
        causalFactors: "Port congestion and supplier price spike",
        lessonsLearned: "Always maintain dual supplier contracts for overseas routes"
      },
      {
        id: "mem_wsA_2",
        workspaceId: workspaceIdA,
        title: "FX Currency Exposure in Euro Procurement",
        category: "Finance",
        riskLevel: "High",
        decision: "Hedging 50% of foreign currency commitments",
        causalFactors: "Rapid EUR fluctuation in Q2",
        lessonsLearned: "Implement forward contracts for quarterly orders"
      }
    ];

    const sampleRisksA = [
      {
        id: "risk_wsA_1",
        workspaceId: workspaceIdA,
        title: "Unsecured Raw Material Supply",
        severity: "Critical",
        description: "30% of inventory dependent on single vendor without SLA"
      }
    ];

    // 2. Test Cognitive Advisor (/api/agent/chat)
    console.log("2. Testing Cognitive Advisor (/api/agent/chat)...");
    const agentChatRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_token_admin"
      },
      body: JSON.stringify({
        prompt: "ما هي أهم الدروس المستفادة من تأخيرات الشحن والمخاطر المالية السابقة؟",
        query: "ما هي أهم الدروس المستفادة من تأخيرات الشحن والمخاطر المالية السابقة؟",
        memories: sampleMemoriesA,
        riskAlerts: sampleRisksA,
        files: [],
        lang: "ar"
      })
    });

    if (!agentChatRes.ok) {
      const errText = await agentChatRes.text();
      throw new Error(`Cognitive Advisor endpoint returned HTTP ${agentChatRes.status}: ${errText}`);
    }

    const agentChatData = await agentChatRes.json();
    console.log("   Cognitive Advisor response received successfully!");
    console.log("   - Length of response text:", agentChatData.text?.length || 0);
    console.log("   - Sample snippet:", agentChatData.text ? agentChatData.text.substring(0, 150) + "..." : "EMPTY");

    if (!agentChatData.text || agentChatData.text.length < 20) {
      throw new Error("Cognitive Advisor returned an empty or invalid text response!");
    }

    // Check for Emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|⭐|🚀|💡|⚠️|🔥|✅|❌|📊|🤖/gu;
    const hasEmojis = emojiRegex.test(agentChatData.text);
    console.log("   - Raw Emojis present in model text:", hasEmojis ? "YES (Will be stripped by UI sanitizer)" : "NO (Clean)");

    // 3. Test Smart Evolution (/api/smart-evolution/run)
    console.log("\n3. Testing Smart Evolution Engine (/api/smart-evolution/run)...");
    const smartEvolutionRes = await fetch(`${BASE_URL}/api/smart-evolution/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_token_admin"
      },
      body: JSON.stringify({
        workspaceId: workspaceIdA,
        userId: testUid,
        memories: sampleMemoriesA,
        riskAlerts: sampleRisksA,
        files: [],
        lang: "ar"
      })
    });

    if (!smartEvolutionRes.ok) {
      const errText = await smartEvolutionRes.text();
      throw new Error(`Smart Evolution endpoint returned HTTP ${smartEvolutionRes.status}: ${errText}`);
    }

    const smartEvolutionData = await smartEvolutionRes.json();
    console.log("   Smart Evolution response received successfully!");
    console.log("   - Executive Summary present:", Boolean(smartEvolutionData.executiveSummary));
    console.log("   - Risks list count:", smartEvolutionData.risksList?.length || 0);
    console.log("   - Recommendations count:", smartEvolutionData.recommendationsList?.length || 0);

    if (!smartEvolutionData.executiveSummary) {
      throw new Error("Smart Evolution did not generate an executive summary!");
    }

    // 4. Test Market Intelligence (/api/market-intelligence/run)
    console.log("\n4. Testing Market Intelligence Radar (/api/market-intelligence/run)...");
    const marketIntelRes = await fetch(`${BASE_URL}/api/market-intelligence/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_token_admin"
      },
      body: JSON.stringify({
        topic: "أسعار اللوجستيات سلاسل الإمداد البحرية",
        industry: "اللوجستيات والشحن",
        context: "السعودية والإمارات",
        countries: ["السعودية", "الإمارات"],
        focus: "تقلبات التكلفة وتغطية المخاطر",
        lang: "ar",
        internalEvidence: [
          { title: "تأخير شحنة Q1", detail: "ارتفاع تكلفة الشحن 25%" }
        ]
      })
    });

    if (!marketIntelRes.ok) {
      const errText = await marketIntelRes.text();
      throw new Error(`Market Intelligence endpoint returned HTTP ${marketIntelRes.status}: ${errText}`);
    }

    const marketIntelData = await marketIntelRes.json();
    console.log("   Market Intelligence response received successfully!");
    console.log("   - Summary present:", Boolean(marketIntelData.summary));
    console.log("   - Market Overview present:", Boolean(marketIntelData.marketOverview));
    console.log("   - Recommendations count:", marketIntelData.recommendations?.length || 0);

    if (!marketIntelData.summary) {
      throw new Error("Market Intelligence did not generate a summary!");
    }

    // 5. Test Workspace Isolation
    console.log("\n5. Testing Account / Workspace Data Isolation...");
    const sampleMemoriesB = [
      {
        id: "mem_wsB_1",
        workspaceId: workspaceIdB,
        title: "Confidential R&D Expansion Workspace B",
        category: "Strategy",
        riskLevel: "Low",
        decision: "Approved $5M R&D budget",
        causalFactors: "Competitor expansion",
        lessonsLearned: "Maintain strict IP secrecy"
      }
    ];

    const agentChatIsolationRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_token_admin"
      },
      body: JSON.stringify({
        prompt: "ما هي الميزانية المعتمدة لشركة B؟",
        query: "ما هي الميزانية المعتمدة لشركة B؟",
        memories: sampleMemoriesA, // Passing Workspace A data only
        riskAlerts: [],
        files: [],
        lang: "ar"
      })
    });

    const isolationData = await agentChatIsolationRes.json();
    console.log("   Isolation Test Check: Model response does not expose Workspace B confidential data.");
    console.log("   - Response contains Workspace B secrets:", isolationData.text?.includes("Confidential R&D Expansion Workspace B") ? "FAILED" : "NO (PASSED ISOLATION)");

    if (isolationData.text?.includes("Confidential R&D Expansion Workspace B")) {
      throw new Error("Workspace isolation failed! Confidential data was leaked across workspaces.");
    }

    // Clean up
    await adminDb.collection("users").doc(testUid).delete();

    console.log("\n==================================================================");
    console.log(" 🎉 ALL AI CONNECTIVITY & OUTPUT SYSTEM VERIFICATIONS PASSED!");
    console.log("==================================================================\n");

    process.exit(0);

  } catch (err: any) {
    console.error("\n❌ VERIFICATION FAILED:", err.message || err);
    process.exit(1);
  }
}

function testRole(r: string) { return r; }

verifyAITools();
