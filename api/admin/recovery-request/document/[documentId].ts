import { getDocumentFromPersistentStorage } from "../../../../src/lib/recoveryService.js";
import { adminDb, isFirebaseAdminAvailable } from "../../../../src/lib/firebase-admin.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET."
    });
  }

  try {
    const documentId = req.query?.documentId;
    if (!documentId || typeof documentId !== "string" || !/^[a-zA-Z0-9_]+$/.test(documentId)) {
      return res.status(400).json({
        success: false,
        error: "Valid documentId parameter is required."
      });
    }

    const buffer = await getDocumentFromPersistentStorage(documentId);
    let mimeType = "application/octet-stream";

    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const snap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
        if (snap.exists) {
          mimeType = snap.data()?.mimeType || mimeType;
        }
      } catch (e) {}
    }

    if (mimeType === "application/octet-stream") {
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        mimeType = "application/pdf";
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        mimeType = "image/png";
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        mimeType = "image/jpeg";
      }
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return res.status(200).send(buffer);
  } catch (err: any) {
    console.error("[Admin Recovery Document Stream Error]", err);
    return res.status(404).json({
      success: false,
      error: "Document not found or access expired."
    });
  }
}
