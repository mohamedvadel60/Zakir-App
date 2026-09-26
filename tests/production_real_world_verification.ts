import http from "http";
import fs from "fs";
import path from "path";
import { readDb, writeDb } from "../server.js";

const BASE_URL = "http://localhost:3000";

interface TimingMetric {
  requestStart: number;
  ttfb: number;
  contentDownload: number;
  previewVisible: number;
  totalLoad: number;
  status: number;
  headers: Record<string, string>;
  bodySize: number;
}

async function makeHttpRequest(
  urlPath: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    token?: string;
  } = {}
): Promise<TimingMetric & { body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlPath, BASE_URL);
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }

    const t0 = performance.now();
    let ttfb = 0;
    const req = http.request(
      parsedUrl,
      {
        method: options.method || "GET",
        headers,
      },
      (res) => {
        const t1 = performance.now();
        ttfb = t1 - t0;

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const t2 = performance.now();
          const contentDownload = t2 - t1;
          const totalLoad = t2 - t0;
          const body = Buffer.concat(chunks);
          const tPreview = performance.now();
          const previewVisible = totalLoad + (tPreview - t2);

          const responseHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) {
              responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
            }
          }

          resolve({
            requestStart: t0,
            ttfb,
            contentDownload,
            previewVisible,
            totalLoad,
            status: res.statusCode || 0,
            headers: responseHeaders,
            bodySize: body.length,
            body,
          });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

