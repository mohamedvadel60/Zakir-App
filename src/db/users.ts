import { db, withRetry } from "./index.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

export async function getOrCreateUser(uid: string, email: string, companyName?: string, role?: string) {
  try {
    const isEmailAdmin = uid === "usr_ceo" || email.toLowerCase() === "mohamedvadel60@gmail.com";
    const finalRole = isEmailAdmin ? (role || "CEO") : "Analyst";

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
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

