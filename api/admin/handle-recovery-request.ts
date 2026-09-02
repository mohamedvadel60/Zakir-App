import { handleAdminRecoveryDecision } from "../../src/lib/recoveryService.js";

async function getCallerUid(req: any): Promise<string | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) return null;
  try {
    const { adminAuth } = await import("../../src/lib/firebase-admin.js");
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded?.uid || null;
  } catch (e) {
    return null;
  }
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
    const callerUid = await getCallerUid(req);
    const { requestId, email, action, rejectionReason, notes } = req.body || {};

    if (!requestId && !email) {
      return res.status(400).json({
        success: false,
        error: "Missing requestId or email parameter."
      });
    }

    const result = await handleAdminRecoveryDecision({
      requestId,
      email,
      action: action || "approve",
      rejectionReason,
      notes,
      callerUid: callerUid || undefined
    });

    if (!result.success) {
      const statusCode = result.code === "REQUEST_ALREADY_PROCESSED" ? 409 :
                         result.code === "REQUEST_NOT_FOUND" ? 404 :
                         result.code === "FORBIDDEN" ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Admin Handle Recovery Request Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to process recovery request decision."
    });
  }
}
