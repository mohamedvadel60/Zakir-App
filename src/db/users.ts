import { db, withRetry } from "./index.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

export async function getOrCreateUser(uid: string, email: string, companyName?: string, role?: string) {
  const isEmailAdmin = uid === "usr_ceo" || uid === "SYhfciebGFUj29gqGaa0pqNunrk2";
  const finalRole = isEmailAdmin ? (role || "CEO") : (role || "Contributor");

  if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
    return {
      id: 1,
      uid,
      email,
      companyName: companyName || "Enterprise Account",
      role: finalRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  try {
    return await withRetry(async () => {
      const result = await db.insert(users)
        .values({
          uid,
          email,
          companyName: companyName || "Enterprise Account",
          role: finalRole,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            companyName: companyName || "Enterprise Account",
            role: finalRole,
          },
        })
        .returning();

      return result[0];
    });
  } catch (error) {
    console.warn("Database query in getOrCreateUser failed, falling back to in-memory user:", error);
    return {
      id: 1,
      uid,
      email,
      companyName: companyName || "Enterprise Account",
      role: finalRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

