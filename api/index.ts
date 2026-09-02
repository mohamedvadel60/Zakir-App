process.env.SKIP_SERVER_LISTEN = "true";
process.env.VERCEL = "1";

import type { IncomingMessage, ServerResponse } from "http";
import app from "../server";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return (app as any)(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Invocation Exception]", err);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: "SERVERLESS_INVOCATION_ERROR",
        message: err?.message || "Internal serverless function error"
      }));
    }
  }
}


