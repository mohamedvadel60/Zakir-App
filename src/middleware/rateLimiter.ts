import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const stores: { [endpoint: string]: RateLimitStore } = {};

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  endpointName: string;
}) => {
  const { windowMs, max, message, endpointName } = options;
  if (!stores[endpointName]) {
    stores[endpointName] = {};
  }
  const store = stores[endpointName];

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client IP (handling standard proxies/headers safely)
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown-ip";
    
    const now = Date.now();
    const record = store[ip];

    if (!record) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      console.warn(`[RATE LIMIT EXCEEDED] IP: ${ip} on ${endpointName}. Count: ${record.count}/${max}`);
      return res.status(429).json({
        code: "auth/too-many-requests",
        error: message || "Too many requests from this IP, please try again later.",
        message: message || "تم حظر المحاولات مؤقتاً لكثرة المحاولات. يرجى الانتظار قليلاً والمحاولة مجدداً.",
        cooldownRemainingSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};