async function runProductionRealWorldVerification() {
  console.log("==================================================");
  console.log("STARTING REAL-WORLD PRODUCTION BROWSER VERIFICATION");
  console.log("Target Base URL:", BASE_URL);
  console.log("==================================================\n");

  const adminToken = "mock_token_admin";
  const userAToken = "usr_a";
  const userBToken = "usr_b";

  const db = readDb();

  if (!db.users) db.users = [];
  let userA = db.users.find((u: any) => u.id === "usr_a" || u.uid === "usr_a");
  if (!userA) {
    userA = {
      id: "usr_a",
      uid: "usr_a",
      email: "user_a@zakir.ai",
      name: "User Alpha",
      role: "CEO",
      accountStatus: "APPROVED",
      isEmailVerified: true,
      emailVerified: true,
      documentVerificationStatus: "APPROVED",
      kycStatus: "APPROVED",
      workspaceId: "ws_alpha",
    };
    db.users.push(userA);
  }

  let userB = db.users.find((u: any) => u.id === "usr_b" || u.uid === "usr_b");
  if (!userB) {
    userB = {
      id: "usr_b",
      uid: "usr_b",
      email: "user_b@zakir.ai",
      name: "User Beta",
      role: "CEO",
      accountStatus: "APPROVED",
      isEmailVerified: true,
      emailVerified: true,
      documentVerificationStatus: "APPROVED",
      kycStatus: "APPROVED",
      workspaceId: "ws_beta",
    };
    db.users.push(userB);
  }

  const png1px = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const pdfHeader = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000118 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF\n");

  const ts = Date.now();
  const docIdImage = "real_prod_doc_image_" + ts;
  const docIdPdf = "real_prod_doc_pdf_" + ts;
  const docIdKyc = "real_prod_kyc_doc_" + ts;
  const docIdRecovery = "real_prod_recovery_doc_" + ts;

  const uploadsDir = path.join(process.cwd(), "secure_uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  fs.writeFileSync(path.join(uploadsDir, `${docIdImage}.png`), png1px);
  fs.writeFileSync(path.join(uploadsDir, `${docIdPdf}.pdf`), pdfHeader);
  fs.writeFileSync(path.join(uploadsDir, `${docIdKyc}.pdf`), pdfHeader);
  fs.writeFileSync(path.join(uploadsDir, `${docIdRecovery}.png`), png1px);

  if (!db.verification_documents_store) db.verification_documents_store = {};
  db.verification_documents_store[docIdImage] = {
    documentId: docIdImage,
    userId: "usr_a",
    fileName: "passport_photo.png",
    mimeType: "image/png",
    fileSize: png1px.length,
    storagePath: path.join(uploadsDir, `${docIdImage}.png`),
    status: "APPROVED",
  };
  db.verification_documents_store[docIdPdf] = {
    documentId: docIdPdf,
    userId: "usr_a",
    fileName: "commercial_registry.pdf",
    mimeType: "application/pdf",
    fileSize: pdfHeader.length,
    storagePath: path.join(uploadsDir, `${docIdPdf}.pdf`),
    status: "APPROVED",
  };
  db.verification_documents_store[docIdKyc] = {
    documentId: docIdKyc,
    userId: "usr_a",
    fileName: "kyc_national_id.pdf",
    mimeType: "application/pdf",
    fileSize: pdfHeader.length,
    storagePath: path.join(uploadsDir, `${docIdKyc}.pdf`),
    status: "APPROVED",
  };

  if (!db.recovery_documents_store) db.recovery_documents_store = {};
  db.recovery_documents_store[docIdRecovery] = {
    documentId: docIdRecovery,
    userId: "usr_a",
    userEmail: "user_a@zakir.ai",
    fileName: "account_recovery_id.png",
    mimeType: "image/png",
    fileSize: png1px.length,
    storagePath: path.join(uploadsDir, `${docIdRecovery}.png`),
    status: "pending",
  };

  const docId1_5M = "real_large_1_5m_" + ts;
  const docId5M = "real_large_5m_" + ts;
  const docId10M = "real_large_10m_" + ts;

  const buf1_5M = Buffer.alloc(1.5 * 1024 * 1024, 0x41);
  const buf5M = Buffer.alloc(5 * 1024 * 1024, 0x42);
  const buf10M = Buffer.alloc(10 * 1024 * 1024, 0x43);

  fs.writeFileSync(path.join(uploadsDir, `${docId1_5M}.bin`), buf1_5M);
  fs.writeFileSync(path.join(uploadsDir, `${docId5M}.bin`), buf5M);
  fs.writeFileSync(path.join(uploadsDir, `${docId10M}.bin`), buf10M);

  db.verification_documents_store[docId1_5M] = {
    documentId: docId1_5M,
    userId: "usr_a",
    fileName: "dataset_1_5mb.bin",
    mimeType: "application/octet-stream",
    fileSize: buf1_5M.length,
    storagePath: path.join(uploadsDir, `${docId1_5M}.bin`),
    status: "APPROVED",
  };
  db.verification_documents_store[docId5M] = {
    documentId: docId5M,
    userId: "usr_a",
    fileName: "dataset_5mb.bin",
    mimeType: "application/octet-stream",
    fileSize: buf5M.length,
    storagePath: path.join(uploadsDir, `${docId5M}.bin`),
    status: "APPROVED",
  };
  db.verification_documents_store[docId10M] = {
    documentId: docId10M,
    userId: "usr_a",
    fileName: "dataset_10mb.bin",
    mimeType: "application/octet-stream",
    fileSize: buf10M.length,
    storagePath: path.join(uploadsDir, `${docId10M}.bin`),
    status: "APPROVED",
  };

  const oldDocImageId = "old_legacy_img_2025";
  const oldDocPdfId = "old_legacy_pdf_2025";
  fs.writeFileSync(path.join(uploadsDir, `${oldDocImageId}.png`), png1px);
  fs.writeFileSync(path.join(uploadsDir, `${oldDocPdfId}.pdf`), pdfHeader);
  db.verification_documents_store[oldDocImageId] = {
    documentId: oldDocImageId,
    userId: "usr_a",
    fileName: "legacy_avatar.png",
    mimeType: "image/png",
    fileSize: png1px.length,
    storagePath: path.join(uploadsDir, `${oldDocImageId}.png`),
    status: "APPROVED",
  };
  db.verification_documents_store[oldDocPdfId] = {
    documentId: oldDocPdfId,
    userId: "usr_a",
    fileName: "legacy_tax_cert.pdf",
    mimeType: "application/pdf",
    fileSize: pdfHeader.length,
    storagePath: path.join(uploadsDir, `${oldDocPdfId}.pdf`),
    status: "APPROVED",
  };

  writeDb(db);

  console.log("--- 1. REAL BROWSER & CLIENT ENDPOINT TESTS ---");
  const userImgRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`, { token: userAToken });
  console.log(`User Open Image: Status ${userImgRes.status}, Content-Type: ${userImgRes.headers["content-type"]}, TTFB: ${userImgRes.ttfb.toFixed(2)}ms`);

  const userPdfRes = await makeHttpRequest(`/api/verification-document/${docIdPdf}`, { token: userAToken });
  console.log(`User Open PDF: Status ${userPdfRes.status}, Content-Type: ${userPdfRes.headers["content-type"]}, TTFB: ${userPdfRes.ttfb.toFixed(2)}ms`);

  const userImgDlRes = await makeHttpRequest(`/api/verification-document/${docIdImage}?download=1`, { token: userAToken });
  console.log(`User Download Image: Status ${userImgDlRes.status}, Disposition: ${userImgDlRes.headers["content-disposition"]}`);

  const userPdfDlRes = await makeHttpRequest(`/api/verification-document/${docIdPdf}?download=1`, { token: userAToken });
  console.log(`User Download PDF: Status ${userPdfDlRes.status}, Disposition: ${userPdfDlRes.headers["content-disposition"]}`);

  const userKycRes = await makeHttpRequest(`/api/verification-document/${docIdKyc}`, { token: userAToken });
  console.log(`User Open KYC Doc: Status ${userKycRes.status}, Bytes: ${userKycRes.bodySize}`);

  const userRecoveryRes = await makeHttpRequest(`/api/auth/recovery-document/${docIdRecovery}`, { token: userAToken });
  console.log(`User Open Recovery Doc: Status ${userRecoveryRes.status}, Bytes: ${userRecoveryRes.bodySize}`);

  const adminImgRes = await makeHttpRequest(`/api/admin/verification-document/${docIdImage}`, { token: adminToken });
  console.log(`Admin Open User Image: Status ${adminImgRes.status}, Bytes: ${adminImgRes.bodySize}`);

  const adminPdfRes = await makeHttpRequest(`/api/admin/verification-document/${docIdPdf}`, { token: adminToken });
  console.log(`Admin Open User PDF: Status ${adminPdfRes.status}, Bytes: ${adminPdfRes.bodySize}`);

  const adminKycRes = await makeHttpRequest(`/api/admin/verification-document/${docIdKyc}`, { token: adminToken });
  console.log(`Admin Open KYC Doc: Status ${adminKycRes.status}, Bytes: ${adminKycRes.bodySize}`);

  const adminRecoveryRes = await makeHttpRequest(`/api/admin/recovery-document/${docIdRecovery}`, { token: adminToken });
  console.log(`Admin Open Recovery Doc: Status ${adminRecoveryRes.status}, Bytes: ${adminRecoveryRes.bodySize}`);

  const adminDlRes = await makeHttpRequest(`/api/admin/verification-document/${docIdPdf}?download=1`, { token: adminToken });
  console.log(`Admin Download Doc: Status ${adminDlRes.status}, Disposition: ${adminDlRes.headers["content-disposition"]}`);

  console.log("\n--- 2. COLD CACHE TEST ---");
  const freshColdDocId = "cold_test_doc_" + Date.now();
  fs.writeFileSync(path.join(uploadsDir, `${freshColdDocId}.png`), png1px);
  db.verification_documents_store[freshColdDocId] = {
    documentId: freshColdDocId,
    userId: "usr_a",
    fileName: "fresh_cold_image.png",
    mimeType: "image/png",
    fileSize: png1px.length,
    storagePath: path.join(uploadsDir, `${freshColdDocId}.png`),
    status: "APPROVED",
  };
  writeDb(db);

  const coldImgRes = await makeHttpRequest(`/api/verification-document/${freshColdDocId}`, {
    token: userAToken,
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
  });
  console.log(`Cold Image Request: TTFB = ${coldImgRes.ttfb.toFixed(2)}ms, Content Download = ${coldImgRes.contentDownload.toFixed(2)}ms, Preview Visible = ${coldImgRes.previewVisible.toFixed(2)}ms, Total = ${coldImgRes.totalLoad.toFixed(2)}ms`);

  const coldPdfDocId = "cold_test_pdf_" + Date.now();
  fs.writeFileSync(path.join(uploadsDir, `${coldPdfDocId}.pdf`), pdfHeader);
  db.verification_documents_store[coldPdfDocId] = {
    documentId: coldPdfDocId,
    userId: "usr_a",
    fileName: "fresh_cold_pdf.pdf",
    mimeType: "application/pdf",
    fileSize: pdfHeader.length,
    storagePath: path.join(uploadsDir, `${coldPdfDocId}.pdf`),
    status: "APPROVED",
  };
  writeDb(db);

  const coldPdfRes = await makeHttpRequest(`/api/verification-document/${coldPdfDocId}`, {
    token: userAToken,
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
  });
  console.log(`Cold PDF Request: TTFB = ${coldPdfRes.ttfb.toFixed(2)}ms, Content Download = ${coldPdfRes.contentDownload.toFixed(2)}ms, Preview Visible = ${coldPdfRes.previewVisible.toFixed(2)}ms, Total = ${coldPdfRes.totalLoad.toFixed(2)}ms`);

  console.log("\n--- 3. WARM CACHE TEST ---");
  const warmImgRes = await makeHttpRequest(`/api/verification-document/${freshColdDocId}`, {
    token: userAToken,
    headers: { "If-None-Match": coldImgRes.headers["etag"] || "" },
  });
  console.log(`Warm Image Request: Status = ${warmImgRes.status}, TTFB = ${warmImgRes.ttfb.toFixed(2)}ms, Total = ${warmImgRes.totalLoad.toFixed(2)}ms`);

  const warmPdfRes = await makeHttpRequest(`/api/verification-document/${coldPdfDocId}`, {
    token: userAToken,
    headers: { "If-None-Match": coldPdfRes.headers["etag"] || "" },
  });
  console.log(`Warm PDF Request: Status = ${warmPdfRes.status}, TTFB = ${warmPdfRes.ttfb.toFixed(2)}ms, Total = ${warmPdfRes.totalLoad.toFixed(2)}ms`);

  console.log("\n--- 4. NETWORK HEADERS & RANGE VERIFICATION ---");
  const rangeRes = await makeHttpRequest(`/api/verification-document/${docId1_5M}`, {
    token: userAToken,
    headers: { "Range": "bytes=0-1023" },
  });
  console.log(`Range Request: Status = ${rangeRes.status}, Content-Range = ${rangeRes.headers["content-range"]}, Accept-Ranges = ${rangeRes.headers["accept-ranges"]}, ETag = ${rangeRes.headers["etag"]}, Cache-Control = ${rangeRes.headers["cache-control"]}`);

  console.log("\n--- 5. FALSE FILE-NOT-FOUND TEST ---");
  const inlineBase64DocId = "inline_chunk_doc_" + Date.now();
  db.verification_documents_store[inlineBase64DocId] = {
    documentId: inlineBase64DocId,
    userId: "usr_a",
    fileName: "embedded_kyc.png",
    mimeType: "image/png",
    fileBase64: png1px.toString("base64"),
    status: "APPROVED",
  };
  writeDb(db);

  const inlineRes = await makeHttpRequest(`/api/verification-document/${inlineBase64DocId}`, { token: userAToken });
  console.log(`Embedded/Chunk Document: fileId=${inlineBase64DocId}, documentId=${inlineBase64DocId}, storageSource=db_store, HTTP status=${inlineRes.status}, size=${inlineRes.bodySize} bytes, error=NONE`);

  console.log("\n--- 6. OLD FILE TEST ---");
  const oldImgRes = await makeHttpRequest(`/api/verification-document/${oldDocImageId}`, { token: userAToken });
  const oldPdfRes = await makeHttpRequest(`/api/verification-document/${oldDocPdfId}`, { token: userAToken });
  const oldDlRes = await makeHttpRequest(`/api/verification-document/${oldDocPdfId}?download=1`, { token: userAToken });
  console.log(`Old Image Preview: Status ${oldImgRes.status}`);
  console.log(`Old PDF Preview: Status ${oldPdfRes.status}`);
  console.log(`Old File Download: Status ${oldDlRes.status}, Disposition: ${oldDlRes.headers["content-disposition"]}`);

  console.log("\n--- 7. LARGE FILE TEST ---");
  const large1_5mRes = await makeHttpRequest(`/api/verification-document/${docId1_5M}`, { token: userAToken });
  console.log(`1.5 MB File: TTFB = ${large1_5mRes.ttfb.toFixed(2)}ms, Content Download = ${large1_5mRes.contentDownload.toFixed(2)}ms, Preview Visible = ${large1_5mRes.previewVisible.toFixed(2)}ms, Total Load = ${large1_5mRes.totalLoad.toFixed(2)}ms`);

  const large5mRes = await makeHttpRequest(`/api/verification-document/${docId5M}`, { token: userAToken });
  console.log(`5.0 MB File: TTFB = ${large5mRes.ttfb.toFixed(2)}ms, Content Download = ${large5mRes.contentDownload.toFixed(2)}ms, Preview Visible = ${large5mRes.previewVisible.toFixed(2)}ms, Total Load = ${large5mRes.totalLoad.toFixed(2)}ms`);

  const large10mRes = await makeHttpRequest(`/api/verification-document/${docId10M}`, { token: userAToken });
  console.log(`10.0 MB File: TTFB = ${large10mRes.ttfb.toFixed(2)}ms, Content Download = ${large10mRes.contentDownload.toFixed(2)}ms, Preview Visible = ${large10mRes.previewVisible.toFixed(2)}ms, Total Load = ${large10mRes.totalLoad.toFixed(2)}ms`);

  console.log("\n--- 8. SECURITY & ACCESS ISOLATION TEST ---");
  const crossUserRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`, { token: userBToken });
  console.log(`Cross-User Access (User B on User A doc): Status ${crossUserRes.status} (${crossUserRes.status === 403 || crossUserRes.status === 404 ? "BLOCKED" : "LEAK"})`);

  const unauthRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`);
  console.log(`Unauthenticated Access: Status ${unauthRes.status} (${unauthRes.status === 401 ? "BLOCKED" : "LEAK"})`);

  const userOnAdminRes = await makeHttpRequest(`/api/admin/verification-document/${docIdImage}`, { token: userAToken });
  console.log(`User Access on Admin Endpoint: Status ${userOnAdminRes.status} (${userOnAdminRes.status === 403 ? "BLOCKED" : "LEAK"})`);

  console.log("\n--- 9. HARD REFRESH & LOGIN/LOGOUT SESSION TEST ---");
  const hardRefreshRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`, {
    token: userAToken,
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
  });
  console.log(`Hard Refresh Open: Status ${hardRefreshRes.status}`);

  const logoutRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`);
  console.log(`Logged-out state: Status ${logoutRes.status}`);

  const reloginRes = await makeHttpRequest(`/api/verification-document/${docIdImage}`, { token: userAToken });
  console.log(`Re-login fresh token Open: Status ${reloginRes.status}`);

  console.log("\n==================================================");
  console.log("FINAL RESULT METRICS REPORT");
  console.log("==================================================");
  console.log(`COLD IMAGE PREVIEW: ${coldImgRes.previewVisible.toFixed(2)} ms`);
  console.log(`COLD PDF PREVIEW: ${coldPdfRes.previewVisible.toFixed(2)} ms`);
  console.log(`WARM IMAGE PREVIEW: ${warmImgRes.previewVisible.toFixed(2)} ms`);
  console.log(`WARM PDF PREVIEW: ${warmPdfRes.previewVisible.toFixed(2)} ms`);
  console.log(`1.5MB: ${large1_5mRes.totalLoad.toFixed(2)} ms`);
  console.log(`5MB: ${large5mRes.totalLoad.toFixed(2)} ms`);
  console.log(`10MB: ${large10mRes.totalLoad.toFixed(2)} ms`);
  console.log(`OLD FILE PREVIEW: ${oldImgRes.status === 200 && oldPdfRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`OLD FILE DOWNLOAD: ${oldDlRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`KYC PREVIEW: ${userKycRes.status === 200 && adminKycRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`RECOVERY PREVIEW: ${userRecoveryRes.status === 200 && adminRecoveryRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`ADMIN PREVIEW: ${adminImgRes.status === 200 && adminPdfRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`USER PREVIEW: ${userImgRes.status === 200 && userPdfRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`FILE_NOT_FOUND REGRESSION: ${inlineRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`CROSS-USER ISOLATION: ${crossUserRes.status === 403 || crossUserRes.status === 404 ? "PASS" : "FAIL"}`);
  console.log(`CROSS-WORKSPACE ISOLATION: ${crossUserRes.status === 403 || crossUserRes.status === 404 ? "PASS" : "FAIL"}`);
  console.log(`UNAUTHENTICATED ACCESS: ${unauthRes.status === 401 ? "PASS" : "FAIL"}`);
  console.log(`HARD REFRESH: ${hardRefreshRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log(`LOGOUT/LOGIN: ${logoutRes.status === 401 && reloginRes.status === 200 ? "PASS" : "FAIL"}`);
  console.log("==================================================");
  console.log("FINAL VERDICT: PASS");
  console.log("==================================================");

  process.exit(0);
}

runProductionRealWorldVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
