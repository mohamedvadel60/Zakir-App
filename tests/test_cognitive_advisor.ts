import http from "http";

interface TestResult {
  num: string;
  input: string;
  passed: boolean;
  intent: string;
  status: number;
  sampleText: string;
}

function makeAgentChatRequest(body: any, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port: 3000,
        path: "/api/agent/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data: any = {};
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = { rawText: raw };
          }
          resolve({ status: res.statusCode || 500, data });
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

function checkNoTechnicalError(text: string): boolean {
  const lower = (text || "").toLowerCase();
  const badWords = [
    "401",
    "403",
    "404",
    "500",
    "cors",
    "unauthorized",
    "forbidden",
    "api route not found",
    "failed to fetch",
    "stack trace",
  ];
  return !badWords.some((w) => lower.includes(w));
}

async function runAdvisorTests() {
  console.log("\n================================================================================");
  console.log("MANDATORY & EDGE-CASE COGNITIVE ADVISOR SUITE");
  console.log("================================================================================\n");

  const testCases = [
    { num: "TEST 01", input: "مرحبا", expectPrivateData: false },
    { num: "TEST 02", input: "كيف حالك؟", expectPrivateData: false },
    { num: "TEST 03", input: "من أنت؟", expectPrivateData: false },
    { num: "TEST 04", input: "ماذا يمكنك أن تفعل؟", expectPrivateData: false },
    { num: "TEST 05", input: "شكراً", expectPrivateData: false },
    { num: "TEST 06", input: "أريد مساعدتك", expectPrivateData: false },
    { num: "TEST 07", input: "ماذا تنصحني؟", expectPrivateData: false },
    { num: "TEST 08", input: "هل يمكنك مساعدتي في قرار؟", expectPrivateData: false },
    { num: "TEST 09", input: "أريد أن أتحدث عن شركتي", expectPrivateData: false },
    { num: "TEST 10", input: "ما رأيك في هذه الفكرة؟", expectPrivateData: false },
    { num: "TEST 11", input: "اشرح لي هذا", expectPrivateData: false },
    { num: "TEST 12", input: "لم أفهم", expectPrivateData: false },
    { num: "TEST 13", input: "ما هو التدفق النقدي؟", expectPrivateData: false },
    { num: "TEST 14", input: "كيف أحسن إدارة شركتي؟", expectPrivateData: false },
    { num: "TEST 15", input: "لدي اجتماع مع مستثمر", expectPrivateData: false },
    { num: "TEST 16", input: "حلل", expectPrivateData: false },
    { num: "TEST 17", input: "فكرة غير متوقعة: هل ننفتح على خط إنتاج جديد في التصدير؟", expectPrivateData: false },
    { num: "TEST 18", input: "الذكريات المسجلة في حسابي", expectPrivateData: true },
  ];

  const results = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const res = await makeAgentChatRequest({ prompt: tc.input, lang: "ar" });
        const responseText = res.data.text || res.data.response || "";
        const noTechError = checkNoTechnicalError(responseText);
        const isHttpSuccess = res.status === 200;

        let testPassed = isHttpSuccess && noTechError && responseText.length > 10;
        if (tc.expectPrivateData) {
          testPassed = isHttpSuccess && (responseText.includes("تسجيل الدخول") || responseText.includes("صلاحية"));
        }

        return {
          num: tc.num,
          input: tc.input,
          passed: testPassed,
          intent: res.data.intent || "N/A",
          status: res.status,
          sampleText: responseText.substring(0, 90).replace(/\n/g, " "),
        };
      } catch (err: any) {
        return {
          num: tc.num,
          input: tc.input,
          passed: false,
          intent: "ERROR",
          status: 500,
          sampleText: err.message,
        };
      }
    })
  );

  // TEST 19: Authenticated Private Data Query
  let test19Passed = false;
  let test19Text = "";
  let test19Status = 500;
  try {
    const authRes = await makeAgentChatRequest(
      {
        prompt: "الذكريات المسجلة في حسابي",
        lang: "ar",
        memories: [{ title: "قرار زيادة رأس المال", category: "Finance", decision: "الموافقة" }],
      },
      { Authorization: "Bearer mock_token_admin" }
    );
    test19Text = authRes.data.text || "";
    test19Status = authRes.status;
    test19Passed = authRes.status === 200 && checkNoTechnicalError(test19Text) && test19Text.length > 10;
  } catch (err: any) {
    test19Text = err.message;
  }

  results.push({
    num: "TEST 19",
    input: "الذكريات المسجلة في حسابي (مع مصادقة)",
    passed: test19Passed,
    intent: "MEMORY_QUERY",
    status: test19Status,
    sampleText: test19Text.substring(0, 90).replace(/\n/g, " "),
  });

  results.forEach((r) => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} [${r.num}] "${r.input}": ${r.passed ? "PASS" : "FAIL"} (HTTP ${r.status}, Intent: ${r.intent})`);
    console.log(`   Response: "${r.sampleText}..."\n`);
  });

  console.log("================================================================================");
  console.log("SUMMARY OF COGNITIVE ADVISOR EDGE-CASE TESTS");
  console.log("================================================================================\n");

  const totalPassed = results.filter((t) => t.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${totalPassed} | FAILED: ${results.length - totalPassed}\n`);

  if (totalPassed === results.length) {
    console.log("🎉 ALL COGNITIVE ADVISOR MANDATORY & EDGE-CASE TESTS PASSED 100%!");
    process.exit(0);
  } else {
    console.error("⚠️ SOME ADVISOR TESTS FAILED");
    process.exit(1);
  }
}

runAdvisorTests().catch((e) => {
  console.error("FATAL ERROR IN ADVISOR SUITE:", e);
  process.exit(1);
});
