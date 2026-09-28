import crypto from "crypto";
import path from "path";
import fs from "fs";
import { readDb, writeDb, resolveDocumentFromStorage } from "../server.js";

async function runAdminDocResolverTests() {
  console.log("==================================================");
  console.log("RUNNING ADMIN DOCUMENT STORAGE & RESOLUTION TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  }

  // 1. Test resolving from storage/documents directory
  console.log("\n--- Testing storage/documents resolution ---");
  const docDir = path.join(process.cwd(), "storage", "documents");
  if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

  const testBinDocId = `doc_test_bin_${Date.now()}`;
  const testBinBuffer = Buffer.from("%PDF-1.7 Test PDF binary for admin preview", "utf8");
  fs.writeFileSync(path.join(docDir, `${testBinDocId}.bin`), testBinBuffer);

  const resBin = await resolveDocumentFromStorage(testBinDocId);
  assert("Resolves binary from storage/documents/<id>.bin", resBin && resBin.buffer.equals(testBinBuffer));
  assert("Detects PDF MIME type correctly", resBin && resBin.mimeType === "application/pdf");

  // 2. Test resolving inline base64 in verification_documents_store
  console.log("\n--- Testing verification_documents_store Base64 resolution ---");
  const db = readDb();
  if (!db.verification_documents_store) db.verification_documents_store = {};
  const b64DocId = `doc_b64_${Date.now()}`;
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngPayload = Buffer.concat([pngHeader, Buffer.from("PNG_SAMPLE_DATA_FOR_ADMIN_TEST")]);
  
  db.verification_documents_store[b64DocId] = {
    documentId: b64DocId,
    fileName: "id_card_front.png",
    mimeType: "image/png",
    size: pngPayload.length,
    fileBase64: pngPayload.toString("base64"),
    userId: "user_123",
  };
  writeDb(db);

  const resB64 = await resolveDocumentFromStorage(b64DocId);
  assert("Resolves base64 from verification_documents_store", resB64 && resB64.buffer.equals(pngPayload));
  assert("Preserves correct MIME type image/png", resB64 && resB64.mimeType === "image/png");
  assert("Preserves filename id_card_front.png", resB64 && resB64.fileName === "id_card_front.png");

  // 3. Test user verificationDocuments array resolution
  console.log("\n--- Testing user profile document array resolution ---");
  const nestedDocId = `doc_nested_${Date.now()}`;
  const nestedUserUid = `user_nested_${Date.now()}`;
  const nestedPayload = Buffer.from("%PDF-1.5 User passport scan", "utf8");

  if (!db.users) db.users = [];
  db.users.push({
    id: nestedUserUid,
    uid: nestedUserUid,
    email: "nested@example.com",
    verificationDocuments: [
      {
        documentId: nestedDocId,
        fileName: "passport.pdf",
        mimeType: "application/pdf",
        size: nestedPayload.length,
        fileBase64: nestedPayload.toString("base64"),
      }
    ]
  });
  writeDb(db);

  const resNested = await resolveDocumentFromStorage(nestedDocId);
  assert("Resolves document embedded in user.verificationDocuments array", resNested && resNested.buffer.equals(nestedPayload));

  // 4. Test User UID fallback
  console.log("\n--- Testing resolution by passing User UID with documentId ---");
  const resByUid = await resolveDocumentFromStorage(nestedDocId, { userId: nestedUserUid });
  assert("Resolves correctly when userId is explicitly supplied", resByUid && resByUid.buffer.equals(nestedPayload));

  // 5. Test Missing file returns FILE_NOT_FOUND error (no fake/mock fallback)
  console.log("\n--- Testing genuine 404 on non-existent document ---");
  let caughtError: any = null;
  try {
    await resolveDocumentFromStorage("completely_nonexistent_doc_id_99999");
  } catch (err: any) {
    caughtError = err;
  }
  assert("Non-existent document throws error", caughtError !== null);
  assert("Error code is FILE_NOT_FOUND", caughtError && caughtError.code === "FILE_NOT_FOUND");
  assert("Error status is 404", caughtError && caughtError.status === 404);

  // 6. Test empty document ID validation
  console.log("\n--- Testing empty document ID validation ---");
  let caughtEmpty: any = null;
  try {
    await resolveDocumentFromStorage("");
  } catch (err: any) {
    caughtEmpty = err;
  }
  assert("Empty document ID throws error", caughtEmpty !== null);
  assert("Error code is STORAGE_REFERENCE_INVALID", caughtEmpty && caughtEmpty.code === "STORAGE_REFERENCE_INVALID");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdminDocResolverTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
