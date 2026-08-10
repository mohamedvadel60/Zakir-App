import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "./schema.js";

declare global {
  var _postgresPool: any | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    });

    global._postgresPool.on("error", (err: any) => {
      console.warn("Unexpected error on idle SQL pool client (handling gracefully):", err?.message || err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

/**
 * Executes a database operation with auto-retry for ECONNRESET / transient network glitches.
 */
export async function withRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const isConnectionError =
        err?.code === "ECONNRESET" ||
        err?.code === "57P01" ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("Connection terminated");

      if (isConnectionError && attempt <= retries) {
        console.warn(`SQL connection reset encountered. Retrying query (attempt ${attempt}/${retries})...`);
        await new Promise((res) => setTimeout(res, 200 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded for SQL query");
}

export { schema };

