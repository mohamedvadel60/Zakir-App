import fetch from "node-fetch";
if (!globalThis.fetch) {
  (globalThis as any).fetch = fetch;
}

import { adminDb, isFirebaseAdminAvailable } from "./src/lib/firebase-admin.js";
import { resolveDocumentFromStorage } from "./server.js";
import fs from "fs";
import path from "path";

async function testResolverWithoutContext() {
  console.log("==================== TESTING ALL USER DOCUMENTS WITHOUT USERID CONTEXT ====================");

  const docsToTest: { docId: string; userId: string; fileName: string; meta: any }[] = [];

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const snap = await adminDb.collection("users").get();
      snap.docs.forEach((doc) => {
        const uData = doc.data();
        const uId = doc.id;
        const allDocs = [
          ...(Array.isArray(uData.verificationDocuments) ? uData.verificationDocuments : []),
          ...(Array.isArray(uData.documents) ? uData.documents : []),
          ...(Array.isArray(uData.verificationInfo?.documents) ? uData.verificationInfo.documents : []),
          ...(Array.isArray(uData.files) ? uData.files : [])
        ];
        allDocs.forEach((d) => {
          if (!d) return;
          const dId = d.documentId || d.id || d.fileId || d.storageReference || d.fileName;
          if (dId && !docsToTest.some((dt) => dt.docId === dId)) {
            docsToTest.push({
              docId: dId,
              userId: uId,
              fileName: d.fileName || d.name || "document",
              meta: d
            });
          }
        });
      });
    } catch (e: any) {}
  }

  console.log(`- Found ${docsToTest.length} document references across Firestore users.\n`);

  for (let i = 0; i < Math.min(docsToTest.length, 10); i++) {
    const item = docsToTest[i];
    console.log(`--- [Test ${i + 1}] Testing DocID: "${item.docId}" (Omitting userId: "${item.userId}") ---`);
    try {
      const result = await resolveDocumentFromStorage(item.docId, {
        callerUid: "SYhfciebGFUj29gqGaa0pqNunrk2",
        callerEmail: "admin@zakir.ai"
      });
      console.log(`  ✅ RESOLVED SUCCESS! Source: ${result.source} | Size: ${result.size} | MIME: ${result.mimeType}`);
    } catch (err: any) {
      console.log(`  ❌ FAILED: ${err.message}`);
    }
  }

  process.exit(0);
}

testResolverWithoutContext().catch((e) => {
  console.error(e);
  process.exit(1);
});
