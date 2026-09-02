import multer from "multer";
import crypto from "crypto";
import path from "path";
import { 
  validateFileSignature, 
  saveDocumentToPersistentStorage, 
  registerPendingUpload 
} from "../../../src/lib/recoveryService.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
}).any();

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    try {
      await runMiddleware(req, res, uploadMiddleware);
    } catch (multerErr: any) {
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "IDENTITY_DOCUMENT_TOO_LARGE",
          message: "The uploaded file exceeds the 10MB size limit."
        });
      }
      return res.status(400).json({
        success: false,
        error: "FILE_UPLOAD_ERROR",
        message: multerErr.message || "Failed to process multipart upload."
      });
    }

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : ((req.files as any)?.document?.[0] || (req.files as any)?.file?.[0]));
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        error: "MISSING_FILE",
        message: "No document file was uploaded in the request."
      });
    }

    if (file.size > 10 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "IDENTITY_DOCUMENT_TOO_LARGE",
        message: "The uploaded file exceeds the 10MB size limit."
      });
    }

    const originalName = file.originalname || "document";
    const ext = path.extname(originalName).toLowerCase();
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".webp", ".heic", ".heif", ".txt"];
    const allowedMimeKeywords = ["pdf", "image", "png", "jpeg", "jpg", "msword", "officedocument", "text", "octet-stream"];

    const fileMime = (file.mimetype || "").toLowerCase();
    const isMimeValid = allowedMimeKeywords.some(kw => fileMime.includes(kw));
    const isExtValid = allowedExtensions.includes(ext);

    if (!isMimeValid && !isExtValid) {
      return res.status(400).json({
        success: false,
        error: "UNSUPPORTED_FORMAT",
        message: "Unsupported file format. Please upload PDF, Word (.doc/.docx), PNG, JPEG, or TXT documents."
      });
    }

    if (!validateFileSignature(file.buffer, file.mimetype || ext)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_FILE_SIGNATURE",
        message: "File contents do not match the expected format signature."
      });
    }

    const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const uploadToken = crypto.randomBytes(32).toString("hex");
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9.-]/g, "_");

    // Save to persistent storage (Firestore chunks + local cache)
    await saveDocumentToPersistentStorage(documentId, file.buffer, file.mimetype, {
      fileName: safeName,
      size: file.size,
      fileHash
    });

    const docMeta = {
      documentId,
      uploadToken,
      fileHash,
      storageReference: `secure_uploads/${documentId}`,
      fileName: safeName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      storageStatus: "pending"
    };

    await registerPendingUpload(documentId, uploadToken, docMeta);

    return res.status(200).json({
      success: true,
      documentId,
      uploadToken,
      storageStatus: "pending",
      document: docMeta
    });
  } catch (err: any) {
    console.error("[Recovery Upload Function Error]", err);
    return res.status(500).json({
      success: false,
      error: "DOCUMENT_UPLOAD_FAILED",
      message: err.message || "Failed to persist document to primary durable storage."
    });
  }
}
