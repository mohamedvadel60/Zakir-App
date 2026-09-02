import { submitRecoveryRequest } from "../../../src/lib/recoveryService.js";

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
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        success: false,
        error: "Invalid JSON request payload."
      });
    }

    const result = await submitRecoveryRequest(payload);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Recovery Submit Function Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to submit recovery request."
    });
  }
}
