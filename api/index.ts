process.env.SKIP_SERVER_LISTEN = "true";
process.env.VERCEL = "1";

import type { IncomingMessage, ServerResponse } from "http";
import app from "../server";

const expressApp = (app as any)?.default || app;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (typeof expressApp === "function") {
      return expressApp(req, res);
    }
    const fallbackApp = (app as any)?.default || app;
    if (typeof fallbackApp === "function") {
      return fallbackApp(req, res);
    }
    throw new Error("Express application handler is not a callable function");
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
