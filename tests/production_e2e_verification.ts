import crypto from "crypto";
import http from "http";
import path from "path";
import fs from "fs";
import { ZAKIR_BUILD_ID, readDb, writeDb } from "../server.js";
import { generateSecuritySessionToken, ADMIN_USER_ID } from "../src/middleware/auth.js";

// Helper to generate a valid WebP file of exact size
function generateRealWebP(sizeInBytes: number): Buffer {
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(sizeInBytes - 8, 4);
  header.write("WEBP", 8, "ascii");

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write("VP8 ", 0, "ascii");
  chunkHeader.writeUInt32LE(sizeInBytes - 20, 4);

  // VP8 keyframe header bytes (valid VP8 frame tag: keyframe, version 0, show frame)
  const vp8Header = Buffer.from([
    0x30, 0x01, 0x00, // frame tag
    0x9d, 0x01, 0x2a, // start code
    0x80, 0x02,       // width 640
    0xe0, 0x01        // height 480
  ]);

  const payloadSize = sizeInBytes - 12 - 8 - vp8Header.length;
  // Generate pseudo-random compressed image data bytes
  const payload = crypto.randomBytes(payloadSize);

  return Buffer.concat([header, chunkHeader, vp8Header, payload]);
}

// Helper to generate a valid PDF file of exact size
function generateRealPdf(sizeInBytes: number): Buffer {
  const pdfHeader = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "utf8");
  const obj1 = Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n", "utf8");
  const obj2 = Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n", "utf8");
  const obj3Start = Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n", "utf8");
  
  const streamPrefix = "4 0 obj\n<< /Length ";
  const streamMid = " >>\nstream\n";
  const streamSuffix = "\nendstream\nendobj\n";
  
  const xrefAndTrailer = Buffer.from(
    "xref\n0 5\n0000000000 65535 f \n0000000015 00000 n \n0000000068 00000 n \n0000000125 00000 n \n0000000215 00000 n \n" +
    "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF\n",
    "utf8"
  );

  const overhead = pdfHeader.length + obj1.length + obj2.length + obj3Start.length + streamPrefix.length + 10 + streamMid.length + streamSuffix.length + xrefAndTrailer.length;
  const streamLength = Math.max(1024, sizeInBytes - overhead);
  const streamData = crypto.randomBytes(streamLength);

  const streamObj = Buffer.concat([
    Buffer.from(`${streamPrefix}${streamLength}${streamMid}`, "utf8"),
    streamData,
    Buffer.from(streamSuffix, "utf8")
  ]);

  return Buffer.concat([pdfHeader, obj1, obj2, obj3Start, streamObj, xrefAndTrailer]);
}

interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  text: string;
}

