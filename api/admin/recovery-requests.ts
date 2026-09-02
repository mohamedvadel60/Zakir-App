import { getAdminRecoveryRequests } from "../../src/lib/recoveryService.js";

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
    const result = await getAdminRecoveryRequests();
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Admin Recovery Requests Function Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch recovery requests."
    });
  }
}
