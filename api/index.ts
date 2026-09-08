// @ts-ignore
import serverModule from "./_server.cjs";
const app = (serverModule as any)?.default || serverModule;

/**
 * Central Vercel Serverless Function entrypoint.
 * Normalizes incoming request paths across different Vercel edge rewrite configurations
 * and delegates all requests directly to the single authoritative Express application in server.ts.
 */
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

export function resolveNormalizedUrl(req: any): string {
  const incoming = (req.url || "").trim();

  // Helper to ensure clean /api prefix
  const ensureApiPrefix = (p: string) => {
    const clean = p.replace(/^\/+/, "");
    return clean.startsWith("api/") ? `/${clean}` : `/api/${clean}`;
  };

  // 1. If incoming already has a path beyond /api (e.g. /api/stripe/create-checkout-session)
  if (incoming.startsWith("/api/") && !incoming.startsWith("/api?")) {
    return incoming;
  }

  // 2. Check query params injected by Vercel rewrites (?__path=..., ?0=..., ?route=...)
  try {
    const [pathPart, queryPart] = incoming.split("?");
    const searchParams = new URLSearchParams(queryPart || "");

    const rewriteSubpath =
      searchParams.get("__path") ||
      searchParams.get("0") ||
      searchParams.get("path") ||
      (req.query && (req.query.__path || req.query["0"] || req.query.path || (Array.isArray(req.query.route) ? req.query.route.join("/") : req.query.route)));

    if (rewriteSubpath && typeof rewriteSubpath === "string" && rewriteSubpath.trim()) {
      const decodedSubpath = decodeURIComponent(rewriteSubpath.trim());
      // Remove router rewrite artifacts from query string so downstream handlers don't see them
      searchParams.delete("__path");
      searchParams.delete("0");
      searchParams.delete("path");
      searchParams.delete("route");
      const remainingQuery = searchParams.toString();
      const resolvedBase = ensureApiPrefix(decodedSubpath);
      return remainingQuery ? `${resolvedBase}?${remainingQuery}` : resolvedBase;
    }
  } catch (e) {}

  // 3. Check Vercel regex route match header (e.g. x-now-route-matches: 1=stripe%2Fcreate-checkout-session)
  const routeMatchesHeader = req.headers?.["x-now-route-matches"];
  if (routeMatchesHeader && typeof routeMatchesHeader === "string") {
    try {
      const parsed = new URLSearchParams(routeMatchesHeader);
      const matched = parsed.get("1") || parsed.get("0");
      if (matched) {
        const decoded = decodeURIComponent(matched.trim());
        const resolvedBase = ensureApiPrefix(decoded);
        const qIdx = incoming.indexOf("?");
        return qIdx >= 0 ? `${resolvedBase}${incoming.substring(qIdx)}` : resolvedBase;
      }
    } catch (e) {}
  }

  // 4. Check headers passed by proxy / edge (x-forwarded-uri, x-original-url, x-rewrite-url, x-matched-path)
  const headerCandidates = [
    req.headers?.["x-forwarded-uri"],
    req.headers?.["x-original-url"],
    req.headers?.["x-rewrite-url"],
    req.headers?.["x-matched-path"],
    req.headers?.["x-vercel-matched-path"]
  ];

  for (const h of headerCandidates) {
    if (typeof h === "string" && h.trim()) {
      const cleanHeader = h.trim();
      if (cleanHeader.startsWith("/api/") && !cleanHeader.startsWith("/api?")) {
        return cleanHeader;
      }
      if (cleanHeader.startsWith("/") && !cleanHeader.startsWith("/api") && cleanHeader !== "/") {
        return ensureApiPrefix(cleanHeader);
      }
    }
  }

  // 5. If incoming URL starts with a known API segment missing /api
  if (
    incoming.startsWith("/stripe") ||
    incoming.startsWith("/auth") ||
    incoming.startsWith("/admin") ||
    incoming.startsWith("/workspace") ||
    incoming.startsWith("/memory") ||
    incoming.startsWith("/analysis") ||
    incoming.startsWith("/health")
  ) {
    return ensureApiPrefix(incoming);
  }

  // 6. Default fallback
  return incoming || "/api";
}

export default async function handler(req: any, res: any) {
  // 1. Normalize method to uppercase
  if (req.method && typeof req.method === "string") {
    req.method = req.method.toUpperCase();
  }

  // 2. CORS Preflight & Global Headers
  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-goog-api-key, X-Requested-With, Accept, Origin, X-Api-Key, X-HTTP-Method-Override, x-http-method-override"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Resolve true requested URL path across Vercel rewrite strategies
  const normalizedUrl = resolveNormalizedUrl(req);
  req.url = normalizedUrl;
  req.originalUrl = normalizedUrl;

  // 4. Delegate to Express app (Single Source of Truth)
  return app(req, res);
}

