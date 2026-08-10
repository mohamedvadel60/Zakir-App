import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Users table mapping Firebase Auth UID to SQL
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  companyName: text("company_name").default("Enterprise Account"),
  role: text("role").default("CEO"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gmail action and sending log table
export const gmailLogs = pgTable("gmail_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  actionType: text("action_type").notNull(), // "SEND_EMAIL", "READ_EMAIL", "DISCONNECT"
  recipient: text("recipient"), // To whom an email was sent, if applicable
  subject: text("subject"), // Subject line of the email, if applicable
  status: text("status").notNull(), // "SUCCESS", "FAILED"
  createdAt: timestamp("created_at").defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  gmailLogs: many(gmailLogs),
}));

export const gmailLogsRelations = relations(gmailLogs, ({ one }) => ({
  user: one(users, {
    fields: [gmailLogs.userId],
    references: [users.id],
  }),
}));
