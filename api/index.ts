import app from "../server.js";

/**
 * Central Vercel Serverless Function entrypoint.
 * Normalizes incoming request paths across different Vercel edge rewrite configurations
 * and delegates all requests directly to the single authoritative Express application in server.ts.
 */
export default async function handler(req: any, res: any) {
  // 1. CORS Preflight & Global Headers
  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-goog-api-key, X-Requested-With, Accept, Origin, X-Api-Key"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. Resolve true requested URL path across Vercel rewrite strategies
  // When Vercel rewrites /api/stripe/* to /api, it provides the original matched path in headers:
  const incomingUrl = req.url || "";
  const matchedPath =
    req.headers?.["x-matched-path"] ||
    req.headers?.["x-forwarded-uri"] ||
    req.headers?.["x-original-url"] ||
    req.headers?.["x-rewrite-url"];

  if (
    matchedPath &&
    typeof matchedPath === "string" &&
    (incomingUrl === "/api" || incomingUrl === "/api/" || incomingUrl === "/" || incomingUrl === "")
  ) {
    req.url = matchedPath;
  } else if (incomingUrl && !incomingUrl.startsWith("/api") && !incomingUrl.startsWith("/stripe")) {
    req.url = "/api" + incomingUrl;
  }

  // 3. Delegate to Express app (Single Source of Truth)
  return app(req, res);
}

