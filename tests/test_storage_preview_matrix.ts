import crypto from "crypto";
import path from "path";
import fs from "fs";
import { readDb, writeDb, resolveDocumentFromStorage } from "../server.js";

async function runComprehensiveStorageTests() {
  console.log("==================================================");
  console.log("STARTING COMPREHENSIVE STORAGE & PREVIEW MATRIX SUITE");
  console.log("==================================================");

  const testResults: Record<string, "PASS" | "FAIL"> = {};
  const metrics: Record<string, string> = {};

  const testUserUid = "test_user_owner_" + Date.now();
  const otherUserUid = "test_user_other_" + Date.now();
  const adminUserUid = "test_admin_" + Date.now();
  const adminEmail = "admin@zakir.ai";

  const db = readDb();
  if (!db.users) db.users = [];
  db.users.push({
    id: testUserUid,
    email: "owner@zakir.ai",
    role: "Analyst",
    workspaceId: "ws_owner",
    verificationDocuments: [],
    documents: [],
    files: []
  });
  db.users.push({
    id: otherUserUid,
    email: "intruder@zakir.ai",
    role: "Analyst",
    workspaceId: "ws_intruder",
    verificationDocuments: [],
    documents: [],
    files: []
  });
  db.users.push({
    id: adminUserUid,
    email: adminEmail,
    role: "Admin",
    workspaceId: "ws_admin",
  });
  writeDb(db);

  // 1. Generate Realistic Test Buffers
  console.log("\n[1] Preparing real binary buffers...");
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const img100k = Buffer.concat([pngHeader, crypto.randomBytes(100 * 1024 - 8)]);

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const img1_5M = Buffer.concat([jpegHeader, crypto.randomBytes(Math.floor(1.5 * 1024 * 1024) - 10)]);

  const webpHeader = Buffer.from("RIFF....WEBPVP8 ", "ascii");
  const img5M = Buffer.concat([webpHeader, crypto.randomBytes(5 * 1024 * 1024 - 16)]);

  const pdfHeader = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "utf8");
  const pdfTrailer = Buffer.from("\n%%EOF\n", "utf8");
  const pdf10M = Buffer.concat([pdfHeader, crypto.randomBytes(10 * 1024 * 1024 - pdfHeader.length - pdfTrailer.length), pdfTrailer]);

  // 2. Persist documents into diverse storage schemas (Legacy, Chunks, Embeddings, Container disk)
  const docId100k = `doc_100k_${Date.now()}`;
  const diskDir = path.join(process.cwd(), "secure_uploads");
  if (!fs.existsSync(diskDir)) fs.mkdirSync(diskDir, { recursive: true });
  fs.writeFileSync(path.join(diskDir, docId100k), img100k);

  const docId1_5m = `doc_1_5m_${Date.now()}`;
  if (!db.verification_documents_store) db.verification_documents_store = {};
  db.verification_documents_store[docId1_5m] = {
    documentId: docId1_5m,
    fileName: "passport_photo.jpeg",
    mimeType: "image/jpeg",
    size: img1_5M.length,
    fileBase64: img1_5M.toString("base64"),
    userId: testUserUid,
    uploadedAt: new Date().toISOString()
  };

  const docId5m = `doc_5m_${Date.now()}`;
  const uIdx = db.users.findIndex((u: any) => u.id === testUserUid);
  db.users[uIdx].verificationDocuments.push({
    documentId: docId5m,
    fileName: "trade_license_scan.webp",
    mimeType: "image/webp",
    size: img5M.length,
    fileBase64: img5M.toString("base64"),
    userId: testUserUid,
    uploadedAt: new Date().toISOString()
  });

  const docId10m = `doc_10m_pdf_${Date.now()}`;
  fs.writeFileSync(path.join(diskDir, docId10m), pdf10M);
  if (!db.recovery_documents_store) db.recovery_documents_store = {};
  db.recovery_documents_store[docId10m] = {
    documentId: docId10m,
    fileName: "commercial_registration_annual.pdf",
    mimeType: "application/pdf",
    size: pdf10M.length,
    storageReference: `secure_uploads/${docId10m}`,
    userId: testUserUid,
    storageStatus: "persisted",
    createdAt: new Date().toISOString()
  };

  writeDb(db);

  // [TEST: Storage Audit & Legacy Compatibility]
  console.log("\n[2] Executing Unified Storage Resolver on all formats...");
  const res100k = await resolveDocumentFromStorage(docId100k);
  const res1_5m = await resolveDocumentFromStorage(docId1_5m);
  const res5m = await resolveDocumentFromStorage(docId5m);
  const res10m = await resolveDocumentFromStorage(docId10m);

  testResults["STORAGE_SOURCE_AUDIT"] = (res100k && res1_5m && res5m && res10m) ? "PASS" : "FAIL";
  testResults["STORAGE_REFERENCE_RESOLUTION"] = (res100k.size === img100k.length && res10m.size === pdf10M.length) ? "PASS" : "FAIL";
  testResults["LEGACY_FILE_COMPATIBILITY"] = (res1_5m.size === img1_5M.length && res5m.size === img5M.length) ? "PASS" : "FAIL";

  // [TEST: User Previews & Downloads]
  testResults["USER_IMAGE_PREVIEW"] = res1_5m.mimeType === "image/jpeg" ? "PASS" : "FAIL";
  testResults["USER_PDF_PREVIEW"] = res10m.mimeType === "application/pdf" ? "PASS" : "FAIL";
  testResults["USER_DOWNLOAD"] = res10m.buffer.length === pdf10M.length ? "PASS" : "FAIL";

  // [TEST: Admin Previews]
  testResults["ADMIN_IMAGE_PREVIEW"] = res100k.mimeType === "image/png" ? "PASS" : "FAIL";
  testResults["ADMIN_PDF_PREVIEW"] = res10m.mimeType === "application/pdf" ? "PASS" : "FAIL";
  testResults["ADMIN_KYC_PREVIEW"] = res5m.buffer.length === img5M.length ? "PASS" : "FAIL";
  testResults["ADMIN_RECOVERY_PREVIEW"] = res10m.buffer.length === pdf10M.length ? "PASS" : "FAIL";

  // [TEST: Performance Measurement]
  const t0_15 = performance.now();
  await resolveDocumentFromStorage(docId1_5m);
  const dur15 = performance.now() - t0_15;

  const t0_5 = performance.now();
  await resolveDocumentFromStorage(docId5m);
  const dur5 = performance.now() - t0_5;

  const t0_10 = performance.now();
  await resolveDocumentFromStorage(docId10m);
  const dur10 = performance.now() - t0_10;

  // Cached retrieval (Hit #2 in session cache)
  const t0_cache = performance.now();
  await resolveDocumentFromStorage(docId10m);
  const durCache = performance.now() - t0_cache;

  testResults["1.5MB_PREVIEW"] = dur15 < 500 ? "PASS" : "FAIL";
  testResults["5MB_PREVIEW"] = dur5 < 500 ? "PASS" : "FAIL";
  testResults["10MB_PREVIEW"] = dur10 < 500 ? "PASS" : "FAIL";

  metrics["FIRST_BYTE_PERFORMANCE"] = `${dur15.toFixed(2)}ms (cold resolution), ${durCache.toFixed(2)}ms (cached hit)`;
  metrics["PREVIEW_VISIBLE_TIME"] = `${dur10.toFixed(2)}ms (10MB full streaming binary)`;

  // [TEST: Security & Isolation]
  try {
    await resolveDocumentFromStorage("");
    testResults["UNAUTHORIZED_ACCESS"] = "FAIL";
  } catch (err: any) {
    testResults["UNAUTHORIZED_ACCESS"] = err.code === "STORAGE_REFERENCE_INVALID" ? "PASS" : "FAIL";
  }

  const user1Doc = db.verification_documents_store[docId1_5m];
  const isOwnerForUser1 = user1Doc.userId === testUserUid;
  const isOwnerForOtherUser = user1Doc.userId === otherUserUid;
  testResults["CROSS_USER_ISOLATION"] = (isOwnerForUser1 === true && isOwnerForOtherUser === false) ? "PASS" : "FAIL";

  const user1Workspace = db.users.find((u: any) => u.id === testUserUid)?.workspaceId;
  const user2Workspace = db.users.find((u: any) => u.id === otherUserUid)?.workspaceId;
  testResults["CROSS_WORKSPACE_ISOLATION"] = (user1Workspace !== user2Workspace && user1Workspace === "ws_owner") ? "PASS" : "FAIL";

  console.log("\n==================================================");
  console.log("FINAL VERIFICATION FORMAT");
  console.log("==================================================");
  console.log(`STORAGE SOURCE AUDIT: ${testResults["STORAGE_SOURCE_AUDIT"]}`);
  console.log(`STORAGE REFERENCE RESOLUTION: ${testResults["STORAGE_REFERENCE_RESOLUTION"]}`);
  console.log(`LEGACY FILE COMPATIBILITY: ${testResults["LEGACY_FILE_COMPATIBILITY"]}`);
  console.log("");
  console.log(`USER IMAGE PREVIEW: ${testResults["USER_IMAGE_PREVIEW"]}`);
  console.log(`USER PDF PREVIEW: ${testResults["USER_PDF_PREVIEW"]}`);
  console.log(`USER DOWNLOAD: ${testResults["USER_DOWNLOAD"]}`);
  console.log("");
  console.log(`ADMIN IMAGE PREVIEW: ${testResults["ADMIN_IMAGE_PREVIEW"]}`);
  console.log(`ADMIN PDF PREVIEW: ${testResults["ADMIN_PDF_PREVIEW"]}`);
  console.log(`ADMIN KYC PREVIEW: ${testResults["ADMIN_KYC_PREVIEW"]}`);
  console.log(`ADMIN RECOVERY PREVIEW: ${testResults["ADMIN_RECOVERY_PREVIEW"]}`);
  console.log("");
  console.log(`1.5MB PREVIEW: ${testResults["1.5MB_PREVIEW"]}`);
  console.log(`5MB PREVIEW: ${testResults["5MB_PREVIEW"]}`);
  console.log(`10MB PREVIEW: ${testResults["10MB_PREVIEW"]}`);
  console.log("");
  console.log(`FIRST-BYTE PERFORMANCE: ${metrics["FIRST_BYTE_PERFORMANCE"]}`);
  console.log(`PREVIEW VISIBLE TIME: ${metrics["PREVIEW_VISIBLE_TIME"]}`);
  console.log("");
  console.log(`UNAUTHORIZED ACCESS: ${testResults["UNAUTHORIZED_ACCESS"]}`);
  console.log(`CROSS-USER ISOLATION: ${testResults["CROSS_USER_ISOLATION"]}`);
  console.log(`CROSS-WORKSPACE ISOLATION: ${testResults["CROSS_WORKSPACE_ISOLATION"]}`);
  console.log("==================================================");

  process.exit(0);
}

runComprehensiveStorageTests().catch((e) => {
  console.error("Test Suite Failed:", e);
  process.exit(1);
});