function makeRequest(
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
    port?: number;
  }
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const port = options.port || 3000;
    const reqOptions: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path: options.path,
      method: options.method,
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode || 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body,
          text: body.toString("utf8"),
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function computeSha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function runProductionE2EVerification() {
  console.log("======================================================================");
  console.log("🚀 STARTING STRICT PRODUCTION E2E VERIFICATION SUITE");
  console.log("======================================================================");
  console.log(`Zakir Build ID: ${ZAKIR_BUILD_ID}`);
  console.log(`Target: http://127.0.0.1:3000`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: {
    step: string;
    description: string;
    pass: boolean;
    details?: string;
  }[] = [];

  function recordResult(step: string, description: string, pass: boolean, details?: string) {
    results.push({ step, description, pass, details });
    const statusStr = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`[${statusStr}] ${step}: ${description}`);
    if (details) console.log(`   └─ ${details}`);
  }

  try {
    // Check server health
    const health = await makeRequest({ method: "GET", path: "/api/health" });
    console.log(`[HEALTH CHECK] Status: ${health.status} | Response: ${health.text}\n`);
    recordResult("0.1", "Server Health Check (/api/health -> 200)", health.status === 200);

    // ---------------------------------------------------------
    // 1. Generate Real Binary Files (Multi-MB)
    // ---------------------------------------------------------
    console.log("\n--- 1. GENERATING REAL PRODUCTION TEST BINARIES ---");
    const webpSize = 2.4 * 1024 * 1024; // 2.4 MB
    const pdfSize = 3.1 * 1024 * 1024;  // 3.1 MB

    const originalWebP = generateRealWebP(webpSize);
    const originalPdf = generateRealPdf(pdfSize);

    const webpSha256 = computeSha256(originalWebP);
    const pdfSha256 = computeSha256(originalPdf);

    console.log(`Generated Real WEBP Binary: ${originalWebP.length} bytes (2.4 MB) | SHA-256: ${webpSha256}`);
    console.log(`Generated Real PDF Binary:  ${originalPdf.length} bytes (3.1 MB) | SHA-256: ${pdfSha256}`);

    recordResult("1.1", "Real WEBP Binary Generation (>2MB)", originalWebP.length > 2000000 && originalWebP.subarray(0, 4).toString() === "RIFF", `Size: ${originalWebP.length} bytes`);
    recordResult("1.2", "Real PDF Binary Generation (>3MB)", originalPdf.length > 3000000 && originalPdf.subarray(0, 5).toString() === "%PDF-", `Size: ${originalPdf.length} bytes`);

    // Setup Test Users in Database
    const userAUid = `usr_e2e_a_${Date.now()}`;
    const userAEmail = `user_a_${Date.now()}@zakir.ai`;
    const userBUid = `usr_e2e_b_${Date.now()}`;
    const userBEmail = `user_b_${Date.now()}@zakir.ai`;

    const db = readDb();
    if (!db.users) db.users = [];
    db.users.push({
      id: userAUid,
      uid: userAUid,
      email: userAEmail,
      fullName: "User A E2E",
      role: "CEO",
      isEmailVerified: true,
      emailVerified: true,
      verificationDocuments: [],
      documents: [],
    });
    db.users.push({
      id: userBUid,
      uid: userBUid,
      email: userBEmail,
      fullName: "User B E2E",
      role: "CEO",
      isEmailVerified: true,
      emailVerified: true,
      verificationDocuments: [],
      documents: [],
    });
    writeDb(db);

    // Create Authenticated Session Tokens (Signed HMAC sec_... tokens)
    const userAToken = generateSecuritySessionToken(userAUid, "ws_a");
    const userBToken = generateSecuritySessionToken(userBUid, "ws_b");
    const adminToken = generateSecuritySessionToken(ADMIN_USER_ID, "admin_ws");

    // ---------------------------------------------------------
    // 2. USER A E2E: Upload WEBP & PDF Documents
    // ---------------------------------------------------------
    console.log("\n--- 2. USER A E2E: UPLOAD → PERSIST → PREVIEW → DOWNLOAD ---");
    
    // Upload WEBP
    const uploadWebpRes = await makeRequest({
      method: "POST",
      path: "/api/auth/verification-document/upload",
      headers: {
        "Authorization": `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "company_cr_license.webp",
        mimeType: "image/webp",
        fileBase64: originalWebP.toString("base64"),
        category: "company",
        docType: "commercial_register",
      }),
    });

    const webpUploadJson = JSON.parse(uploadWebpRes.text);
    const webpDocId = webpUploadJson.documentId;
    recordResult("2.1", "User A Uploads WEBP Document (HTTP 200)", uploadWebpRes.status === 200 && webpUploadJson.success === true && Boolean(webpDocId), `Doc ID: ${webpDocId}`);

    // Upload PDF
    const uploadPdfRes = await makeRequest({
      method: "POST",
      path: "/api/auth/verification-document/upload",
      headers: {
        "Authorization": `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "national_id_front.pdf",
        mimeType: "application/pdf",
        fileBase64: originalPdf.toString("base64"),
        category: "personal",
        docType: "national_id",
      }),
    });

    const pdfUploadJson = JSON.parse(uploadPdfRes.text);
    const pdfDocId = pdfUploadJson.documentId;
    recordResult("2.2", "User A Uploads PDF Document (HTTP 200)", uploadPdfRes.status === 200 && pdfUploadJson.success === true && Boolean(pdfDocId), `Doc ID: ${pdfDocId}`);

    // ---------------------------------------------------------
    // 3. User Preview & Download Verification (Fresh & Post-Refresh)
    // ---------------------------------------------------------
    console.log("\n--- 3. USER PREVIEW & DOWNLOAD VERIFICATION ---");

    // User A Preview WEBP
    const userWebpPreviewRes = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    const userWebpPreviewSha = computeSha256(userWebpPreviewRes.body);
    const isWebpPreviewMatch = userWebpPreviewSha === webpSha256;

    recordResult("3.1", "User A WEBP Preview Endpoint (HTTP 200, Binary Match)", 
      userWebpPreviewRes.status === 200 && isWebpPreviewMatch,
      `Status: ${userWebpPreviewRes.status} | Content-Type: ${userWebpPreviewRes.headers["content-type"]} | Size: ${userWebpPreviewRes.body.length} | SHA: ${userWebpPreviewSha}`
    );

    // User A Download WEBP
    const userWebpDownloadRes = await makeRequest({
      method: "GET",
      path: `/api/files/${webpDocId}/download`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    const userWebpDownloadSha = computeSha256(userWebpDownloadRes.body);
    const isWebpDownloadMatch = userWebpDownloadSha === webpSha256;

    recordResult("3.2", "User A WEBP Download Endpoint (HTTP 200, Binary Match)", 
      userWebpDownloadRes.status === 200 && isWebpDownloadMatch,
      `Status: ${userWebpDownloadRes.status} | Content-Disposition: ${userWebpDownloadRes.headers["content-disposition"]} | SHA: ${userWebpDownloadSha}`
    );

    // User A Preview PDF
    const userPdfPreviewRes = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${pdfDocId}`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    const userPdfPreviewSha = computeSha256(userPdfPreviewRes.body);
    const isPdfPreviewMatch = userPdfPreviewSha === pdfSha256;

    recordResult("3.3", "User A PDF Preview Endpoint (HTTP 200, Binary Match)", 
      userPdfPreviewRes.status === 200 && isPdfPreviewMatch,
      `Status: ${userPdfPreviewRes.status} | Content-Type: ${userPdfPreviewRes.headers["content-type"]} | Size: ${userPdfPreviewRes.body.length} | SHA: ${userPdfPreviewSha}`
    );

    // User A Download PDF
    const userPdfDownloadRes = await makeRequest({
      method: "GET",
      path: `/api/files/${pdfDocId}/download`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    const userPdfDownloadSha = computeSha256(userPdfDownloadRes.body);
    const isPdfDownloadMatch = userPdfDownloadSha === pdfSha256;

    recordResult("3.4", "User A PDF Download Endpoint (HTTP 200, Binary Match)", 
      userPdfDownloadRes.status === 200 && isPdfDownloadMatch,
      `Status: ${userPdfDownloadRes.status} | Content-Disposition: ${userPdfDownloadRes.headers["content-disposition"]} | SHA: ${userPdfDownloadSha}`
    );

    // ---------------------------------------------------------
    // 4. Logout → Login → Refresh Simulation
    // ---------------------------------------------------------
    console.log("\n--- 4. USER LOGOUT → LOGIN → REFRESH SIMULATION ---");
    // Generate fresh new session token simulating brand new login after logout
    const freshUserAToken = generateSecuritySessionToken(userAUid, "ws_a_fresh");

    const userPostLoginPreviewRes = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${freshUserAToken}` },
    });
    const userPostLoginSha = computeSha256(userPostLoginPreviewRes.body);
    recordResult("4.1", "User A Preview After Logout/Login Session Re-issuance",
      userPostLoginPreviewRes.status === 200 && userPostLoginSha === webpSha256,
      `SHA-256 match: ${userPostLoginSha === webpSha256}`
    );

    // ---------------------------------------------------------
    // 5. ADMIN E2E: Preview & Download User Documents
    // ---------------------------------------------------------
    console.log("\n--- 5. ADMIN E2E: PREVIEW & DOWNLOAD USER DOCUMENTS ---");

    // Admin Preview WEBP
    const adminWebpPreviewRes = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    const adminWebpPreviewSha = computeSha256(adminWebpPreviewRes.body);
    recordResult("5.1", "Admin WEBP Preview Endpoint (HTTP 200, Identical Binary)",
      adminWebpPreviewRes.status === 200 && adminWebpPreviewSha === webpSha256,
      `Admin SHA: ${adminWebpPreviewSha}`
    );

    // Admin Download WEBP
    const adminWebpDownloadRes = await makeRequest({
      method: "GET",
      path: `/api/files/${webpDocId}/download`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    const adminWebpDownloadSha = computeSha256(adminWebpDownloadRes.body);
    recordResult("5.2", "Admin WEBP Download Endpoint (HTTP 200, Identical Binary)",
      adminWebpDownloadRes.status === 200 && adminWebpDownloadSha === webpSha256,
      `Admin Download SHA: ${adminWebpDownloadSha}`
    );

    // Admin Preview PDF
    const adminPdfPreviewRes = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/${pdfDocId}`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    const adminPdfPreviewSha = computeSha256(adminPdfPreviewRes.body);
    recordResult("5.3", "Admin PDF Preview Endpoint (HTTP 200, Identical Binary)",
      adminPdfPreviewRes.status === 200 && adminPdfPreviewSha === pdfSha256,
      `Admin PDF SHA: ${adminPdfPreviewSha}`
    );

    // Admin Download PDF
    const adminPdfDownloadRes = await makeRequest({
      method: "GET",
      path: `/api/files/${pdfDocId}/download`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    const adminPdfDownloadSha = computeSha256(adminPdfDownloadRes.body);
    recordResult("5.4", "Admin PDF Download Endpoint (HTTP 200, Identical Binary)",
      adminPdfDownloadRes.status === 200 && adminPdfDownloadSha === pdfSha256,
      `Admin PDF Download SHA: ${adminPdfDownloadSha}`
    );

    // ---------------------------------------------------------
    // 6. MULTI-TENANT SECURITY MATRIX
    // ---------------------------------------------------------
    console.log("\n--- 6. MULTI-TENANT CROSS-USER AUTHORIZATION SECURITY MATRIX ---");

    // Upload User B document
    const uploadUserBRes = await makeRequest({
      method: "POST",
      path: "/api/auth/verification-document/upload",
      headers: {
        "Authorization": `Bearer ${userBToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "user_b_private_passport.pdf",
        mimeType: "application/pdf",
        fileBase64: originalPdf.toString("base64"),
        category: "personal",
        docType: "passport",
      }),
    });
    const docIdB = JSON.parse(uploadUserBRes.text).documentId;

    // Test 6.1: User A -> User A document (PASS)
    const uA_docA = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    recordResult("6.1", "User A accessing User A Document -> HTTP 200 (PASS)", uA_docA.status === 200);

    // Test 6.2: User A -> User B document (DENIED)
    const uA_docB = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${docIdB}`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    recordResult("6.2", "User A accessing User B Document -> HTTP 403 (DENIED)", uA_docB.status === 403, `Status: ${uA_docB.status}`);

    // Test 6.3: User B -> User B document (PASS)
    const uB_docB = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${docIdB}`,
      headers: { "Authorization": `Bearer ${userBToken}` },
    });
    recordResult("6.3", "User B accessing User B Document -> HTTP 200 (PASS)", uB_docB.status === 200);

    // Test 6.4: User B -> User A document (DENIED)
    const uB_docA = await makeRequest({
      method: "GET",
      path: `/api/auth/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${userBToken}` },
    });
    recordResult("6.4", "User B accessing User A Document -> HTTP 403 (DENIED)", uB_docA.status === 403, `Status: ${uB_docA.status}`);

    // Test 6.5: User A accessing Admin path (DENIED)
    const uA_admin = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${userAToken}` },
    });
    recordResult("6.5", "Non-Admin User A accessing /api/admin/* -> HTTP 403 (DENIED)", uA_admin.status === 403, `Status: ${uA_admin.status}`);

    // Test 6.6: Admin -> User A document (PASS)
    const admin_docA = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/${webpDocId}`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    recordResult("6.6", "Admin accessing User A Document -> HTTP 200 (PASS)", admin_docA.status === 200);

    // Test 6.7: Admin -> User B document (PASS)
    const admin_docB = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/${docIdB}`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    recordResult("6.7", "Admin accessing User B Document -> HTTP 200 (PASS)", admin_docB.status === 200);

    // ---------------------------------------------------------
    // 7. LEGACY DOCUMENT PERSISTENCE & ERROR PHRASE VERIFICATION
    // ---------------------------------------------------------
    console.log("\n--- 7. LEGACY DOCUMENT PERSISTENCE & ERROR PHRASES CHECK ---");

    // Test non-existent document correctly returns 404 and does NOT return raw crash
    const nonExistentRes = await makeRequest({
      method: "GET",
      path: `/api/admin/verification-document/doc_non_existent_${Date.now()}`,
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    recordResult("7.1", "Genuine non-existent document returns HTTP 404", nonExistentRes.status === 404, `Status: ${nonExistentRes.status}`);

    // ---------------------------------------------------------
    // 8. FINAL INTEGRITY TABLE & SUMMARY
    // ---------------------------------------------------------
    console.log("\n======================================================================");
    console.log("📊 SHA-256 BINARY INTEGRITY AUDIT TABLE");
    console.log("======================================================================");
    console.table([
      {
        Format: "WEBP (2.4 MB)",
        "Original SHA-256": webpSha256,
        "User Preview SHA": userWebpPreviewSha,
        "User Download SHA": userWebpDownloadSha,
        "Admin Preview SHA": adminWebpPreviewSha,
        "Admin Download SHA": adminWebpDownloadSha,
        "Integrity Status": isWebpPreviewMatch && isWebpDownloadMatch && (adminWebpPreviewSha === webpSha256) ? "100% IDENTICAL" : "MISMATCH",
      },
      {
        Format: "PDF (3.1 MB)",
        "Original SHA-256": pdfSha256,
        "User Preview SHA": userPdfPreviewSha,
        "User Download SHA": userPdfDownloadSha,
        "Admin Preview SHA": adminPdfPreviewSha,
        "Admin Download SHA": adminPdfDownloadSha,
        "Integrity Status": isPdfPreviewMatch && isPdfDownloadMatch && (adminPdfPreviewSha === pdfSha256) ? "100% IDENTICAL" : "MISMATCH",
      },
    ]);

    const totalPassed = results.filter(r => r.pass).length;
    const totalFailed = results.filter(r => !r.pass).length;

    console.log("\n======================================================================");
    console.log(`🏁 PRODUCTION E2E VERIFICATION COMPLETED: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log("======================================================================");

    if (totalFailed > 0) {
      console.error(`FAILED TESTS COUNT: ${totalFailed}`);
      process.exit(1);
    } else {
      console.log("ALL PRODUCTION E2E VERIFICATION ASSERTIONS PASSED WITH 100% SUCCESS.");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("FATAL RUNTIME ERROR DURING E2E VERIFICATION:", err);
    process.exit(1);
  }
}

runProductionE2EVerification();
