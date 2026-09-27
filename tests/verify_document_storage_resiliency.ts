import path from "path";
import fs from "fs";

async function runStorageTest() {
  console.log("=== STARTING DOCUMENT STORAGE RESILIENCY TEST ===");

  const serverModule: any = await import("../server.js");
  const resolveDocumentFromStorage = serverModule.resolveDocumentFromStorage;

  const testDocId = `doc_test_resiliency_${Date.now()}`;
  const testDocName = "ChatGPT Image 23 sept. 2026, 18_53_39.png";

  // 1. Create a metadata-only record in verification_documents_store
  const dbPath = path.resolve("./data/db.json");
  let db: any = { verification_documents_store: {} };
  if (fs.existsSync(dbPath)) {
    try { db = JSON.parse(fs.readFileSync(dbPath, "utf-8")); } catch (e) {}
  }
  if (!db.verification_documents_store) db.verification_documents_store = {};

  db.verification_documents_store[testDocId] = {
    documentId: testDocId,
    fileName: testDocName,
    mimeType: "image/png",
    size: 512000,
    category: "personal",
    uploadedAt: new Date().toISOString()
  };

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
  console.log(`[STORAGE TEST] Created metadata-only record for ${testDocId}`);

  // 2. Call resolveDocumentFromStorage for this documentId
  const resolved = await resolveDocumentFromStorage(testDocId);
  console.log(`[STORAGE TEST RESULT] Source: ${resolved.source}, MimeType: ${resolved.mimeType}, Size: ${resolved.size}`);

  if (!resolved || !resolved.buffer || resolved.buffer.length === 0) {
    console.error("STORAGE TEST FAILED: Buffer is empty!");
    process.exit(1);
  }

  if (resolved.mimeType !== "image/svg+xml" && resolved.mimeType !== "image/png") {
    console.error(`STORAGE TEST FAILED: Unexpected mime type ${resolved.mimeType}`);
    process.exit(1);
  }

  console.log("=== DOCUMENT STORAGE RESILIENCY TEST PASSED SUCCESSFULLY ===");
}

runStorageTest().catch(err => {
  console.error("STORAGE TEST ERROR:", err);
  process.exit(1);
});
