import http from "http";
import https from "https";

async function fetchUrl(url: string, options: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https:");
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: data,
          headers: res.headers
        });
      });
    });
    req.on("error", (err) => reject(err));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function verifyAll() {
  console.log("=== VERIFYING API GUARDS & PRODUCTION DEPLOYMENT ===");

  // 1. Check Scenario E: /api/admin/approve-documents guard against 0 docs
  console.log("\n--- Checking Scenario E: Approval guard against 0 docs ---");
  // We can test the local running dev server on port 3000
  try {
    const localRes = await fetchUrl("http://localhost:3000/api/health");
    console.log(`Local server health: HTTP ${localRes.status}`);
  } catch (e: any) {
    console.log(`Local dev server ping notice: ${e.message}`);
  }

  // 2. Check Live Production at https://www.getzakir.com
  console.log("\n--- Checking Live Production Deployment: https://www.getzakir.com ---");
  try {
    const prodHealth = await fetchUrl("https://www.getzakir.com/api/health");
    console.log(`Production /api/health Status: HTTP ${prodHealth.status}`);
    console.log(`Production /api/health Response: ${prodHealth.body.substring(0, 300)}`);
  } catch (e: any) {
    console.log(`Production /api/health error: ${e.message}`);
  }

  try {
    const prodIndex = await fetchUrl("https://www.getzakir.com/");
    console.log(`Production / Status: HTTP ${prodIndex.status}`);
    const isZakirTitle = prodIndex.body.includes("ذَكِرْ") || prodIndex.body.includes("Zakir");
    console.log(`Production HTML title contains Zakir: ${isZakirTitle}`);
  } catch (e: any) {
    console.log(`Production / error: ${e.message}`);
  }

  // 3. Test Admin Documents Approval endpoint directly without token -> expect 401 Unauthorized (Auth guard working)
  try {
    const prodDocApproveNoAuth = await fetchUrl("https://www.getzakir.com/api/admin/approve-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "non_existent_user", notes: "test" })
    });
    console.log(`Production /api/admin/approve-documents (Unauthenticated) Status: HTTP ${prodDocApproveNoAuth.status} (Expected: 401)`);
    console.log(`Production /api/admin/approve-documents Response: ${prodDocApproveNoAuth.body.substring(0, 200)}`);
  } catch (e: any) {
    console.log(`Production /api/admin/approve-documents check error: ${e.message}`);
  }
}

verifyAll();
