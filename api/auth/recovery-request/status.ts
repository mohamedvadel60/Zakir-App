import { getRecoveryStatus } from "../../../src/lib/recoveryService.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

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
    const email = req.query?.email;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: "Email query parameter is required."
      });
    }

    const result = await getRecoveryStatus(email);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Recovery Status Function Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to determine recovery status."
    });
  }
}
