var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/env.ts
import dotenv from "dotenv";
dotenv.config({ override: true });

// server.ts
import { Resend } from "resend";
import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import path3 from "path";
import fs3 from "fs";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import dotenv2 from "dotenv";
import Stripe from "stripe";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  gmailLogs: () => gmailLogs,
  gmailLogsRelations: () => gmailLogsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID
  email: text("email").notNull(),
  companyName: text("company_name").default("Enterprise Account"),
  role: text("role").default("CEO"),
  createdAt: timestamp("created_at").defaultNow()
});
var gmailLogs = pgTable("gmail_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  actionType: text("action_type").notNull(),
  // "SEND_EMAIL", "READ_EMAIL", "DISCONNECT"
  recipient: text("recipient"),
  // To whom an email was sent, if applicable
  subject: text("subject"),
  // Subject line of the email, if applicable
  status: text("status").notNull(),
  // "SUCCESS", "FAILED"
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  gmailLogs: many(gmailLogs)
}));
var gmailLogsRelations = relations(gmailLogs, ({ one }) => ({
  user: one(users, {
    fields: [gmailLogs.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
var { Pool } = pkg;
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 5e3,
      keepAlive: true
    });
    global._postgresPool.on("error", (err) => {
      console.warn("Unexpected error on idle SQL pool client (handling gracefully):", err?.message || err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });
async function withRetry(operation, retries = 2) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      const isConnectionError = err?.code === "ECONNRESET" || err?.code === "57P01" || err?.message?.includes("ECONNRESET") || err?.message?.includes("Connection terminated");
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

// src/db/users.ts
async function getOrCreateUser(uid, email, companyName, role) {
  try {
    const isEmailAdmin = uid === "usr_ceo" || email.toLowerCase() === "mohamedvadel60@gmail.com";
    const finalRole = isEmailAdmin ? role || "CEO" : "Analyst";
    return await withRetry(async () => {
      const result = await db.insert(users).values({
        uid,
        email,
        companyName: companyName || "Enterprise Account",
        role: finalRole
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          companyName: companyName || "Enterprise Account",
          role: finalRole
        }
      }).returning();
      return result[0];
    });
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

// src/lib/firebase-admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";
var DB_FILE = path.join(process.cwd(), "src", "db_store.json");
function readLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
  }
  return {
    users: [],
    verification_codes: [],
    support_tickets: [],
    memories: [],
    risk_alerts: [],
    invitations: [],
    account_lifecycle: [],
    deleted_users: [],
    retained_users: [],
    account_reactivation_requests: [],
    files: [],
    collections_data: {}
  };
}
function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to write to local db_store.json:", e);
  }
}
function cleanPrivateKey(rawKey) {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\"/g, '"');
  if (key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) {
    const base64Body = key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
    const chunks = base64Body.match(/.{1,64}/g) || [base64Body];
    return `-----BEGIN PRIVATE KEY-----
${chunks.join("\n")}
-----END PRIVATE KEY-----
`;
  }
  return key;
}
function resolveFirebaseCredentials() {
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (parsed.projectId) projectId = parsed.projectId;
      }
    } catch (e) {
    }
  }
  const candidateJsonVars = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    process.env.FIREBASE_CONFIG,
    process.env.GOOGLE_SERVICE_ACCOUNT,
    process.env.FIREBASE_ADMIN_CREDENTIALS
  ];
  for (const candidate of candidateJsonVars) {
    if (candidate && candidate.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.project_id) projectId = projectId || parsed.project_id;
        if (parsed.client_email) clientEmail = clientEmail || parsed.client_email;
        if (parsed.private_key) rawKey = rawKey || parsed.private_key;
      } catch (e) {
      }
    }
  }
  if (rawKey && rawKey.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.project_id) projectId = projectId || parsed.project_id;
      if (parsed.client_email) clientEmail = clientEmail || parsed.client_email;
      if (parsed.private_key) rawKey = parsed.private_key;
    } catch (e) {
    }
  }
  const cleanedKey = cleanPrivateKey(rawKey);
  const hasPemKey = cleanedKey.includes("-----BEGIN PRIVATE KEY-----");
  const isConfigured = Boolean(projectId && clientEmail && hasPemKey);
  return { projectId, clientEmail, cleanedKey, isConfigured };
}
var creds = resolveFirebaseCredentials();
var isFirebaseAdminConfigured = creds.isConfigured;
var rawApp = null;
var rawFirestore = null;
var rawAuth = null;
var rawStorage = null;
if (isFirebaseAdminConfigured) {
  try {
    if (getApps().length > 0) {
      rawApp = getApps()[0];
    } else {
      rawApp = initializeApp({
        credential: cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.cleanedKey
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "potent-turbine-47c1c.firebasestorage.app"
      });
    }
    let dbId = process.env.FIREBASE_DATABASE_ID;
    if (!dbId) {
      try {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          if (parsed.firestoreDatabaseId) dbId = parsed.firestoreDatabaseId;
        }
      } catch (e) {
      }
    }
    if (!dbId) {
      dbId = "ai-studio-zakir1-7e6134f1-66d1-4393-82aa-9c7be9dad725";
    }
    try {
      rawFirestore = getFirestore(rawApp, dbId);
    } catch (e) {
      try {
        rawFirestore = getFirestore(rawApp);
      } catch (e2) {
        rawFirestore = null;
      }
    }
    try {
      rawAuth = getAuth(rawApp);
    } catch (e) {
      rawAuth = null;
    }
    try {
      rawStorage = getStorage(rawApp);
    } catch (e) {
      rawStorage = null;
    }
  } catch (err) {
    console.warn("Failed to initialize Firebase Admin with credentials:", err);
    rawApp = null;
    rawFirestore = null;
    rawAuth = null;
    rawStorage = null;
  }
}
var isFirebaseAdminAvailable = Boolean(rawFirestore);
var isFirebaseAuthAvailable = Boolean(rawAuth);
function getSafeBucket() {
  try {
    if (!rawStorage && isFirebaseAdminAvailable && rawApp) {
      try {
        rawStorage = getStorage(rawApp);
      } catch (e) {
        return null;
      }
    }
    if (!rawStorage || typeof rawStorage.bucket !== "function") return null;
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "potent-turbine-47c1c.firebasestorage.app";
    return rawStorage.bucket(bucketName);
  } catch (err) {
    console.warn("Notice: getSafeBucket warning:", err?.message || err);
    return null;
  }
}
function getCollectionArrayName(colName) {
  const map = {
    users: "users",
    invitations: "invitations",
    support_tickets: "support_tickets",
    verification_codes: "verification_codes",
    accountLifecycle: "account_lifecycle",
    deletedUsers: "deleted_users",
    users_retained: "retained_users",
    accountReactivationRequests: "account_reactivation_requests",
    memories: "memories",
    riskAlerts: "risk_alerts",
    files: "files"
  };
  return map[colName] || colName;
}
function getCollectionItems(db2, colName) {
  const key = getCollectionArrayName(colName);
  if (Array.isArray(db2[key])) return db2[key];
  if (!db2.collections_data) db2.collections_data = {};
  if (!Array.isArray(db2.collections_data[colName])) db2.collections_data[colName] = [];
  return db2.collections_data[colName];
}
function setCollectionItems(db2, colName, items) {
  const key = getCollectionArrayName(colName);
  if (Array.isArray(db2[key]) || key in db2) {
    db2[key] = items;
  } else {
    if (!db2.collections_data) db2.collections_data = {};
    db2.collections_data[colName] = items;
  }
}
var MockQuery = class _MockQuery {
  constructor(colName, subPath) {
    this.filters = [];
    this.colName = colName;
    this.subPath = subPath;
  }
  where(field, op, value) {
    const q = new _MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters, { field, op, value }];
    q.orderField = this.orderField;
    q.orderDirection = this.orderDirection;
    q.limitCount = this.limitCount;
    return q;
  }
  orderBy(field, direction = "asc") {
    const q = new _MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters];
    q.orderField = field;
    q.orderDirection = direction;
    q.limitCount = this.limitCount;
    return q;
  }
  limit(count) {
    const q = new _MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters];
    q.orderField = this.orderField;
    q.orderDirection = this.orderDirection;
    q.limitCount = count;
    return q;
  }
  async get() {
    const db2 = readLocalDb();
    let items = getCollectionItems(db2, this.colName);
    if (this.subPath) {
      if (!db2.subcollections) db2.subcollections = {};
      items = db2.subcollections[this.subPath] || [];
    }
    let filtered = items.filter((item) => {
      for (const f of this.filters) {
        const itemVal = item[f.field];
        if (f.op === "==" && itemVal !== f.value) {
          if (f.field === "email" && typeof itemVal === "string" && typeof f.value === "string") {
            if (itemVal.trim().toLowerCase() !== f.value.trim().toLowerCase()) return false;
          } else {
            return false;
          }
        }
        if (f.op === "!=" && itemVal === f.value) return false;
        if (f.op === ">" && !(itemVal > f.value)) return false;
        if (f.op === "<" && !(itemVal < f.value)) return false;
        if (f.op === ">=" && !(itemVal >= f.value)) return false;
        if (f.op === "<=" && !(itemVal <= f.value)) return false;
      }
      return true;
    });
    if (this.orderField) {
      const field = this.orderField;
      const factor = this.orderDirection === "desc" ? -1 : 1;
      filtered.sort((a, b) => {
        if (a[field] < b[field]) return -1 * factor;
        if (a[field] > b[field]) return 1 * factor;
        return 0;
      });
    }
    if (this.limitCount && this.limitCount > 0) {
      filtered = filtered.slice(0, this.limitCount);
    }
    const docs = filtered.map((item) => ({
      id: item.id || item.email || item.accountId || String(Math.random()),
      exists: true,
      data: () => ({ ...item }),
      ref: {
        id: item.id || item.email || item.accountId,
        delete: async () => {
          const freshDb = readLocalDb();
          if (this.subPath) {
            if (freshDb.subcollections && freshDb.subcollections[this.subPath]) {
              freshDb.subcollections[this.subPath] = freshDb.subcollections[this.subPath].filter(
                (i) => (i.id || i.email) !== (item.id || item.email)
              );
              writeLocalDb(freshDb);
            }
          } else {
            const list = getCollectionItems(freshDb, this.colName);
            const nextList = list.filter((i) => (i.id || i.email || i.accountId) !== (item.id || item.email || item.accountId));
            setCollectionItems(freshDb, this.colName, nextList);
            writeLocalDb(freshDb);
          }
        }
      }
    }));
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs
    };
  }
};
var MockDocRef = class {
  constructor(colName, docId, subPath) {
    this.colName = colName;
    this.docId = docId;
    this.subPath = subPath;
  }
  get id() {
    return this.docId;
  }
  collection(subCol) {
    const fullSubPath = this.subPath ? `${this.subPath}/${this.docId}/${subCol}` : `${this.colName}/${this.docId}/${subCol}`;
    return new MockCollectionRef(subCol, fullSubPath);
  }
  async get() {
    const db2 = readLocalDb();
    let item = null;
    if (this.subPath) {
      if (db2.subcollections && db2.subcollections[this.subPath]) {
        item = db2.subcollections[this.subPath].find((i) => (i.id || i.email) === this.docId);
      }
    } else {
      const items = getCollectionItems(db2, this.colName);
      item = items.find((i) => (i.id || i.email || i.emailNormalized || i.accountId) === this.docId);
      if (!item && this.docId.includes("@")) {
        item = items.find((i) => (i.email || "").trim().toLowerCase() === this.docId.trim().toLowerCase());
      }
    }
    return {
      id: this.docId,
      exists: Boolean(item),
      data: () => item ? { ...item } : void 0,
      ref: {
        id: this.docId,
        delete: () => this.delete(),
        set: (d, o) => this.set(d, o),
        update: (d) => this.update(d)
      }
    };
  }
  async set(data, options) {
    const db2 = readLocalDb();
    const docData = { ...data, id: this.docId };
    if (this.subPath) {
      if (!db2.subcollections) db2.subcollections = {};
      if (!Array.isArray(db2.subcollections[this.subPath])) db2.subcollections[this.subPath] = [];
      const idx2 = db2.subcollections[this.subPath].findIndex((i) => (i.id || i.email) === this.docId);
      if (idx2 >= 0) {
        db2.subcollections[this.subPath][idx2] = options?.merge ? { ...db2.subcollections[this.subPath][idx2], ...docData } : docData;
      } else {
        db2.subcollections[this.subPath].push(docData);
      }
      writeLocalDb(db2);
      return;
    }
    const items = getCollectionItems(db2, this.colName);
    const idx = items.findIndex((i) => (i.id || i.email || i.emailNormalized || i.accountId) === this.docId);
    if (idx >= 0) {
      items[idx] = options?.merge ? { ...items[idx], ...docData } : docData;
    } else {
      items.push(docData);
    }
    setCollectionItems(db2, this.colName, items);
    writeLocalDb(db2);
  }
  async update(data) {
    return this.set(data, { merge: true });
  }
  async delete() {
    const db2 = readLocalDb();
    if (this.subPath) {
      if (db2.subcollections && db2.subcollections[this.subPath]) {
        db2.subcollections[this.subPath] = db2.subcollections[this.subPath].filter(
          (i) => (i.id || i.email) !== this.docId
        );
        writeLocalDb(db2);
      }
      return;
    }
    const items = getCollectionItems(db2, this.colName);
    const nextItems = items.filter((i) => (i.id || i.email || i.emailNormalized || i.accountId) !== this.docId);
    setCollectionItems(db2, this.colName, nextItems);
    writeLocalDb(db2);
  }
};
var MockCollectionRef = class {
  constructor(colName, subPath) {
    this.colName = colName;
    this.subPath = subPath;
  }
  doc(docId) {
    return new MockDocRef(this.colName, docId, this.subPath);
  }
  where(field, op, value) {
    return new MockQuery(this.colName, this.subPath).where(field, op, value);
  }
  orderBy(field, direction = "asc") {
    return new MockQuery(this.colName, this.subPath).orderBy(field, direction);
  }
  limit(count) {
    return new MockQuery(this.colName, this.subPath).limit(count);
  }
  async get() {
    return new MockQuery(this.colName, this.subPath).get();
  }
};
function createSafeAdminDb(realDb) {
  return {
    collection(colName) {
      if (!isFirebaseAdminAvailable || !realDb) {
        return new MockCollectionRef(colName);
      }
      try {
        return realDb.collection(colName);
      } catch (err) {
        return new MockCollectionRef(colName);
      }
    },
    batch() {
      if (isFirebaseAdminAvailable && realDb && typeof realDb.batch === "function") {
        try {
          return realDb.batch();
        } catch (e) {
        }
      }
      const ops = [];
      return {
        set(ref, data, options) {
          ops.push(() => ref?.set ? ref.set(data, options) : null);
          return this;
        },
        update(ref, data) {
          ops.push(() => ref?.update ? ref.update(data) : null);
          return this;
        },
        delete(ref) {
          ops.push(() => ref?.delete ? ref.delete() : null);
          return this;
        },
        async commit() {
          for (const op of ops) {
            try {
              await op();
            } catch (e) {
            }
          }
          return [];
        }
      };
    }
  };
}
function createSafeAdminAuth(realAuth) {
  return {
    async getUser(uid) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.getUser(uid);
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
            if (e?.code === "auth/user-not-found") throw e;
          }
        }
      }
      const db2 = readLocalDb();
      const user = db2.users?.find((u) => u.id === uid);
      if (user) {
        return {
          uid: user.id,
          email: user.email,
          displayName: user.name || user.ownerName || user.companyName || "Zakir User",
          emailVerified: Boolean(user.isEmailVerified)
        };
      }
      const err = new Error(`No user record found for the provided identifier: ${uid}`);
      err.code = "auth/user-not-found";
      throw err;
    },
    async getUserByEmail(email) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.getUserByEmail(email);
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
            if (e?.code === "auth/user-not-found") throw e;
          }
        }
      }
      const db2 = readLocalDb();
      const user = db2.users?.find((u) => (u.email || "").trim().toLowerCase() === (email || "").trim().toLowerCase());
      if (user) {
        return {
          uid: user.id,
          email: user.email,
          displayName: user.name || user.ownerName || user.companyName || "Zakir User",
          emailVerified: Boolean(user.isEmailVerified)
        };
      }
      const err = new Error(`No user record found for the provided email: ${email}`);
      err.code = "auth/user-not-found";
      throw err;
    },
    async createUser(props) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.createUser(props);
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      const db2 = readLocalDb();
      const uid = props.uid || `usr_${Date.now()}`;
      const newUser = {
        id: uid,
        email: props.email,
        name: props.displayName,
        isEmailVerified: props.emailVerified ?? false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!db2.users) db2.users = [];
      const idx = db2.users.findIndex((u) => (u.email || "").toLowerCase() === (props.email || "").toLowerCase());
      if (idx >= 0) db2.users[idx] = { ...db2.users[idx], ...newUser };
      else db2.users.push(newUser);
      writeLocalDb(db2);
      return { uid, email: props.email };
    },
    async updateUser(uid, props) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.updateUser(uid, props);
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      const db2 = readLocalDb();
      if (db2.users) {
        const idx = db2.users.findIndex((u) => u.id === uid || u.email && props.email && u.email.toLowerCase() === props.email.toLowerCase());
        if (idx >= 0) {
          db2.users[idx] = { ...db2.users[idx], ...props };
          writeLocalDb(db2);
        }
      }
      return { uid, ...props };
    },
    async deleteUser(uid) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          await realAuth.deleteUser(uid);
          return;
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
          }
        }
      }
      const db2 = readLocalDb();
      if (db2.users) {
        db2.users = db2.users.filter((u) => u.id !== uid);
        writeLocalDb(db2);
      }
    },
    async revokeRefreshTokens(uid) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          await realAuth.revokeRefreshTokens(uid);
        } catch (e) {
        }
      }
    },
    async createCustomToken(uid) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.createCustomToken(uid);
        } catch (e) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      return `custom_token_${uid}_${Date.now()}`;
    },
    async verifyIdToken(token) {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.verifyIdToken(token);
        } catch (e) {
        }
      }
      const db2 = readLocalDb();
      const user = db2.users?.find((u) => u.id === token || u.email === token);
      if (user) {
        return {
          uid: user.id,
          email: user.email,
          name: user.name || user.companyName,
          role: user.role
        };
      }
      throw new Error("Invalid or unverified token");
    }
  };
}
var adminDb = createSafeAdminDb(rawFirestore);
var adminAuth = createSafeAdminAuth(rawAuth);

// src/middleware/auth.ts
import fs2 from "fs";
import path2 from "path";
var DB_FILE2 = path2.join(process.cwd(), "src", "db_store.json");
function readDbForAuth() {
  try {
    if (fs2.existsSync(DB_FILE2)) {
      const content = fs2.readFileSync(DB_FILE2, "utf-8");
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
  }
  return { users: [] };
}
async function isUserAdminServer(uid) {
  if (!uid) return false;
  if ((process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test") && uid === "usr_ceo") {
    return true;
  }
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      const role = (userData?.role || "").toUpperCase();
      if (role === "CEO" || role === "ADMIN") return true;
    }
  } catch (err) {
  }
  try {
    const db2 = readDbForAuth();
    const localUser = db2.users?.find((u) => u.id === uid);
    if (localUser) {
      const role = (localUser.role || "").toUpperCase();
      return role === "CEO" || role === "ADMIN";
    }
  } catch (e) {
  }
  return false;
}
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token || token === "undefined" || token === "null" || token.trim() === "") {
    return res.status(401).json({ error: "Unauthorized: Empty or invalid authentication token string" });
  }
  if (process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test" || process.env.NODE_ENV !== "production") {
    if (token === "mock_token_admin" || token === "usr_ceo") {
      req.user = { uid: "usr_ceo", email: "mohamedvadel60@gmail.com" };
      return next();
    }
    if (token === "mock_token_compliance" || token === "usr_compliance") {
      req.user = { uid: "usr_compliance", email: "compliance@zakir.ai" };
      return next();
    }
    if (token === "mock_token_user_b" || token === "usr_b") {
      req.user = { uid: "usr_b", email: "user_b@zakir.ai" };
      return next();
    }
    if (token.startsWith("mock_token_") || token === "mock_token_user_a" || token === "usr_a") {
      req.user = { uid: "usr_a", email: "user_a@zakir.ai" };
      return next();
    }
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    try {
      const deletedDoc = await adminDb.collection("deletedUsers").doc(decodedToken.uid).get();
      if (deletedDoc && deletedDoc.exists) {
        return res.status(403).json({ error: "This account has been deleted. Please contact the administrator." });
      }
    } catch (dErr) {
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    if (process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test" || process.env.NODE_ENV !== "production") {
      try {
        const db2 = readDbForAuth();
        const foundUser = db2?.users?.find((u) => u.id === token);
        if (foundUser) {
          req.user = { uid: foundUser.id, email: foundUser.email };
          return next();
        }
      } catch (dbErr) {
      }
    }
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// src/middleware/rateLimiter.ts
var stores = {};
var createRateLimiter = (options) => {
  const { windowMs, max, message, endpointName } = options;
  if (!stores[endpointName]) {
    stores[endpointName] = {};
  }
  const store = stores[endpointName];
  return (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown-ip";
    const now = Date.now();
    const record = store[ip];
    if (!record) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs
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
        error: message || "Too many requests from this IP, please try again later.",
        cooldownRemainingSeconds: Math.ceil((record.resetTime - now) / 1e3)
      });
    }
    next();
  };
};

// server.ts
import { eq, desc } from "drizzle-orm";

// src/lib/worldBankFallback.ts
var COUNTRY_NAMES_MAP = {
  "MR": "Mauritania / \u0645\u0648\u0631\u064A\u062A\u0627\u0646\u064A\u0627",
  "EG": "Egypt / \u0645\u0635\u0631",
  "SA": "Saudi Arabia / \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
  "AE": "UAE / \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062A",
  "MA": "Morocco / \u0627\u0644\u0645\u063A\u0631\u0628",
  "DZ": "Algeria / \u0627\u0644\u062C\u0632\u0627\u0626\u0631",
  "TN": "Tunisia / \u062A\u0648\u0646\u0633",
  "LY": "Libya / \u0644\u064A\u0628\u064A\u0627",
  "SD": "Sudan / \u0627\u0644\u0633\u0648\u062F\u0627\u0646",
  "IQ": "Iraq / \u0627\u0644\u0639\u0631\u0627\u0642",
  "JO": "Jordan / \u0627\u0644\u0623\u0631\u062F\u0646",
  "LB": "Lebanon / \u0644\u0628\u0646\u0627\u0646",
  "OM": "Oman / \u0639\u064F\u0645\u0627\u0646",
  "QA": "Qatar / \u0642\u0637\u0631",
  "KW": "Kuwait / \u0627\u0644\u0643\u0648\u064A\u062A",
  "BH": "Bahrain / \u0627\u0644\u0628\u062D\u0631\u064A\u0646",
  "YE": "Yemen / \u0627\u0644\u064A\u0645\u0646",
  "PS": "Palestine / \u0641\u0644\u0633\u0637\u064A\u0646",
  "SY": "Syria / \u0633\u0648\u0631\u064A\u0627",
  "SO": "Somalia / \u0627\u0644\u0635\u0648\u0645\u0627\u0644",
  "DJ": "Djibouti / \u062C\u064A\u0628\u0648\u062A\u064A",
  "KM": "Comoros / \u062C\u0632\u0631 \u0627\u0644\u0642\u0645\u0631",
  "WLD": "World / \u0627\u0644\u0639\u0627\u0644\u0645"
};
var INDICATOR_NAMES_MAP = {
  "NY.GDP.MKTP.KD.ZG": "GDP Growth (Annual %)",
  "FP.CPI.TOTL.ZG": "Inflation, consumer prices (Annual %)",
  "SL.UEM.TOTL.ZS": "Unemployment rate (%)",
  "NY.GDP.PCAP.CD": "GDP per capita (Current US$)",
  "BX.KLT.DINV.WD.GD.ZS": "Foreign Direct Investment, net inflows (% of GDP)",
  "NE.EXP.GNFS.ZS": "Exports of goods and services (% of GDP)",
  "NE.IMP.GNFS.ZS": "Imports of goods and services (% of GDP)",
  "NE.GDI.TOTL.ZS": "Gross Capital Formation (% of GDP)",
  "BN.CAB.XOKA.GD.ZS": "Current Account Balance (% of GDP)",
  "GC.XPN.TOTL.GD.ZS": "Government Expenditure (% of GDP)",
  "NE.TRD.GNFS.ZS": "Trade (% of GDP)"
};
function generateWorldBankFallbackData(country, indicator, startYear = 2015, endYear = 2024) {
  const minY = Math.max(1960, Math.min(startYear, endYear));
  const maxY = Math.min(2025, Math.max(startYear, endYear));
  const fallbackYears = [];
  for (let y = minY; y <= maxY; y++) {
    fallbackYears.push(y);
  }
  const cName = COUNTRY_NAMES_MAP[country.toUpperCase()] || country;
  const indName = INDICATOR_NAMES_MAP[indicator] || "Macro Indicator";
  return fallbackYears.map((year) => {
    let baseVal = 0;
    if (indicator === "NY.GDP.MKTP.KD.ZG") {
      if (country === "MR") baseVal = year === 2020 ? -0.9 : year === 2022 ? 5.2 : year === 2023 ? 4.8 : 3.5;
      else if (country === "EG") baseVal = year === 2020 ? 3.6 : year === 2022 ? 6.6 : year === 2023 ? 3.8 : 4.2;
      else if (country === "SA") baseVal = year === 2020 ? -4.1 : year === 2022 ? 8.7 : year === 2023 ? -0.8 : 2.5;
      else if (country === "DZ") baseVal = year === 2020 ? -5.1 : year === 2022 ? 3.2 : year === 2023 ? 4.1 : 3.8;
      else if (country === "TN") baseVal = year === 2020 ? -8.6 : year === 2022 ? 2.6 : year === 2023 ? 0.4 : 1.9;
      else if (country === "LY") baseVal = year === 2020 ? -29.5 : year === 2021 ? 31.4 : year === 2023 ? 10.2 : 4.5;
      else baseVal = year === 2020 ? -3.1 : 3 + Math.sin(year) * 2;
    } else if (indicator === "FP.CPI.TOTL.ZG") {
      if (country === "MR") baseVal = year === 2022 ? 9.5 : year === 2023 ? 7.9 : 3.5 + Math.cos(year) * 1.5;
      else if (country === "EG") baseVal = year === 2022 ? 13.9 : year === 2023 ? 33.9 : 5 + Math.abs(Math.sin(year)) * 8;
      else if (country === "SA") baseVal = year === 2020 ? 3.4 : year === 2022 ? 2.5 : 1.5 + Math.sin(year) * 0.5;
      else if (country === "DZ") baseVal = year === 2022 ? 9.3 : year === 2023 ? 9.3 : 4.5 + Math.sin(year);
      else if (country === "TN") baseVal = year === 2022 ? 8.3 : year === 2023 ? 9.3 : 5.1 + Math.cos(year);
      else baseVal = 2 + Math.abs(Math.sin(year)) * 4;
    } else if (indicator === "SL.UEM.TOTL.ZS") {
      if (country === "MR") baseVal = 10.2 + Math.cos(year) * 0.4;
      else if (country === "EG") baseVal = 7.2 + Math.sin(year) * 0.8;
      else if (country === "SA") baseVal = 5.6 + Math.cos(year) * 1.1;
      else if (country === "DZ") baseVal = 11.8 + Math.sin(year) * 0.5;
      else if (country === "TN") baseVal = 15.3 + Math.cos(year) * 0.7;
      else baseVal = 6 + Math.sin(year) * 1;
    } else if (indicator === "BX.KLT.DINV.WD.GD.ZS") {
      baseVal = 2.1 + Math.sin(year * 0.8) * 1.4;
    } else if (indicator === "NE.EXP.GNFS.ZS") {
      baseVal = 32.5 + Math.cos(year * 0.5) * 8.2;
    } else if (indicator === "NE.IMP.GNFS.ZS") {
      baseVal = 38 + Math.sin(year * 0.5) * 6.5;
    } else if (indicator === "NE.GDI.TOTL.ZS") {
      baseVal = 24.5 + Math.sin(year) * 3.2;
    } else if (indicator === "BN.CAB.XOKA.GD.ZS") {
      baseVal = -2.5 + Math.cos(year) * 4.5;
    } else if (indicator === "GC.XPN.TOTL.GD.ZS") {
      baseVal = 28 + Math.sin(year) * 2.5;
    } else if (indicator === "NE.TRD.GNFS.ZS") {
      baseVal = 68.5 + Math.cos(year) * 12;
    } else {
      if (country === "MR") baseVal = 1800 + (year - 2015) * 85;
      else if (country === "EG") baseVal = 3500 + (year - 2015) * 120;
      else if (country === "SA") baseVal = 21e3 + (year - 2015) * 800;
      else if (country === "DZ") baseVal = 3900 + (year - 2015) * 110;
      else if (country === "TN") baseVal = 3700 + (year - 2015) * 90;
      else baseVal = 12e3 + (year - 2015) * 400;
    }
    return {
      year,
      value: parseFloat(baseVal.toFixed(2)),
      country: cName,
      indicatorName: indName
    };
  });
}
function getEnvVar(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return import.meta.env[key] || "";
    }
  } catch {
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || "";
  }
  return "";
}
var envBaseUrl = getEnvVar("VITE_API_BASE_URL") || getEnvVar("VITE_BACKEND_URL") || "";
var WORLD_BANK_API_BASE_URL = typeof process !== "undefined" && process.env?.NODE_ENV === "production" ? "" : envBaseUrl;

// server.ts
dotenv2.config();
var isServerless = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
var app = express();
var PORT = 3e3;
var DB_FILE3 = path3.join(process.cwd(), "src", "db_store.json");
function initializeDatabase() {
  if (fs3.existsSync(DB_FILE3)) {
    try {
      const data = JSON.parse(fs3.readFileSync(DB_FILE3, "utf-8"));
      if (data.users && data.memories && data.risk_alerts && data.user_metrics && data.gmail_logs && data.verification_codes && data.support_tickets) {
        return;
      }
    } catch (e) {
      console.error("Error reading database file, reinitializing", e);
    }
  }
  const initialData = {
    users: [
      {
        id: "usr_ceo",
        email: "ceo@zakir.ai",
        passwordHash: "ceo123",
        // Simple hash for demo auth
        companyName: "Al-Futtaim Group",
        role: "CEO",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: { status: "verified", verifiedAt: "2026-01-15T09:00:00Z" },
        createdAt: "2026-01-15T09:00:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        // 24hr trial
      },
      {
        id: "usr_analyst",
        email: "analyst@zakir.ai",
        passwordHash: "analyst123",
        companyName: "Al-Futtaim Group",
        role: "Analyst",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: { status: "verified", verifiedAt: "2026-02-10T11:30:00Z" },
        createdAt: "2026-02-10T11:30:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
      },
      {
        id: "usr_compliance",
        email: "compliance@zakir.ai",
        passwordHash: "compliance123",
        companyName: "Al-Futtaim Group",
        role: "Compliance Officer",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: { status: "verified", verifiedAt: "2026-03-01T14:15:00Z" },
        createdAt: "2026-03-01T14:15:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
      }
    ],
    verification_codes: [],
    support_tickets: [
      {
        id: "ticket_init_1",
        userId: "usr_ceo",
        userEmail: "ceo@zakir.ai",
        userName: "Mohamed Vadel",
        companyName: "Al-Futtaim Group",
        category: "Verification Issue",
        subject: "Verification document status confirmation",
        message: "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
        status: "In Progress",
        priority: "High",
        createdAt: "2026-07-28T10:00:00Z",
        updatedAt: "2026-07-28T11:30:00Z",
        messages: [
          {
            id: "msg_init_1",
            ticketId: "ticket_init_1",
            senderType: "user",
            senderName: "Mohamed Vadel",
            senderEmail: "ceo@zakir.ai",
            message: "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
            createdAt: "2026-07-28T10:00:00Z"
          },
          {
            id: "msg_init_2",
            ticketId: "ticket_init_1",
            senderType: "admin",
            senderName: "Zakir Compliance Team",
            senderEmail: "admin@zakir.ai",
            message: "Greetings Mohamed. We reviewed your documents and confirmed your institutional verification status as Verified. Thank you for using Zakir.",
            createdAt: "2026-07-28T11:30:00Z"
          }
        ]
      }
    ],
    memories: [
      {
        id: "mem_1",
        title: "Sanctions List Update Delay - Correspondent Banking",
        category: "Financial Engineering",
        riskLevel: "High",
        tags: ["sanctions", "compliance", "correspondent"],
        description: "Quarterly audit revealed a new sanctions list (OFAC SDN update, October 2024) had not been loaded into the screening system within the mandated 24-hour window.",
        decision: "The system operated for 72 hours using outdated lists, processing $340M in correspondent transactions.",
        causalFactors: "Standardized daily batch pull failed due to unannounced vendor API format changes. Compliance team had no automated alert.",
        outcomes: "An independent external warning was received, resulting in a retroactive review. Fortunately, no blocked entities were cleared, but regulatory friction increased.",
        lessonsLearned: "Implement real-time webhook endpoints instead of daily pull, and set up automatic health indicators for list freshness.",
        createdAt: "2026-06-02T10:30:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst"
      },
      {
        id: "mem_2",
        title: "USD/EUR Hedge Failure during Q3 Earnings",
        category: "FX Risk Management",
        riskLevel: "Critical",
        tags: ["hedging", "currency", "treasury"],
        description: "During Q3 2024, the multinational subsidiary faced a 12% adverse EUR/USD movement over 6 weeks. Our existing forward contracts covered only 40% of the exposure, leaving $18M unhedged.",
        decision: "Manually chose to restrict currency hedging based on speculative internal rate forecasts.",
        causalFactors: "Excessive operational trust in subjective qualitative advice over quantitative risk model suggestions.",
        outcomes: "Direct translation loss of $2.4M charged to earnings, triggering a covenant breach warning from our credit syndicate.",
        lessonsLearned: "Codify minimum mandatory hedging ranges (e.g. 70-90% for standard exposures) and automate rebalancing to eliminate human bias.",
        createdAt: "2026-05-18T16:00:00Z",
        userId: "usr_ceo",
        authorEmail: "ceo@zakir.ai",
        authorRole: "CEO"
      },
      {
        id: "mem_3",
        title: "Customs HS Code Misclassification - Industrial Components Import",
        category: "Customs Classification",
        riskLevel: "Medium",
        tags: ["customs", "tariffs", "supply-chain"],
        description: "Shipment of 2,400 units of precision hydraulic actuators was classified under HS 8412.21 (hydraulic power engines) instead of the correct 8412.39 (linear actuators).",
        decision: "Rushed the customs declaration process to avoid port storage demurrage charges.",
        causalFactors: "Absence of a shared centralized tariff code database, relying on individual broker interpretation.",
        outcomes: "Resulted in a retroactive tariff surcharge of 7.5% ($112,000) and triggered a systematic customs audit review on other parts.",
        lessonsLearned: "Establish a mandatory pre-cleared product-to-HS mapping library, and conduct annual external audits.",
        createdAt: "2026-04-20T09:15:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst"
      }
    ],
    risk_alerts: [
      {
        id: "al_1",
        title: "Sanctions List Update Delay: 6 Hours",
        category: "Financial Engineering",
        severity: "High",
        description: "OFAC SDN update failed to sync due to regional network bottleneck. Manual verification triggered.",
        status: "Active",
        createdAt: "2026-07-21T08:00:00Z"
      },
      {
        id: "al_2",
        title: "TP Documentation Deadline: 3 Jurisdictions Pending",
        category: "Financial Engineering",
        severity: "Medium",
        description: "Transfer pricing document compliance filing pending for Brazil, Singapore, Netherlands subsidiaries.",
        status: "Active",
        createdAt: "2026-07-20T10:00:00Z"
      },
      {
        id: "al_3",
        title: "Counterparty Concentration: Top 3 Banks >65%",
        category: "Financial Engineering",
        severity: "Critical",
        description: "Bilateral credit exposures show dangerous systemic concentration in three primary correspondent banks.",
        status: "Active",
        createdAt: "2026-07-19T14:30:00Z"
      },
      {
        id: "al_4",
        title: "FX Policy Review Overdue",
        category: "FX Risk Management",
        severity: "Medium",
        description: "FX hedging policy limits require annual board review and re-certification. Due 30 days ago.",
        status: "Active",
        createdAt: "2026-07-15T09:00:00Z"
      }
    ],
    user_metrics: [
      {
        id: "met_1",
        userId: "usr_analyst",
        actionType: "Log Memory",
        metricValue: 12,
        description: "Logged strategic causal memory on Sanctions Screening Gaps",
        createdAt: "2026-07-21T10:00:00Z"
      },
      {
        id: "met_2",
        userId: "usr_ceo",
        actionType: "Run Analysis",
        metricValue: 8,
        description: "Executed comprehensive risk-modeling analysis on FX hedger",
        createdAt: "2026-07-21T09:30:00Z"
      },
      {
        id: "met_3",
        userId: "usr_compliance",
        actionType: "Audit Review",
        metricValue: 15,
        description: "Resolved customs HS code compliance audit recommendations",
        createdAt: "2026-07-20T11:00:00Z"
      }
    ],
    gmail_logs: []
  };
  inMemoryDbStore = initialData;
  try {
    fs3.mkdirSync(path3.dirname(DB_FILE3), { recursive: true });
    fs3.writeFileSync(DB_FILE3, JSON.stringify(initialData, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: DB file initial write skipped (read-only filesystem environment):", err?.message);
  }
}
var inMemoryDbStore = null;
try {
  initializeDatabase();
} catch (e) {
  console.warn("Notice: initializeDatabase top-level call warning:", e);
}
function readDb() {
  try {
    if (fs3.existsSync(DB_FILE3)) {
      const content = fs3.readFileSync(DB_FILE3, "utf-8");
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        inMemoryDbStore = parsed;
        return parsed;
      }
    }
  } catch (err) {
  }
  if (!inMemoryDbStore) {
    try {
      initializeDatabase();
    } catch (e) {
    }
  }
  return inMemoryDbStore || { users: [], memories: [], risk_alerts: [], user_metrics: [], gmail_logs: [], verification_codes: [], support_tickets: [] };
}
function writeDb(data) {
  inMemoryDbStore = data;
  try {
    fs3.mkdirSync(path3.dirname(DB_FILE3), { recursive: true });
    fs3.writeFileSync(DB_FILE3, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: writeDb file save skipped (read-only filesystem environment):", err?.message);
  }
}
function getGeminiClient() {
  try {
    dotenv2.config();
  } catch (e) {
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error("GEMINI_API_KEY is not configured.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var stripeInstance = null;
function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.trim()) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey.trim(), {
      apiVersion: "2025-02-24.acacia"
    });
  }
  return stripeInstance;
}
var loginRegisterLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 5,
  message: "Too many login or registration attempts. Please try again after a minute.",
  endpointName: "login-register"
});
var otpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 3,
  message: "Too many OTP verification requests. Please try again after 5 minutes.",
  endpointName: "otp"
});
var emailLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  max: 5,
  message: "Too many email sending requests. Please try again after 10 minutes.",
  endpointName: "email"
});
var webhookLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 30,
  message: "Too many webhook requests.",
  endpointName: "webhooks"
});
var PLAN_PRICES = {
  Starter: { monthly: 6, annual: 50 },
  Professional: { monthly: 189, annual: 149 },
  Enterprise: { monthly: 849, annual: 699 }
};
app.post("/api/webhooks/resend", webhookLimiter, express.json(), (req, res) => {
  try {
    const event = req.body;
    if (!event) {
      return res.status(400).send("No body");
    }
    console.log("[RESEND WEBHOOK] Received event:", {
      type: event.type,
      messageId: event.data?.email_id || event.data?.id,
      recipient: event.data?.to?.[0] || event.data?.to,
      timestamp: event.created_at || (/* @__PURE__ */ new Date()).toISOString()
    });
    if (event.type === "email.bounced" || event.type === "email.delivery_delayed" || event.type === "email.complained") {
      console.warn("[RESEND EMAIL FAILURE] Delivery failed:", {
        messageId: event.data?.email_id,
        reason: event.data?.reason,
        recipient: event.data?.to?.[0]
      });
    } else if (event.type === "email.delivered") {
      console.log("[RESEND EMAIL DELIVERED] Delivery success:", {
        messageId: event.data?.email_id,
        recipient: event.data?.to?.[0]
      });
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[RESEND WEBHOOK] Error processing event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});
app.post(["/api/webhooks/stripe", "/api/stripe/webhook"], webhookLimiter, express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    if (stripe && webhookSecret) {
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        console.warn("[Stripe Webhook] Missing stripe-signature header.");
        return res.status(400).send("Webhook Error: Missing stripe-signature header.");
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log(`[Stripe Webhook] Event signature verified successfully: ${event.type} (id: ${event.id})`);
    } else {
      if (!webhookSecret) {
        console.warn("[Stripe Webhook] Warning: STRIPE_WEBHOOK_SECRET is not configured.");
      }
      if (process.env.NODE_ENV === "production") {
        console.error("Stripe Webhook Error: Signature verification is strictly required in production mode.");
        return res.status(400).send("Webhook Error: Signature verification required.");
      }
      const bodyStr = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
      event = JSON.parse(bodyStr || "{}");
      console.log(`[Stripe Webhook] Development fallback payload parsed: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan || "Professional";
        const cycle = session.metadata?.billingCycle || "annual";
        const userEmail = session.customer_details?.email || session.metadata?.userEmail;
        console.log(`[Stripe Webhook] checkout.session.completed: userId=${userId}, plan=${plan}, cycle=${cycle}, customer=${session.customer}`);
        const nextBill = /* @__PURE__ */ new Date();
        if (cycle === "annual") nextBill.setFullYear(nextBill.getFullYear() + 1);
        else nextBill.setMonth(nextBill.getMonth() + 1);
        const db2 = readDb();
        const user = db2.users.find((u) => u.id === userId || userEmail && u.email?.toLowerCase() === userEmail.toLowerCase());
        if (user) {
          user.subscriptionPlan = plan;
          user.subscriptionStatus = "Active";
          user.billingCycle = cycle;
          user.stripeCustomerId = session.customer;
          user.stripeSubscriptionId = session.subscription;
          user.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
          user.lastPaymentAmount = `$${((session.amount_total || 0) / 100).toFixed(2)} USD`;
          user.nextBillingDate = nextBill.toISOString();
          writeDb(db2);
        }
        const targetFsUid = user?.id || userId;
        if (targetFsUid) {
          try {
            await adminDb.collection("users").doc(targetFsUid).set({
              subscriptionPlan: plan,
              subscriptionStatus: "Active",
              billingCycle: cycle,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              lastPaymentDate: (/* @__PURE__ */ new Date()).toISOString(),
              lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
              nextBillingDate: nextBill.toISOString()
            }, { merge: true });
            console.log(`[Stripe Webhook] Firestore updated for user ${targetFsUid} -> Active (${plan})`);
          } catch (fsErr) {
            console.warn("Stripe webhook Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.created": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.created: id=${sub.id}, customer=${sub.customer}, status=${sub.status}`);
        const db2 = readDb();
        const user = db2.users.find((u) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          user.stripeSubscriptionId = sub.id;
          if (sub.status === "active" || sub.status === "trialing") {
            user.subscriptionStatus = "Active";
          }
          writeDb(db2);
          try {
            await adminDb.collection("users").doc(user.id).set({
              stripeSubscriptionId: sub.id,
              subscriptionStatus: user.subscriptionStatus
            }, { merge: true });
          } catch (fsErr) {
            console.warn("Stripe webhook sub create Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.updated: id=${sub.id}, status=${sub.status}`);
        const db2 = readDb();
        const user = db2.users.find((u) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          const isActive = sub.status === "active" || sub.status === "trialing";
          user.subscriptionStatus = isActive ? "Active" : sub.status === "past_due" ? "Past Due" : "Inactive";
          if (sub.current_period_end) {
            user.nextBillingDate = new Date(sub.current_period_end * 1e3).toISOString();
          }
          writeDb(db2);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: user.subscriptionStatus,
              nextBillingDate: user.nextBillingDate || null
            }, { merge: true });
          } catch (fsErr) {
            console.warn("Stripe webhook sub update Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.deleted: id=${sub.id}`);
        const db2 = readDb();
        const user = db2.users.find((u) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          user.subscriptionPlan = void 0;
          user.subscriptionStatus = "Inactive";
          writeDb(db2);
        }
        if (user?.id) {
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionPlan: null,
              subscriptionStatus: "Inactive"
            }, { merge: true });
            console.log(`[Stripe Webhook] Subscription marked Inactive for user ${user.id}`);
          } catch (fsErr) {
            console.warn("Stripe webhook Firestore sub delete warning:", fsErr?.message);
          }
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        console.log(`[Stripe Webhook] invoice payment succeeded: invoiceId=${invoice.id}, amount=${invoice.amount_paid}`);
        const db2 = readDb();
        const user = db2.users.find(
          (u) => subscriptionId && u.stripeSubscriptionId === subscriptionId || customerId && u.stripeCustomerId === customerId
        );
        if (user) {
          user.subscriptionStatus = "Active";
          user.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
          user.lastPaymentAmount = `$${((invoice.amount_paid || 0) / 100).toFixed(2)} USD`;
          writeDb(db2);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: "Active",
              lastPaymentDate: user.lastPaymentDate,
              lastPaymentAmount: user.lastPaymentAmount
            }, { merge: true });
          } catch (fsErr) {
            console.warn("Stripe webhook invoice Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn(`[Stripe Webhook] invoice payment failed: invoiceId=${invoice.id}, customer=${invoice.customer}`);
        const db2 = readDb();
        const user = db2.users.find((u) => u.stripeCustomerId === invoice.customer || invoice.subscription && u.stripeSubscriptionId === invoice.subscription);
        if (user) {
          user.subscriptionStatus = "Past Due";
          writeDb(db2);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: "Past Due"
            }, { merge: true });
          } catch (fsErr) {
          }
        }
        break;
      }
      default:
        console.log(`[Stripe Webhook] Received Stripe event: ${event.type}`);
    }
  } catch (handlerErr) {
    console.error("[Stripe Webhook] Error processing Stripe webhook event:", handlerErr);
  }
  res.json({ received: true });
});
var allowedOrigins = [
  "https://getzakir.com",
  "https://www.getzakir.com",
  "http://getzakir.com",
  "http://www.getzakir.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001"
];
var corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith(".getzakir.com") || origin.endsWith(".vercel.app") || origin.endsWith(".run.app")) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-goog-api-key",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Api-Key"
  ],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-goog-api-key, X-Requested-With, Accept, Origin, X-Api-Key");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
app.use(express.json({ limit: "500kb" }));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverless: isServerless });
});
var inFlightCheckoutUsers = /* @__PURE__ */ new Set();
app.get("/api/stripe/config", (req, res) => {
  const pubKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || "";
  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim());
  res.json({
    publishableKey: pubKey,
    hasSecretKey,
    mode: pubKey.startsWith("pk_test") ? "test" : "live"
  });
});
app.post("/api/stripe/create-checkout-session", requireAuth, async (req, res) => {
  const authUserId = req.user?.uid || req.user?.user_id;
  if (!authUserId) {
    return res.status(401).json({
      success: false,
      error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u0629 \u062D\u0633\u0627\u0628\u0643. \u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062C\u0644\u0633\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
  }
  if (inFlightCheckoutUsers.has(authUserId)) {
    return res.status(429).json({
      success: false,
      error: "\u062C\u0627\u0631\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u0633\u0627\u0628\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0636\u0639 \u062B\u0648\u0627\u0646\u064D."
    });
  }
  inFlightCheckoutUsers.add(authUserId);
  try {
    const { plan = "Professional", billingCycle = "annual", companyName } = req.body;
    const db2 = readDb();
    let user = db2.users.find((u) => u.id === authUserId);
    if (!user) {
      try {
        const userDoc = await adminDb.collection("users").doc(authUserId).get();
        if (userDoc && userDoc.exists) {
          user = userDoc.data();
        }
      } catch (fsErr) {
        console.warn("[CHECKOUT] Firestore user lookup warning:", fsErr);
      }
    }
    const finalUserId = authUserId;
    const finalUserEmail = req.user?.email || user?.email || "";
    const finalCompanyName = companyName || user?.companyName || user?.organizationName || "Organization";
    const requestedPlan = plan === "Enterprise" ? "Enterprise" : plan === "Starter" ? "Starter" : "Professional";
    const requestedCycle = billingCycle === "monthly" ? "monthly" : "annual";
    const host = req.headers.host || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const monthlyRate = PLAN_PRICES[requestedPlan][requestedCycle];
    const unitAmountCents = Math.round(monthlyRate * 100);
    console.log(`[Stripe Checkout] 1. Payment request received: plan=${requestedPlan}, cycle=${requestedCycle}, user=${finalUserId}`);
    const stripe = getStripe();
    if (!stripe) {
      console.warn("[Stripe Checkout] Stripe configuration missing: STRIPE_SECRET_KEY is not defined or invalid.");
      return res.status(400).json({
        success: false,
        error: "\u062E\u0627\u062F\u0645 \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 \u062D\u0627\u0644\u064A\u0627\u064B (STRIPE_SECRET_KEY \u0645\u0641\u0642\u0648\u062F). \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0646\u0638\u0627\u0645."
      });
    }
    if (user?.subscriptionStatus === "Active" && user?.stripeSubscriptionId) {
      try {
        const activeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (activeSub && (activeSub.status === "active" || activeSub.status === "trialing")) {
          console.warn(`[Stripe Checkout] User ${finalUserId} already has active subscription ${activeSub.id}`);
          return res.status(400).json({
            success: false,
            code: "SUBSCRIPTION_ALREADY_ACTIVE",
            error: "\u0644\u062F\u064A\u0643 \u0628\u0627\u0644\u0641\u0639\u0644 \u0627\u0634\u062A\u0631\u0627\u0643 \u0646\u0634\u0637 \u0641\u064A \u0645\u0646\u0635\u0629 Zakir. \u064A\u0645\u0643\u0646\u0643 \u0625\u062F\u0627\u0631\u0629 \u062E\u0637\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0623\u0648 \u062A\u0631\u0642\u064A\u062A\u0647\u0627 \u0645\u0646 \u0635\u0641\u062D\u0629 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A."
          });
        }
      } catch (subCheckErr) {
        console.warn("[Stripe Checkout] Active subscription check notice:", subCheckErr);
      }
    }
    let stripeCustomerId = user?.stripeCustomerId;
    if (stripeCustomerId) {
      try {
        const existingCust = await stripe.customers.retrieve(stripeCustomerId);
        if (existingCust && !("deleted" in existingCust && existingCust.deleted)) {
          console.log(`[Stripe Checkout] Found existing Stripe Customer: ${stripeCustomerId}`);
        } else {
          stripeCustomerId = null;
        }
      } catch {
        stripeCustomerId = null;
      }
    }
    if (!stripeCustomerId && finalUserEmail) {
      try {
        const newCust = await stripe.customers.create({
          email: finalUserEmail,
          name: finalCompanyName,
          metadata: {
            zakirUserId: finalUserId,
            userId: finalUserId
          }
        });
        stripeCustomerId = newCust.id;
        console.log(`[Stripe Checkout] Created new Stripe Customer: ${stripeCustomerId}`);
        if (user) {
          user.stripeCustomerId = stripeCustomerId;
          writeDb(db2);
        }
        try {
          await adminDb.collection("users").doc(finalUserId).set({ stripeCustomerId }, { merge: true });
        } catch (fsCustErr) {
          console.warn("[Stripe Checkout] Firestore customer id save notice:", fsCustErr);
        }
      } catch (createCustErr) {
        console.warn("[Stripe Checkout] Customer creation notice:", createCustErr?.message);
      }
    }
    let resolvedPriceId = null;
    const envPriceId = requestedCycle === "annual" ? process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID : process.env.STRIPE_MONTHLY_PRICE_ID;
    if (envPriceId && envPriceId.trim().startsWith("price_")) {
      try {
        const retrievedPrice = await stripe.prices.retrieve(envPriceId.trim());
        if (retrievedPrice && retrievedPrice.active && retrievedPrice.type === "recurring") {
          resolvedPriceId = retrievedPrice.id;
          console.log(`[Stripe Checkout] Using verified environment Price ID: ${resolvedPriceId}`);
        }
      } catch (priceCheckErr) {
        console.warn(`[Stripe Checkout] Environment price ID ${envPriceId} could not be retrieved from Stripe, falling back to dynamic price_data`);
      }
    }
    const lineItems = resolvedPriceId ? [{ price: resolvedPriceId, quantity: 1 }] : [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Zakir ${requestedPlan} Plan (${requestedCycle === "annual" ? "Annual Billing - Save 20%" : "Monthly Billing"})`,
          description: `Institutional Causal Memory Engine & Decision Intelligence Suite for ${finalCompanyName}.`
        },
        unit_amount: unitAmountCents,
        recurring: {
          interval: requestedCycle === "annual" ? "year" : "month",
          interval_count: 1
        }
      },
      quantity: 1
    }];
    const returnUrl = `${baseUrl}/?view=settings&tab=subscription&session_id={CHECKOUT_SESSION_ID}`;
    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: lineItems,
      client_reference_id: finalUserId,
      metadata: {
        userId: finalUserId,
        userEmail: finalUserEmail,
        companyName: finalCompanyName,
        plan: requestedPlan,
        billingCycle: requestedCycle
      },
      ui_mode: "embedded",
      return_url: returnUrl
    };
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else if (finalUserEmail) {
      sessionParams.customer_email = finalUserEmail;
    }
    console.log(`[Stripe Checkout] Creating Embedded Checkout Session for user ${finalUserId}...`);
    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[Stripe Checkout] Checkout Session created successfully: id=${session.id}`);
    db2.stripe_sessions = db2.stripe_sessions || {};
    db2.stripe_sessions[session.id] = finalUserId;
    writeDb(db2);
    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || "";
    return res.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey
    });
  } catch (err) {
    console.error("[Stripe Checkout] Error creating Stripe checkout session:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to initiate Stripe Checkout"
    });
  } finally {
    inFlightCheckoutUsers.delete(authUserId);
  }
});
app.get("/api/stripe/session-status/:sessionId", requireAuth, async (req, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }
    const { sessionId } = req.params;
    const stripe = getStripe();
    if (stripe && !sessionId.startsWith("cs_stripe_")) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const userId2 = session.client_reference_id || session.metadata?.userId;
      const plan = session.metadata?.plan || "Professional";
      const cycle = session.metadata?.billingCycle || "annual";
      if (userId2 && userId2 !== authUserId) {
        const isAdmin = await isUserAdminServer(authUserId);
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden: Access denied to other users' sessions" });
        }
      }
      if (session.status === "complete" || session.payment_status === "paid") {
        const nextBill = /* @__PURE__ */ new Date();
        if (cycle === "annual") nextBill.setFullYear(nextBill.getFullYear() + 1);
        else nextBill.setMonth(nextBill.getMonth() + 1);
        const db3 = readDb();
        const user2 = db3.users.find((u) => u.id === userId2 || session.customer_details?.email && u.email?.toLowerCase() === session.customer_details.email.toLowerCase());
        if (user2) {
          user2.subscriptionPlan = plan;
          user2.subscriptionStatus = "Active";
          user2.billingCycle = cycle;
          user2.stripeCustomerId = session.customer;
          user2.stripeSubscriptionId = session.subscription;
          user2.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString();
          user2.lastPaymentAmount = `$${((session.amount_total || 0) / 100).toFixed(2)} USD`;
          user2.nextBillingDate = nextBill.toISOString();
          writeDb(db3);
        }
        if (userId2 || user2?.id) {
          const targetUid = userId2 || user2?.id;
          try {
            await adminDb.collection("users").doc(targetUid).set({
              subscriptionPlan: plan,
              subscriptionStatus: "Active",
              billingCycle: cycle,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              lastPaymentDate: (/* @__PURE__ */ new Date()).toISOString(),
              lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
              nextBillingDate: nextBill.toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn("Firestore status update error:", e.message);
          }
        }
        return res.json({
          status: session.status,
          paymentStatus: session.payment_status,
          customerEmail: session.customer_details?.email,
          plan,
          billingCycle: cycle,
          amountTotal: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
          nextBillingDate: nextBill.toISOString()
        });
      }
      return res.json({
        status: session.status,
        paymentStatus: session.payment_status
      });
    }
    const db2 = readDb();
    const userId = db2.stripe_sessions?.[sessionId];
    if (userId && userId !== authUserId) {
      const isAdmin = await isUserAdminServer(authUserId);
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Access denied to other users' sessions" });
      }
    }
    const user = db2.users.find((u) => u.id === userId);
    return res.json({
      status: "complete",
      paymentStatus: "paid",
      customerEmail: user?.email || "subscriber@zakir.ai",
      plan: user?.subscriptionPlan || "Professional",
      billingCycle: user?.billingCycle || "annual",
      amountTotal: user?.lastPaymentAmount || "$149.00 USD",
      nextBillingDate: user?.nextBillingDate || new Date(Date.now() + 365 * 864e5).toISOString()
    });
  } catch (err) {
    console.error("Error retrieving Stripe session status:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve session status" });
  }
});
app.post("/api/stripe/create-portal-session", requireAuth, async (req, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }
    const host = req.headers.host || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const db2 = readDb();
    const user = db2.users.find((u) => u.id === authUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found in database." });
    }
    const stripeCustomerId = user.stripeCustomerId;
    const stripe = getStripe();
    if (stripe && stripeCustomerId) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${baseUrl}/?view=settings&tab=subscription`
      });
      return res.json({ url: portalSession.url });
    }
    return res.json({ url: `${baseUrl}/?view=settings&tab=subscription` });
  } catch (err) {
    console.error("Error creating portal session:", err);
    res.status(500).json({ error: err.message || "Failed to create portal session" });
  }
});
app.post("/api/stripe/cancel-subscription", requireAuth, async (req, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const db2 = readDb();
    const user = db2.users.find((u) => u.id === authUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const stripe = getStripe();
    if (stripe && user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (stripeErr) {
        console.warn("Stripe cancel subscription warning:", stripeErr.message);
      }
    }
    user.subscriptionStatus = "Inactive";
    user.subscriptionPlan = void 0;
    writeDb(db2);
    try {
      await adminDb.collection("users").doc(authUserId).set({
        subscriptionStatus: "Inactive",
        subscriptionPlan: null
      }, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore cancel sync warning:", fsErr.message);
    }
    return res.json({ success: true, message: "Subscription cancelled successfully." });
  } catch (err) {
    console.error("Error cancelling subscription:", err);
    res.status(500).json({ error: err.message || "Failed to cancel subscription" });
  }
});
app.get(["/.well-known/stripe-verification", "/.well-known/stripe-verification.txt", "/stripe-verification"], (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send("stripe-verification=61271845aaa858f327634c112c5688e9b33281a0e192865affdd7552e0c4f3fa");
});
var OFFICIAL_ZAKIR_SVG = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1021.12 909.1">
  <defs>
    <linearGradient id="zakir-linear-gradient" x1="17.47" y1="447.63" x2="984.67" y2="463.31" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0db4d7"/>
      <stop offset="1" stop-color="#f3ba1a"/>
    </linearGradient>
  </defs>
  <path fill="none" stroke="url(#zakir-linear-gradient)" stroke-miterlimit="10" stroke-width="24px" d="M29.34,52.28c31.34-15.36,81.1-34.89,144.33-39.36,52.91-3.74,92.65,4.66,131.21,13.12,103.52,22.71,126.62,52.27,223.06,78.73,21.03,5.77,84.52,22.08,157.27,23.87,54.83,1.35,156.21-4.54,278.55-64.64,2.95-1.45,5.96,1.81,4.22,4.59-30.56,48.88-72.27,112.6-124.84,184.84-57.49,79.01-119.41,164.11-210.24,258.08-96.56,99.9-182.39,188.7-321.46,255.86-156.74,75.69-235.92,95.04-255.86,78.73-1.84-1.51-7.17-5.87-7.04-11.54.44-18.52,58.67-30.96,79.81-35.47,101.41-21.66,336.99,62.08,445.49,86.37h0c87.97,17.84,220.98,23.62,400.19-45.92"/>
  <g>
    <circle fill="#0db4d7" cx="41" cy="50.41" r="41"/>
    <circle fill="#f3ba1a" cx="555.16" cy="586.73" r="52.48"/>
    <circle fill="#0db4d7" cx="975.2" cy="836.03" r="45.92"/>
  </g>
</svg>`;
var officialPngLogoCache = null;
function getOfficialPngLogo() {
  if (officialPngLogoCache && officialPngLogoCache.length > 0) {
    return officialPngLogoCache;
  }
  const pngPath = path3.join(process.cwd(), "src", "assets", "zakir-official-logo.png");
  if (fs3.existsSync(pngPath)) {
    try {
      officialPngLogoCache = fs3.readFileSync(pngPath);
      return officialPngLogoCache;
    } catch (e) {
    }
  }
  const publicPng = path3.join(process.cwd(), "public", "zakir-official-logo.png");
  if (fs3.existsSync(publicPng)) {
    try {
      officialPngLogoCache = fs3.readFileSync(publicPng);
      return officialPngLogoCache;
    } catch (e) {
    }
  }
  return Buffer.alloc(0);
}
function getAppBaseUrl(req) {
  if (process.env.APP_URL && !process.env.APP_URL.includes("localhost") && !process.env.APP_URL.includes("127.0.0.1") && !process.env.APP_URL.includes("run.app")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (req && req.headers && req.headers.host && !req.headers.host.includes("run.app") && !req.headers.host.includes("localhost")) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    return `${proto}://${req.headers.host}`.replace(/\/$/, "");
  }
  return "https://www.getzakir.com";
}
app.get(["/api/logo.png", "/assets/logo.png", "/logo.png"], (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const buf = getOfficialPngLogo();
  res.send(buf);
});
app.get(["/api/logo.svg", "/assets/logo.svg", "/logo.svg"], (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(OFFICIAL_ZAKIR_SVG);
});
app.get("/api/stripe/receipt/:sessionId", requireAuth, async (req, res) => {
  const { sessionId } = req.params;
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const db2 = readDb();
  const sessionOwnerId = db2.stripe_sessions?.[sessionId];
  const isCallerAdmin = await isUserAdminServer(authUserId);
  if (sessionOwnerId && sessionOwnerId !== authUserId && !isCallerAdmin) {
    return res.status(403).json({ error: "Forbidden: You do not own this checkout session." });
  }
  let user = db2.users.find((u) => u.id === authUserId);
  if (isCallerAdmin && sessionOwnerId) {
    const targetUser = db2.users.find((u) => u.id === sessionOwnerId);
    if (targetUser) {
      user = targetUser;
    }
  }
  if (!user) {
    return res.status(404).json({ error: "User profile not found." });
  }
  const plan = req.query.plan || user.subscriptionPlan || "Professional";
  const cycle = req.query.cycle || user.billingCycle || "annual";
  const price = PLAN_PRICES[plan]?.[cycle] || 149;
  const receipt = {
    receiptNumber: `STRIPE-INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${sessionId.slice(-6).toUpperCase()}`,
    invoiceNo: `STRIPE-INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${sessionId.slice(-6).toUpperCase()}`,
    sessionId,
    planName: plan,
    plan,
    billingCycle: cycle,
    amountPaid: `$${price}.00 USD`,
    amount: `$${price}.00 USD`,
    status: "Paid & Verified",
    currency: "USD",
    paymentMethod: "Stripe Checkout (Visa / MasterCard / AMEX)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    customerEmail: user.email || "mohamedvadel60@gmail.com",
    customerName: user.companyName || user.ownerName || "Organization",
    companyName: user.companyName || "Organization",
    stripeReceiptUrl: `https://pay.stripe.com/receipts/invoices/${sessionId}`
  };
  res.json({ receipt });
});
var getResendInstance = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === "undefined") {
    return null;
  }
  return new Resend(apiKey.trim());
};
async function sendSystemMail(toOrOptions, subjectArg, textArg, htmlArg) {
  let to;
  let subject;
  let html;
  let text2;
  let userAttachments = [];
  if (typeof toOrOptions === "string") {
    to = toOrOptions;
    subject = subjectArg || "";
    const arg3 = textArg || "";
    const arg4 = htmlArg || "";
    if (arg3.includes("<!DOCTYPE") || arg3.includes("<html") || arg3.includes("<table") || arg3.includes("<div")) {
      html = arg3;
      text2 = arg4;
    } else if (arg4.includes("<!DOCTYPE") || arg4.includes("<html") || arg4.includes("<table") || arg4.includes("<div")) {
      html = arg4;
      text2 = arg3;
    } else {
      text2 = arg3;
      html = arg4;
    }
  } else if (toOrOptions && typeof toOrOptions === "object") {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
    text2 = toOrOptions.text || "";
    userAttachments = toOrOptions.attachments || [];
  } else {
    to = "";
    subject = "";
    html = "";
    text2 = "";
  }
  let fromSender = (process.env.RESEND_FROM || process.env.EMAIL_FROM || "").trim();
  if (!fromSender || fromSender.includes("yourdomain.com") || fromSender.includes("example.com")) {
    fromSender = "Zakir Platform <onboarding@resend.dev>";
  } else if (!fromSender.includes("<")) {
    fromSender = `Zakir Platform <${fromSender}>`;
  }
  try {
    const resend = getResendInstance();
    if (!resend) {
      console.warn(`[EMAIL DISPATCH NOTICE] RESEND_API_KEY is not configured. Simulating delivery for: ${to} | Subject: "${subject}"`);
      return {
        success: true,
        simulated: true,
        provider: "local_simulation",
        messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
      };
    }
    console.log(`[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${fromSender}`);
    const attachments = [...userAttachments];
    const emailPayload = {
      from: fromSender,
      to: [to],
      subject,
      html,
      text: text2 || void 0
    };
    if (attachments.length > 0) {
      emailPayload.attachments = attachments.map((att) => {
        const mapped = {
          filename: att.filename || "attachment.png"
        };
        if (att.content !== void 0) {
          mapped.content = att.content;
        }
        if (att.path) {
          mapped.path = att.path;
        }
        const cid = att.contentId || att.content_id || att.cid;
        if (cid) {
          mapped.contentId = cid;
        }
        if (att.contentType) {
          mapped.contentType = att.contentType;
        }
        return mapped;
      });
    }
    const response = await resend.emails.send(emailPayload);
    if (response.error) {
      const errStatus = response.error.statusCode || response.error.status || 400;
      console.error("[EMAIL DELIVERY FAILURE]", {
        code: response.error.name || "RESEND_ERROR",
        message: response.error.message,
        provider: "Resend",
        httpStatus: errStatus
      });
      return {
        success: false,
        error: response.error,
        statusCode: errStatus,
        userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
      };
    }
    if (response.data && response.data.id) {
      console.log(`[EMAIL SENT SUCCESS] ID: ${response.data.id} to ${to} via ${fromSender}`);
      return {
        success: true,
        messageId: response.data.id,
        statusCode: 200,
        provider: "resend"
      };
    }
    return {
      success: false,
      error: new Error("No message ID returned from Resend"),
      statusCode: 500,
      userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    };
  } catch (resendErr) {
    const errStatus = resendErr?.statusCode || resendErr?.status || 500;
    console.error("[EMAIL DELIVERY EXCEPTION]", {
      code: resendErr?.code || resendErr?.name || "UNKNOWN",
      message: resendErr?.message || String(resendErr),
      provider: "Resend",
      httpStatus: errStatus
    });
    return {
      success: false,
      error: resendErr,
      statusCode: errStatus,
      userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    };
  }
}
function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}
function maskEmail(email) {
  if (!email || typeof email !== "string") return "u***@example.com";
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return "***@***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : name.length === 2 ? `${name[0]}*` : "*";
  return `${maskedName}@${domain}`;
}
function cleanUserName(rawName, email) {
  if (!rawName) return "";
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const forbidden = [
    "zakir user",
    "zakiruser",
    "user",
    "dear zakir user",
    "hello zakir user",
    "unknown user",
    "unknown",
    "undefined",
    "null",
    "none",
    "n/a",
    "[user name]",
    "user name",
    "owner",
    "customer",
    "client",
    "admin"
  ];
  if (forbidden.includes(lower)) {
    return "";
  }
  if (email && lower === email.trim().toLowerCase()) {
    return "";
  }
  return trimmed;
}
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function buildMasterEmailHtml(options) {
  const { subject, title, greeting, bodyHtml, securityNote } = options;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Master Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
          
          <!-- Primary Accent Line -->
          <tr>
            <td style="background-color: #2563EB; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="https://getzakir.com/api/logo.png" alt="Zakir" width="48" height="48" style="display: block; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>
              <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 1.5px; margin-top: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Zakir
              </div>
              <div style="font-size: 12px; font-weight: 500; color: #64748b; margin-top: 4px;">
                Organizational Causal Memory &amp; Decision Intelligence
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px; text-align: left;">
              <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>
              ${greeting ? `<p style="color: #0f172a; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">${escapeHtml(greeting)}</p>` : ""}
              ${bodyHtml}
              ${securityNote ? `
              <div style="margin-top: 28px; padding: 14px 16px; background-color: #eff6ff; border-left: 3px solid #2563eb; border-radius: 4px;">
                <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
                  <strong>Security note:</strong> ${escapeHtml(securityNote)}
                </p>
              </div>
              ` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Zakir</p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">Organizational Causal Memory &amp; Decision Intelligence</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">This is an automated message from Zakir. Please do not reply to this email.</p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Zakir. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function buildOtpEmailHtml(options) {
  const { email, userName, otpCode, type = "account_registration" } = options;
  const cleanName = cleanUserName(userName, email);
  const appBaseUrl = options.baseUrl || getAppBaseUrl();
  const isReset = type === "password_reset";
  const isLink = type === "email_link";
  const isRecovery = type === "account_recovery";
  const isWelcome = type === "welcome";
  const cleanCode = otpCode ? otpCode.trim() : "";
  let subject = "Verify your Zakir email";
  let title = "Verify your email";
  let introText = "Use the verification code below to complete your registration and activate your account:";
  let securityNote = "For your security, never share this code with anyone. The Zakir team will never ask for your verification code.";
  if (isReset) {
    subject = "Reset your Zakir password";
    title = "Reset your Zakir password";
    introText = "A password reset request was made for your Zakir account. Use the verification code below to set a new password:";
    securityNote = "If you did not request a password reset, no action is required.";
  } else if (isLink) {
    subject = "Your Zakir security code";
    title = "Verify your email";
    introText = "We received a request to link this email account to your Zakir profile. Use the security code below to complete the verification:";
    securityNote = "If you did not request this verification code, no action is required.";
  } else if (isRecovery) {
    subject = "Recover your Zakir account";
    title = "Recover your Zakir account";
    introText = "A request was initiated to recover your Zakir account and restore your workspace data. Use the verification code below to continue:";
    securityNote = "If you did not request this recovery, you can safely ignore this email.";
  } else if (isWelcome) {
    subject = "Welcome to Zakir";
    title = "Welcome to Zakir";
    introText = "Welcome to Zakir \u2014 Organizational Causal Memory & Decision Intelligence. Your workspace is ready.";
    securityNote = "Keep your account details safe and secure.";
  }
  const greeting = cleanName ? `Hello ${cleanName},` : `Hello,`;
  let bodyHtml = "";
  if (isWelcome) {
    bodyHtml = `
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        ${escapeHtml(introText)}
      </p>
      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
        <tr>
          <td align="center" bgcolor="#2563eb" style="border-radius: 10px;">
            <a href="${appBaseUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #2563eb; border: 1px solid #2563eb;">
              Open Zakir
            </a>
          </td>
        </tr>
      </table>
    `;
  } else {
    bodyHtml = `
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        ${escapeHtml(introText)}
      </p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 20px 24px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px;">
            <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace, -apple-system, sans-serif; font-size: 32px; font-weight: 800; color: #1d4ed8; letter-spacing: 6px; text-align: center; margin: 0; user-select: all; -webkit-user-select: all;">
              ${escapeHtml(cleanCode)}
            </div>
          </td>
        </tr>
      </table>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        This code expires in <strong>10 minutes</strong>.
      </p>
    `;
  }
  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote
  });
  const textBody = isWelcome ? `${greeting}

${introText}

Open Zakir: ${appBaseUrl}

The Zakir Team` : `${greeting}

${introText}

[ ${cleanCode} ]

This code expires in 10 minutes.

Security note: ${securityNote}

The Zakir Team`;
  return { subject, text: textBody, html };
}
function buildInvitationEmailHtml(options) {
  const { companyName, memberName, inviterName, designatedRole, inviteLink, isReminder } = options;
  const subject = `You're invited to Zakir`;
  const title = `You've been invited to Zakir`;
  const greeting = memberName ? `Hello ${memberName},` : `Hello,`;
  const introText = isReminder ? `This is a reminder that ${inviterName} has invited you to join ${companyName} on Zakir as a ${designatedRole}.` : `${inviterName} has invited you to join ${companyName} on Zakir as a ${designatedRole}.`;
  const detailsHtml = `
    <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 120px; font-weight: 500;">Organization:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Invited by:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${escapeHtml(inviterName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Assigned Role:</td>
          <td style="padding: 6px 0;"><span style="display: inline-block; padding: 2px 8px; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; border-radius: 4px;">${escapeHtml(designatedRole)}</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Expires:</td>
          <td style="padding: 6px 0; font-weight: 500; color: #64748b;">7 days</td>
        </tr>
      </table>
    </div>
  `;
  const ctaButtonHtml = `
    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 20px auto;">
      <tr>
        <td align="center" bgcolor="#2563eb" style="border-radius: 10px;">
          <a href="${inviteLink}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #2563eb; border: 1px solid #2563eb;">
            Accept invitation
          </a>
        </td>
      </tr>
    </table>
    <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center; word-break: break-all;">
      If the button above does not work, copy and paste this URL into your browser:<br/>
      <a href="${inviteLink}" style="color: #2563eb; text-decoration: underline;">${inviteLink}</a>
    </p>
  `;
  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      ${escapeHtml(introText)}
    </p>
    ${detailsHtml}
    ${ctaButtonHtml}
  `;
  const securityNote = "If you were not expecting this invitation, you can safely ignore this email.";
  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote
  });
  const text2 = `${greeting}

${introText}

Organization: ${companyName}
Invited by: ${inviterName}
Role: ${designatedRole}

Accept invitation: ${inviteLink}

This invitation expires in 7 days.`;
  return { subject, text: text2, html };
}
function buildSupportReplyEmailHtml(options) {
  const { recipientName, ticketId, ticketSubject, message } = options;
  const subject = `Zakir Support: ${ticketSubject}`;
  const title = "Support Ticket Reply";
  const greeting = recipientName ? `Hello ${recipientName},` : `Hello,`;
  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Our support team has replied to your request.
    </p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px;">
      <p style="margin: 0; font-weight: 700; color: #1d4ed8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket #${escapeHtml(ticketId)}</p>
      <p style="margin: 4px 0 0 0; font-weight: 700; color: #0f172a; font-size: 15px;">${escapeHtml(ticketSubject)}</p>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Latest Response from Support:</p>
      <p style="margin: 0; color: #0f172a; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
    </div>

    <p style="margin-bottom: 0; color: #475569; font-size: 14px;">
      Open your Zakir account to view the response and continue the conversation.
    </p>
  `;
  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml
  });
  const text2 = `${greeting}

Our support team has replied to your request.

Ticket #${ticketId}: ${ticketSubject}

Response:
${message}

Open your Zakir account to view the response and continue the conversation.`;
  return { subject, text: text2, html };
}
function buildRecoveryApprovalEmailHtml(options) {
  const { userName, email } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Approved - Zakir";
  const title = "Your Account Recovery Has Been Approved";
  const greeting = cleanName ? `Hello ${cleanName},` : "Hello,";
  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      We are pleased to inform you that your account recovery request has been reviewed and <strong>approved</strong> by our administration team.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 700;">
        Next Step: Complete Verification
      </p>
      <p style="margin: 8px 0 0 0; color: #1d4ed8; font-size: 13px; line-height: 1.5;">
        Please return to the Zakir application and click "Verify &amp; Restore Account" to receive your final single-use verification code and reactivate your workspace.
      </p>
    </div>
  `;
  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "For security, complete your restoration within 72 hours."
  });
  const text2 = `${greeting}

Your account recovery request has been approved by our administration team.

Please return to Zakir to complete verification and restore your workspace.

The Zakir Team`;
  return { subject, text: text2, html };
}
function buildRecoveryRejectionEmailHtml(options) {
  const { userName, email, rejectionReason } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Update - Zakir";
  const title = "Account Recovery Request Decision";
  const greeting = cleanName ? `Hello ${cleanName},` : "Hello,";
  const reasonText = rejectionReason || "Identity details or documentation provided could not be verified against system records.";
  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Your request for account recovery has been reviewed by our administration team. Regrettably, your request could not be approved at this time.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;">
      <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
        Reason for Decision
      </p>
      <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">
        ${escapeHtml(reasonText)}
      </p>
    </div>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">
      If you believe this is an error or have additional identity documents, you may submit a new recovery request or contact support.
    </p>
  `;
  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "Account security is our highest priority."
  });
  const text2 = `${greeting}

Your account recovery request could not be approved at this time.

Reason: ${reasonText}

The Zakir Team`;
  return { subject, text: text2, html };
}
async function resolveUserByEmailOrId(params) {
  const inputUserId = (params.userId || "").trim();
  const rawEmail = (params.email || "").trim();
  const normalizedEmail = rawEmail.toLowerCase();
  const inputPhone = (params.phone || "").trim();
  if (inputUserId) {
    try {
      const uDoc = await adminDb.collection("users").doc(inputUserId).get();
      if (uDoc.exists) {
        const data = uDoc.data() || {};
        const resEmail = (data.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: true,
          resolvedUserId: uDoc.id,
          source: "firestore_doc_id"
        });
        return {
          userId: uDoc.id,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_doc_id"
        };
      }
    } catch (err) {
      console.warn("Firestore lookup by userId failed:", err);
    }
    try {
      const authUser = await adminAuth.getUser(inputUserId);
      if (authUser) {
        const resEmail = (authUser.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: authUser.uid,
          source: "firebase_auth_uid"
        });
        return {
          userId: authUser.uid,
          email: resEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: null,
          source: "firebase_auth_uid"
        };
      }
    } catch (err) {
    }
    try {
      const db2 = readDb();
      const localUser = db2.users?.find((u) => u.id === inputUserId);
      if (localUser) {
        const resEmail = (localUser.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_id"
        });
        return {
          userId: localUser.id,
          email: resEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_id"
        };
      }
    } catch (err) {
    }
  }
  if (normalizedEmail) {
    try {
      const authUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (authUser && authUser.uid) {
        let firestoreData = null;
        try {
          const uDoc = await adminDb.collection("users").doc(authUser.uid).get();
          if (uDoc.exists) {
            firestoreData = uDoc.data();
          }
        } catch (e) {
        }
        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(firestoreData),
          resolvedUserId: authUser.uid,
          source: "firebase_auth_email"
        });
        return {
          userId: authUser.uid,
          email: authUser.email ? authUser.email.trim().toLowerCase() : normalizedEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: firestoreData,
          source: "firebase_auth_email"
        };
      }
    } catch (err) {
    }
    try {
      let uSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (uSnap.empty && rawEmail && rawEmail !== normalizedEmail) {
        uSnap = await adminDb.collection("users").where("email", "==", rawEmail).limit(1).get();
      }
      if (!uSnap.empty) {
        const docSnap = uSnap.docs[0];
        const data = docSnap.data() || {};
        const resUserId = data.id || docSnap.id;
        const resEmail = (data.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: true,
          resolvedUserId: resUserId,
          source: "firestore_email_query"
        });
        return {
          userId: resUserId,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_email_query"
        };
      }
    } catch (err) {
      console.warn("Firestore query by email failed:", err);
    }
    try {
      const db2 = readDb();
      const localUser = db2.users?.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);
      if (localUser && localUser.id) {
        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_email"
        });
        return {
          userId: localUser.id,
          email: normalizedEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_email"
        };
      }
    } catch (err) {
    }
    try {
      const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
      if (lifecycleRecord && lifecycleRecord.originalUserId) {
        let retainedData = null;
        try {
          const retSnap = await adminDb.collection("users_retained").doc(lifecycleRecord.originalUserId).get();
          if (retSnap.exists) {
            retainedData = retSnap.data();
          }
        } catch (e) {
        }
        if (!retainedData) {
          const db2 = readDb();
          retainedData = db2.retained_users?.find((u) => u.id === lifecycleRecord.originalUserId || u.email?.toLowerCase() === normalizedEmail);
        }
        console.info("OTP USER RESOLUTION (RETAINED LIFECYCLE)", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(retainedData),
          resolvedUserId: lifecycleRecord.originalUserId,
          source: "account_lifecycle_retained"
        });
        return {
          userId: lifecycleRecord.originalUserId,
          email: normalizedEmail,
          phone: retainedData?.phone || inputPhone,
          userDoc: retainedData || { email: normalizedEmail, role: "CEO" },
          source: "account_lifecycle_retained"
        };
      }
    } catch (lcErr) {
    }
  }
  if (inputPhone) {
    try {
      const uSnap = await adminDb.collection("users").where("phone", "==", inputPhone).limit(1).get();
      if (!uSnap.empty) {
        const docSnap = uSnap.docs[0];
        const data = docSnap.data() || {};
        const resUserId = data.id || docSnap.id;
        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail || data.email,
          firestoreUserFound: true,
          resolvedUserId: resUserId,
          source: "firestore_phone_query"
        });
        return {
          userId: resUserId,
          email: (data.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: data,
          source: "firestore_phone_query"
        };
      }
    } catch (err) {
    }
    try {
      const db2 = readDb();
      const localUser = db2.users?.find((u) => u.phone === inputPhone);
      if (localUser && localUser.id) {
        console.info("OTP USER RESOLUTION", {
          email: localUser.email || normalizedEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_phone"
        });
        return {
          userId: localUser.id,
          email: (localUser.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: localUser,
          source: "local_db_phone"
        };
      }
    } catch (err) {
    }
  }
  console.info("OTP USER RESOLUTION", {
    email: normalizedEmail || inputPhone || null,
    firestoreUserFound: false,
    resolvedUserId: null,
    source: "not_found"
  });
  return {
    userId: null,
    email: normalizedEmail || null,
    phone: inputPhone || null,
    userDoc: null,
    source: "not_found"
  };
}
app.post("/api/auth/send-verification-code", otpLimiter, async (req, res) => {
  const isRecovery = req.body.type === "account_recovery";
  const recoveryRequestId = isRecovery ? `RECOVERY-${crypto.randomBytes(4).toString("hex").toUpperCase()}` : null;
  try {
    const { email, phone, type = "account_registration", userId } = req.body;
    if (!email && !phone && !userId) {
      if (isRecovery) {
        console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "input_validation", error: "Missing email/phone/userId")`);
      }
      return res.status(400).json({ error: "Email, phone, or userId is required" });
    }
    if (isRecovery) {
      console.log(`[RECOVERY] request received (id: ${recoveryRequestId}, type: ${type})`);
    }
    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier = resolvedUser.email || (email || phone || "").trim().toLowerCase();
    let foundUid = resolvedUser.userId;
    let lifecycleRecord = null;
    if (isRecovery && targetIdentifier) {
      lifecycleRecord = await getAccountLifecycleRecord(targetIdentifier);
      if (lifecycleRecord) {
        console.log(`[RECOVERY] deleted account found (id: ${recoveryRequestId}, userId: ${lifecycleRecord.originalUserId || foundUid || "known"}, status: ${lifecycleRecord.status})`);
        if (lifecycleRecord.status === "PURGED" || lifecycleRecord.restoreUntil && Date.now() > new Date(lifecycleRecord.restoreUntil).getTime()) {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "RESTORE_EXPIRED")`);
          return res.status(400).json({
            success: false,
            code: "RESTORE_EXPIRED",
            error: "\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 31 \u064A\u0648\u0645\u0627\u064B \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0634\u0643\u0644 \u0646\u0647\u0627\u0626\u064A \u0648\u0644\u0645 \u064A\u0639\u062F \u0642\u0627\u0628\u0644\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629.",
            userFriendlyMessage: "\u0627\u0646\u062A\u0647\u062A \u0641\u062A\u0631\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0628\u0640 31 \u064A\u0648\u0645\u0627\u064B."
          });
        }
        if (lifecycleRecord.status === "ADMIN_DELETED" || lifecycleRecord.deletionType === "admin") {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "ADMIN_APPROVAL_REQUIRED")`);
          return res.status(400).json({
            success: false,
            code: "ADMIN_APPROVAL_REQUIRED",
            error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u062A\u0645 \u062D\u0630\u0641\u0647 \u0623\u0648 \u0625\u064A\u0642\u0627\u0641\u0647 \u0628\u0648\u0627\u0633\u0637\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629. \u064A\u0631\u062C\u0649 \u062A\u0642\u062F\u064A\u0645 \u0637\u0644\u0628 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0644\u0644\u0645\u0633\u0624\u0648\u0644.",
            userFriendlyMessage: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u064A\u062A\u0637\u0644\u0628 \u0645\u0648\u0627\u0641\u0642\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629."
          });
        }
        if (!foundUid) {
          foundUid = lifecycleRecord.originalUserId || `usr_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }
        console.log(`[RECOVERY] recovery allowed (id: ${recoveryRequestId})`);
      }
    }
    if (!foundUid) {
      if (isRecovery) {
        console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "user_lookup", error: "DELETED_ACCOUNT_NOT_FOUND")`);
        return res.status(400).json({
          success: false,
          error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0645\u062D\u0630\u0648\u0641 \u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A.",
          userFriendlyMessage: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0645\u062D\u0630\u0648\u0641 \u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A."
        });
      }
      console.warn("OTP_SEND_FAILED", {
        reason: "USER_NOT_FOUND",
        userId: null,
        email: targetIdentifier
      });
      return res.status(400).json({
        success: false,
        error: "No registered user found for this email address.",
        userFriendlyMessage: "No registered user found for this email address."
      });
    }
    const docId = foundUid;
    const db2 = readDb();
    if (!db2.verification_codes) db2.verification_codes = [];
    let existingRecord = null;
    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn("Firestore read failed for existing verification code, checking fallback:", err);
    }
    if (!existingRecord) {
      existingRecord = db2.verification_codes.find((vc) => vc.id === docId);
    }
    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(process.env.RESEND_COOLDOWN_MINUTES || "10", 10);
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1e3;
    const isInitial = !!req.body.isInitial;
    let currentSendCount = existingRecord ? existingRecord.sendCount || 0 : 0;
    if (!isInitial) {
      if (existingRecord && existingRecord.cooldownUntil) {
        const cooldownUntilMs = new Date(existingRecord.cooldownUntil).getTime();
        if (nowMs < cooldownUntilMs) {
          const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1e3);
          console.log(`[OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`);
          if (isRecovery) {
            console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "cooldown", remaining: ${remainingSecs}s)`);
          }
          return res.status(400).json({
            success: false,
            error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
            userFriendlyMessage: "\u0644\u0642\u062F \u0648\u0635\u0644\u062A \u0625\u0644\u0649 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0637\u0644\u0628\u0627\u062A \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
            cooldownUntil: existingRecord.cooldownUntil,
            cooldownRemainingSeconds: remainingSecs,
            sendCount: currentSendCount
          });
        } else {
          console.log(`[OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`);
          currentSendCount = 0;
        }
      }
      if (currentSendCount >= 3) {
        const newCooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
        console.log(`[OTP MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`);
        const updatedCooldownRecord = {
          ...existingRecord || {},
          id: docId,
          userId: foundUid,
          email: targetIdentifier,
          cooldownUntil: newCooldownUntil,
          sendCount: 3
        };
        try {
          await adminDb.collection("verification_codes").doc(docId).set(updatedCooldownRecord, { merge: true });
        } catch (e) {
        }
        db2.verification_codes = (db2.verification_codes || []).filter((vc) => vc.id !== docId);
        db2.verification_codes.push(updatedCooldownRecord);
        writeDb(db2);
        if (isRecovery) {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "max_sends_cooldown")`);
        }
        return res.status(400).json({
          success: false,
          error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage: "\u0644\u0642\u062F \u0648\u0635\u0644\u062A \u0625\u0644\u0649 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0637\u0644\u0628\u0627\u062A \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
          cooldownUntil: newCooldownUntil,
          cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
          sendCount: 3
        });
      }
      if (existingRecord && existingRecord.lastSentAt && !existingRecord.cooldownUntil) {
        const timeSinceLastSent = nowMs - new Date(existingRecord.lastSentAt).getTime();
        if (timeSinceLastSent < 30 * 1e3) {
          const waitRemaining = Math.ceil((30 * 1e3 - timeSinceLastSent) / 1e3);
          if (isRecovery) {
            console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "throttle_30s", remaining: ${waitRemaining}s)`);
          }
          return res.status(400).json({
            success: false,
            error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
            userFriendlyMessage: `\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${waitRemaining} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.`,
            sendCount: currentSendCount
          });
        }
      }
    }
    const otpCode = crypto.randomInt(1e5, 1e6).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1e3).toISOString();
    if (isRecovery) {
      console.log(`[RECOVERY] OTP generated (id: ${recoveryRequestId}, generated: true)`);
    }
    let reqName = req.body.name || req.body.userName || req.body.ownerName || req.body.fullName || "";
    let firestoreUserData = resolvedUser.userDoc;
    const localUser = db2.users?.find((u) => u.id === foundUid || u.email?.toLowerCase() === targetIdentifier);
    let rawName = reqName || firestoreUserData?.ownerName || firestoreUserData?.name || firestoreUserData?.fullName || firestoreUserData?.displayName || firestoreUserData?.companyName || localUser?.ownerName || localUser?.name || localUser?.fullName || localUser?.displayName || localUser?.companyName || "";
    const resolvedUserName = cleanUserName(rawName, targetIdentifier);
    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: targetIdentifier,
      userName: resolvedUserName,
      otpCode,
      type
    });
    if (isRecovery) {
      console.log(`[RECOVERY] email send started (id: ${recoveryRequestId}, provider: Resend)`);
    }
    const mailResult = await sendSystemMail(targetIdentifier, emailSubject, textBody, htmlBody);
    if (!mailResult.success && !mailResult.simulated) {
      console.error("[OTP DELIVERY FAILURE]", mailResult.error);
      if (isRecovery) {
        console.error(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "email_dispatch", error: ${mailResult.error?.message || mailResult.error || "Unknown"})`);
      }
      return res.status(500).json({
        success: false,
        error: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.",
        userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
      });
    }
    if (isRecovery) {
      const resStatus = mailResult.success ? 200 : mailResult.statusCode || 500;
      const resMsgId = mailResult.messageId || "none";
      console.log(`Recovery email Resend ID: ${resMsgId}`);
      console.log(`[RECOVERY] Resend response status: ${resStatus}, recipient: ${maskEmail(targetIdentifier)}, message ID: ${resMsgId}`);
    }
    const emailSent = !mailResult.simulated;
    const newSendCount = isInitial ? currentSendCount : currentSendCount + 1;
    let cooldownUntil = existingRecord?.cooldownUntil || null;
    if (!isInitial && newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[OTP 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`);
    }
    const record = {
      id: docId,
      userId: foundUid,
      email: targetIdentifier,
      phone: phone ? phone.trim() : "",
      codeHash,
      // STORE ONLY SECURE HASH
      type,
      expiresAt,
      attempts: 0,
      sendCount: newSendCount,
      cooldownUntil,
      lastSentAt: (/* @__PURE__ */ new Date()).toISOString(),
      used: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("Saving OTP for Doc ID:", docId, "Count:", newSendCount, "Name:", resolvedUserName || "(none)");
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      if (docId !== targetIdentifier) {
        await adminDb.collection("verification_codes").doc(targetIdentifier).set({ ...record, id: targetIdentifier });
      }
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }
    try {
      if (!db2.verification_codes) db2.verification_codes = [];
      db2.verification_codes = db2.verification_codes.filter((vc) => vc.id !== docId && vc.id !== targetIdentifier);
      db2.verification_codes.push(record);
      if (docId !== targetIdentifier) {
        db2.verification_codes.push({ ...record, id: targetIdentifier });
      }
      writeDb(db2);
    } catch (err) {
      console.warn("Fallback JSON DB write failed:", err);
    }
    if (isRecovery) {
      console.log(`[RECOVERY] OTP stored (id: ${recoveryRequestId}, docId: ${docId})`);
      console.log(`[RECOVERY] email send completed (id: ${recoveryRequestId})`);
    }
    console.log(`[VERIFICATION CODE RECORDED] Target: ${targetIdentifier} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`);
    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${targetIdentifier}`,
      expiresAt,
      emailSent,
      devCode: mailResult.simulated ? otpCode : void 0,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || void 0,
      sendCountRemaining: Math.max(0, 3 - newSendCount)
    });
  } catch (error) {
    if (isRecovery) {
      console.error(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "exception", error: ${error?.message || String(error)})`);
    }
    console.error("Verification Sending Error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to generate verification code" });
  }
});
app.post("/api/auth/verify-code", otpLimiter, async (req, res) => {
  try {
    const { email, phone, code, userId, type = "account_registration" } = req.body;
    if (!email && !phone && !userId || !code) {
      return res.status(400).json({ error: "Identifier and 6-digit verification code are required" });
    }
    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier = resolvedUser.email || (email || phone || "").trim().toLowerCase();
    const cleanCode = String(code).trim();
    const foundUid = resolvedUser.userId;
    console.log("Verifying OTP for:", targetIdentifier);
    console.log("OTP verification attempt", {
      userId: foundUid || null,
      email: targetIdentifier,
      documentId: foundUid || null
    });
    if (!foundUid) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "USER_NOT_FOUND",
        userId: null,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "No registered user found for this email address." });
    }
    const docId = foundUid;
    let activeRecord = null;
    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        activeRecord = docSnap.data();
      }
    } catch (err) {
      console.error("Failed to query Firestore verification_codes:", err);
    }
    if (!activeRecord) {
      const db3 = readDb();
      if (!db3.verification_codes) db3.verification_codes = [];
      activeRecord = db3.verification_codes.find((vc) => vc.id === docId || vc.userId === docId);
      if (!activeRecord) {
        try {
          const qSnap = await adminDb.collection("verification_codes").where("email", "==", targetIdentifier).where("used", "==", false).get();
          if (!qSnap.empty) {
            activeRecord = qSnap.docs[0].data();
          }
        } catch (fErr) {
        }
      }
    }
    if (!activeRecord) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "VERIFICATION_DOCUMENT_NOT_FOUND",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "No active verification code found. Please click Resend Code." });
    }
    if (activeRecord.used) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "No active verification code found. Please click Resend Code." });
    }
    if (activeRecord.userId && activeRecord.userId !== foundUid) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "INVALID_USER",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "Verification code does not match the active session." });
    }
    const recordDocId = activeRecord.id || docId;
    const updateRecord = async (fields) => {
      try {
        await adminDb.collection("verification_codes").doc(recordDocId).update(fields);
      } catch (err) {
        console.error("Failed to update Firestore verification code:", err);
      }
      const db3 = readDb();
      if (!db3.verification_codes) db3.verification_codes = [];
      const localRecord = db3.verification_codes.find((vc) => vc.id === recordDocId || vc.id === docId);
      if (localRecord) {
        Object.assign(localRecord, fields);
        writeDb(db3);
      }
    };
    const expiresAt = activeRecord.expiresAt?.toDate ? activeRecord.expiresAt.toDate() : new Date(activeRecord.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      await updateRecord({ used: true });
      console.warn("OTP_VERIFY_FAILED", {
        reason: "EXPIRED",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }
    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: "Maximum verification attempts reached. Please request a new code." });
    }
    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash ? activeRecord.codeHash === cleanCodeHash : activeRecord.code === cleanCode;
    if (!isMatch) {
      const newAttempts = (activeRecord.attempts || 0) + 1;
      await updateRecord({ attempts: newAttempts });
      const remaining = 5 - newAttempts;
      console.warn("OTP_VERIFY_FAILED", {
        reason: "INVALID_CODE",
        userId: foundUid,
        email: targetIdentifier
      });
      return res.status(400).json({ error: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }
    await updateRecord({ used: true, verifiedAt: (/* @__PURE__ */ new Date()).toISOString() });
    const db2 = readDb();
    const user = db2.users?.find((u) => u.email?.toLowerCase() === targetIdentifier || u.id === foundUid);
    let firestoreUser = null;
    try {
      const userRef = adminDb.collection("users").doc(foundUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        firestoreUser = userSnap.data();
        await userRef.update({
          isVerified: true,
          isEmailVerified: true,
          emailVerified: true,
          email_verified: true,
          isPhoneVerified: true,
          verification_status: "verified",
          verification_required: false,
          "verificationInfo.status": "verified",
          "verificationInfo.verifiedAt": (/* @__PURE__ */ new Date()).toISOString()
        });
        firestoreUser.isVerified = true;
        firestoreUser.isEmailVerified = true;
        firestoreUser.emailVerified = true;
        firestoreUser.email_verified = true;
        firestoreUser.verification_status = "verified";
        firestoreUser.verification_required = false;
        console.log(`[VERIFICATION SUCCESS] Updated user ${foundUid} in Firestore.`);
      }
    } catch (uErr) {
      console.warn("Could not update user verification status in Firestore (proceeding):", uErr);
    }
    if (user) {
      user.isVerified = true;
      user.isEmailVerified = true;
      user.emailVerified = true;
      user.email_verified = true;
      user.isPhoneVerified = true;
      user.verification_status = "verified";
      user.verification_required = false;
      if (!user.verificationInfo) user.verificationInfo = {};
      user.verificationInfo.status = "verified";
      user.verificationInfo.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (firestoreUser && firestoreUser.role) {
        user.role = firestoreUser.role;
      }
      writeDb(db2);
    }
    const resolvedFinalUser = firestoreUser || user || resolvedUser.userDoc || null;
    if (resolvedFinalUser && !resolvedFinalUser.role) {
      resolvedFinalUser.role = "CEO";
    }
    return res.status(200).json({
      success: true,
      message: "Verification successful!",
      user: resolvedFinalUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to verify code" });
  }
});
app.post("/api/auth/forgot-password", otpLimiter, async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ error: "Email address or phone number is required" });
    }
    const target = emailOrPhone.trim().toLowerCase();
    const db2 = readDb();
    let user = null;
    let userId = "";
    let userEmail = target;
    let userPhone = "";
    let rawUserName = "";
    let firestoreUserData = null;
    try {
      const uSnap = await adminDb.collection("users").where("email", "==", target).limit(1).get();
      if (!uSnap.empty) {
        const uDoc = uSnap.docs[0];
        firestoreUserData = uDoc.data();
        userId = uDoc.id;
        userEmail = firestoreUserData.email || target;
        userPhone = firestoreUserData.phone || "";
        rawUserName = firestoreUserData.ownerName || firestoreUserData.name || firestoreUserData.fullName || "";
        user = { id: userId, email: userEmail, phone: userPhone, ownerName: rawUserName };
      }
    } catch (err) {
      console.warn("Firestore forgot-password user lookup failed:", err);
    }
    if (!user) {
      const localUser = db2.users.find((u) => u.email?.toLowerCase() === target || u.phone === target);
      if (localUser) {
        userId = localUser.id;
        userEmail = localUser.email || target;
        userPhone = localUser.phone || "";
        rawUserName = localUser.ownerName || localUser.name || localUser.fullName || "";
        user = localUser;
      }
    }
    if (!user) {
      return res.json({
        success: true,
        message: "If an account matches that email address, a password reset code has been sent.",
        userFriendlyMessage: "\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644\u0627\u064B\u060C \u0641\u0642\u062F \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A."
      });
    }
    const docId = userId || target;
    let existingRecord = null;
    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn("Firestore read failed for existing forgot-password code, checking fallback:", err);
    }
    if (!existingRecord) {
      if (!db2.verification_codes) db2.verification_codes = [];
      existingRecord = db2.verification_codes.find((vc) => vc.id === docId);
    }
    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(process.env.RESEND_COOLDOWN_MINUTES || "10", 10);
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1e3;
    let currentSendCount = existingRecord ? existingRecord.sendCount || 0 : 0;
    if (existingRecord && existingRecord.cooldownUntil) {
      const cooldownUntilMs = new Date(existingRecord.cooldownUntil).getTime();
      if (nowMs < cooldownUntilMs) {
        const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1e3);
        console.log(`[FORGOT PASSWORD OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`);
        return res.status(400).json({
          success: false,
          error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage: "\u0644\u0642\u062F \u0648\u0635\u0644\u062A \u0625\u0644\u0649 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0637\u0644\u0628\u0627\u062A \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
          cooldownUntil: existingRecord.cooldownUntil,
          cooldownRemainingSeconds: remainingSecs,
          sendCount: currentSendCount
        });
      } else {
        console.log(`[FORGOT PASSWORD OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`);
        currentSendCount = 0;
      }
    }
    if (currentSendCount >= 3) {
      const newCooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[FORGOT PASSWORD MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`);
      const updatedCooldownRecord = {
        ...existingRecord || {},
        id: docId,
        cooldownUntil: newCooldownUntil,
        sendCount: 3
      };
      try {
        await adminDb.collection("verification_codes").doc(docId).set(updatedCooldownRecord, { merge: true });
      } catch (e) {
      }
      db2.verification_codes = (db2.verification_codes || []).filter((vc) => vc.id !== docId);
      db2.verification_codes.push(updatedCooldownRecord);
      writeDb(db2);
      return res.status(400).json({
        success: false,
        error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
        userFriendlyMessage: "\u0644\u0642\u062F \u0648\u0635\u0644\u062A \u0625\u0644\u0649 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0637\u0644\u0628\u0627\u062A \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
        cooldownUntil: newCooldownUntil,
        cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
        sendCount: 3
      });
    }
    if (existingRecord && existingRecord.lastSentAt && !existingRecord.cooldownUntil) {
      const timeSinceLastSent = nowMs - new Date(existingRecord.lastSentAt).getTime();
      if (timeSinceLastSent < 60 * 1e3) {
        const waitRemaining = Math.ceil((60 * 1e3 - timeSinceLastSent) / 1e3);
        return res.status(400).json({
          success: false,
          error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
          userFriendlyMessage: `\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${waitRemaining} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.`,
          sendCount: currentSendCount
        });
      }
    }
    const otpCode = crypto.randomInt(1e5, 1e6).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1e3).toISOString();
    const resolvedUserName = cleanUserName(req.body.name || rawUserName, userEmail);
    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: userEmail,
      userName: resolvedUserName,
      otpCode,
      type: "password_reset"
    });
    const mailResult = await sendSystemMail(target, emailSubject, textBody, htmlBody);
    if (!mailResult.success && !mailResult.simulated) {
      console.error("[PASSWORD RESET EMAIL DELIVERY FAILURE]", mailResult.error);
      return res.status(500).json({
        success: false,
        error: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0639\u064A\u064A\u0646. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
      });
    }
    const emailSent = !mailResult.simulated;
    const newSendCount = currentSendCount + 1;
    let cooldownUntil = null;
    if (newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[FORGOT PASSWORD 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`);
    }
    const record = {
      id: docId,
      userId,
      email: userEmail,
      phone: userPhone,
      codeHash,
      // STORE ONLY SECURE HASH
      type: "password_reset",
      expiresAt,
      attempts: 0,
      sendCount: newSendCount,
      cooldownUntil,
      lastSentAt: (/* @__PURE__ */ new Date()).toISOString(),
      used: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("Saving password reset OTP for Doc ID:", docId, "Count:", newSendCount);
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }
    try {
      if (!db2.verification_codes) db2.verification_codes = [];
      db2.verification_codes = db2.verification_codes.filter((vc) => vc.id !== docId);
      db2.verification_codes.push(record);
      writeDb(db2);
    } catch (err) {
      console.warn("Failed to write to fallback JSON DB:", err);
    }
    console.log(`[PASSWORD RESET CODE RECORDED] Target: ${target} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`);
    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${target}`,
      emailSent: true,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || void 0,
      sendCountRemaining: Math.max(0, 3 - newSendCount)
    });
  } catch (error) {
    console.error("Password Reset Sending Error:", error);
    return res.status(200).json({ success: false, serverError: error?.message || "Failed to process forgot password request" });
  }
});
app.post("/api/auth/reset-password", otpLimiter, async (req, res) => {
  try {
    const { emailOrPhone, code, newPassword } = req.body;
    if (!emailOrPhone || !code || !newPassword) {
      return res.status(400).json({ error: "All fields (email/phone, code, new password) are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    const target = emailOrPhone.trim().toLowerCase();
    const cleanCode = String(code).trim();
    console.log("Searching OTP:", target);
    let activeRecords = [];
    try {
      const qSnap = await adminDb.collection("verification_codes").where("email", "==", target).where("type", "==", "password_reset").where("used", "==", false).get();
      qSnap.forEach((doc) => {
        activeRecords.push({ docId: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.error("Failed to query Firestore verification_codes:", err);
    }
    if (activeRecords.length === 0) {
      console.log("No active password reset code in Firestore, trying JSON database fallback...");
      const db3 = readDb();
      if (!db3.verification_codes) db3.verification_codes = [];
      const localRecords = db3.verification_codes.filter(
        (vc) => (vc.email?.toLowerCase() === target || vc.phone === target) && vc.type === "password_reset" && !vc.used
      );
      activeRecords = localRecords;
    }
    if (activeRecords.length === 0) {
      return res.status(400).json({ error: "No active password reset request found. Please request a new verification code." });
    }
    activeRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const activeRecord = activeRecords[0];
    console.log("OTP record located for password reset verification");
    const docRef = activeRecord.docId ? adminDb.collection("verification_codes").doc(activeRecord.docId) : null;
    const updateRecord = async (fields) => {
      if (docRef) {
        try {
          await docRef.update(fields);
        } catch (err) {
          console.error("Failed to update Firestore verification code:", err);
        }
      }
      const db3 = readDb();
      if (!db3.verification_codes) db3.verification_codes = [];
      const localRecord = db3.verification_codes.find((vc) => vc.id === activeRecord.id);
      if (localRecord) {
        Object.assign(localRecord, fields);
        writeDb(db3);
      }
    };
    if (/* @__PURE__ */ new Date() > new Date(activeRecord.expiresAt)) {
      await updateRecord({ used: true });
      return res.status(400).json({ error: "Password reset code has expired. Please request a new code." });
    }
    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      return res.status(400).json({ error: "Maximum attempts reached. Please request a new reset code." });
    }
    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash ? activeRecord.codeHash === cleanCodeHash : activeRecord.code === cleanCode;
    if (!isMatch) {
      const newAttempts = (activeRecord.attempts || 0) + 1;
      await updateRecord({ attempts: newAttempts });
      const remaining = 5 - newAttempts;
      return res.status(400).json({ error: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }
    await updateRecord({ used: true });
    const db2 = readDb();
    const user = db2.users.find((u) => u.email?.toLowerCase() === target || u.phone === target || u.id === activeRecord.userId);
    try {
      let uid = user?.id || activeRecord.userId;
      if (!uid) {
        const uSnap = await adminDb.collection("users").where("email", "==", target).limit(1).get();
        if (!uSnap.empty) {
          uid = uSnap.docs[0].id;
        }
      }
      if (uid) {
        const userRef = adminDb.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({
            passwordHash: newPassword,
            isEmailVerified: true,
            "verificationInfo.status": "verified"
          });
          console.log(`[PASSWORD RESET SUCCESS] Updated user ${uid} password in Firestore.`);
        }
      }
    } catch (uErr) {
      console.warn("Could not update user password in Firestore (proceeding):", uErr);
    }
    if (user) {
      user.passwordHash = newPassword;
      user.isEmailVerified = true;
      if (!user.verificationInfo) user.verificationInfo = {};
      user.verificationInfo.status = "verified";
      writeDb(db2);
    }
    return res.json({
      success: true,
      message: "Your password has been successfully reset. You can now log in with your new password."
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});
app.post("/api/auth/set-password", async (req, res) => {
  try {
    const { userId, email, newPassword, currentPassword, isGoogleUser } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db2 = readDb();
    let user = db2.users.find((u) => u.id === userId || cleanEmail && u.email?.toLowerCase() === cleanEmail);
    let uid = userId || user?.id;
    let firestoreUserSnap = null;
    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserSnap = docSnap;
        }
      } catch (fsErr) {
        console.warn("Firestore lookup failed in set-password:", fsErr);
      }
    }
    const existingPassword = user?.passwordHash || firestoreUserSnap?.data()?.passwordHash;
    if (existingPassword && !isGoogleUser && currentPassword) {
      if (existingPassword !== currentPassword && hashVerificationCode(currentPassword) !== existingPassword) {
        return res.status(400).json({ error: "Current password is incorrect.", userFriendlyMessage: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
      }
    }
    if (uid) {
      try {
        await adminAuth.updateUser(uid, { password: newPassword });
        console.log(`[PASSWORD SET] Updated Firebase Auth password for uid: ${uid}`);
      } catch (authErr) {
        console.warn("Could not update Firebase Auth user directly (proceeding with Firestore update):", authErr.message);
      }
    }
    if (uid) {
      try {
        await adminDb.collection("users").doc(uid).set({
          passwordHash: newPassword,
          hasPasswordSet: true,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
      } catch (fsErr) {
        console.warn("Could not update Firestore user password:", fsErr);
      }
    }
    if (user) {
      user.passwordHash = newPassword;
      user.hasPasswordSet = true;
      writeDb(db2);
    } else if (uid && cleanEmail) {
      const newUser = {
        id: uid,
        email: cleanEmail,
        passwordHash: newPassword,
        hasPasswordSet: true,
        role: "CEO",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db2.users.push(newUser);
      writeDb(db2);
    }
    return res.json({
      success: true,
      message: "Password has been successfully set.",
      userFriendlyMessage: "\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0648\u062D\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D."
    });
  } catch (err) {
    console.error("Error setting password:", err);
    res.status(500).json({ error: err.message || "Failed to set password." });
  }
});
app.post("/api/auth/verify-account-password", async (req, res) => {
  try {
    const { userId, email, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db2 = readDb();
    let user = db2.users.find((u) => u.id === userId || cleanEmail && u.email?.toLowerCase() === cleanEmail);
    let uid = userId || user?.id;
    let firestoreUserSnap = null;
    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserSnap = docSnap.data();
        }
      } catch (e) {
      }
    }
    const storedPassword = firestoreUserSnap?.passwordHash || user?.passwordHash;
    if (!storedPassword) {
      return res.json({ success: true, valid: true, isFirstTime: true });
    }
    const isValid = storedPassword === password || hashVerificationCode(password) === storedPassword;
    return res.json({
      success: true,
      valid: isValid,
      message: isValid ? "Password verified." : "Invalid password."
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to verify password." });
  }
});
app.post("/api/auth/reset-encryption-with-password", async (req, res) => {
  try {
    const { userId, email, accountPassword, newPasscode, lockedModules } = req.body;
    if (!newPasscode || newPasscode.trim().length === 0) {
      return res.status(400).json({ error: "New secret passcode is required." });
    }
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db2 = readDb();
    let user = db2.users.find((u) => u.id === userId || cleanEmail && u.email?.toLowerCase() === cleanEmail);
    let uid = userId || user?.id;
    let firestoreUserData = null;
    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserData = docSnap.data();
        }
      } catch (e) {
      }
    }
    const storedPassword = firestoreUserData?.passwordHash || user?.passwordHash;
    if (storedPassword && accountPassword) {
      const isValid = storedPassword === accountPassword || hashVerificationCode(accountPassword) === storedPassword;
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Account password verification failed. Please enter your correct current account password.",
          userFriendlyMessage: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629. \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u062D\u0633\u0627\u0628\u0643 \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u0641\u064A\u0631."
        });
      }
    }
    const newSecuritySettings = {
      secretPasscode: newPasscode.trim(),
      isPinSet: true,
      lockedModules: lockedModules || {
        fileVault: true,
        memoryVault: true,
        riskRadar: true,
        settings: false
      },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (uid) {
      try {
        await adminDb.collection("users").doc(uid).set({
          encryptedSecurity: newSecuritySettings
        }, { merge: true });
        console.log(`[ENCRYPTION RESET] Updated security settings for uid: ${uid}`);
      } catch (fsErr) {
        console.warn("Firestore encryption update warning:", fsErr);
      }
    }
    if (user) {
      user.encryptedSecurity = newSecuritySettings;
      writeDb(db2);
    }
    return res.json({
      success: true,
      message: "Encryption passcode reset successfully with account password verification.",
      userFriendlyMessage: "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0648\u062A\u062D\u062F\u064A\u062B \u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u0628\u0646\u062C\u0627\u062D \u0639\u0628\u0631 \u062A\u0623\u0643\u064A\u062F \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0633\u0627\u0628.",
      encryptedSecurity: newSecuritySettings
    });
  } catch (err) {
    console.error("Error resetting encryption passcode:", err);
    res.status(500).json({ error: err.message || "Failed to reset encryption passcode." });
  }
});
app.post("/api/admin/send-invitation", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        error: "Unauthorized: Token verification required.",
        userFriendlyMessage: "\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062F\u0639\u0648\u0627\u062A."
      });
    }
    const { email, name, role, powers } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        error: "Invalid email format provided.",
        userFriendlyMessage: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0639\u0646\u0648\u0627\u0646 \u0628\u0631\u064A\u062F \u0635\u062D\u064A\u062D."
      });
    }
    let ceoData = null;
    try {
      const ceoSnap = await adminDb.collection("users").doc(callerUid).get();
      if (ceoSnap.exists) {
        ceoData = ceoSnap.data();
      }
    } catch (e) {
    }
    if (!ceoData) {
      const db3 = readDb();
      ceoData = db3.users?.find((u) => u.id === callerUid);
    }
    if (!ceoData) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        error: "Sender account not found.",
        userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0631\u0633\u0644."
      });
    }
    const ceoRole = (ceoData.role || "").toUpperCase();
    if (ceoRole !== "CEO" && ceoRole !== "ADMIN") {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        error: "Forbidden: Only CEO or Admin can invite workspace members.",
        userFriendlyMessage: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646. \u0647\u0630\u0647 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u062D\u0635\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A (CEO)."
      });
    }
    if (normalizedEmail === (req.user?.email || ceoData.email || "").toLowerCase()) {
      return res.status(400).json({
        success: false,
        code: "SELF_INVITATION",
        error: "Cannot invite sender email address.",
        userFriendlyMessage: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u062D\u0627\u0644\u064A."
      });
    }
    const workspaceId = ceoData.workspaceId || `ws_${callerUid.substring(0, 8)}`;
    const teamMembersList = ceoData.teamMembersList || [];
    const isAlreadyInTeam = teamMembersList.some((m) => {
      const mEmail = m.email?.trim().toLowerCase();
      const isPending = m.name?.includes("\u0645\u0639\u0644\u0642") || m.name?.includes("Pending");
      return mEmail === normalizedEmail && !isPending;
    });
    if (isAlreadyInTeam) {
      return res.status(400).json({
        success: false,
        code: "ALREADY_MEMBER",
        error: "Employee is already a full member of the organization.",
        userFriendlyMessage: "\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0636\u0648 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0645\u0624\u0633\u0633\u0629."
      });
    }
    try {
      const existingUserSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).get();
      if (!existingUserSnap.empty) {
        const existingUserData = existingUserSnap.docs[0].data();
        if (existingUserData.workspaceId === workspaceId && existingUserData.role !== "Pending") {
          return res.status(400).json({
            success: false,
            code: "ALREADY_MEMBER",
            error: "Employee is already registered in this workspace.",
            userFriendlyMessage: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0639\u0636\u0648 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0645\u0624\u0633\u0633\u0629."
          });
        }
      }
    } catch (e) {
    }
    let existingInv = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) {
        existingInv = invDoc.data();
      }
    } catch (e) {
    }
    const secureToken = crypto.randomBytes(24).toString("hex");
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 3600 * 1e3).toISOString();
    const companyName = ceoData.companyName || "ZakIr Platform";
    const memberName = (name || normalizedEmail.split("@")[0]).trim();
    const designatedRole = role || "Contributor";
    const defaultPowers = powers || {
      fileVault: true,
      memoryVault: true,
      riskRadar: false,
      marketIntel: false,
      settings: false
    };
    const invitationRecord = {
      email: normalizedEmail,
      name: memberName,
      role: designatedRole,
      powers: defaultPowers,
      workspaceId,
      companyName,
      senderId: callerUid,
      senderEmail: ceoData.email || req.user?.email,
      status: "pending",
      token: secureToken,
      createdAt: existingInv?.createdAt || nowIso,
      updatedAt: nowIso,
      expiresAt: expiresAtIso,
      lastSentAt: nowIso,
      resendCount: (existingInv?.resendCount || 0) + (existingInv ? 1 : 0)
    };
    try {
      await adminDb.collection("invitations").doc(normalizedEmail).set(invitationRecord);
    } catch (fsErr) {
      console.error("Failed to write invitation to Firestore:", fsErr);
    }
    const db2 = readDb();
    if (!db2.invitations) db2.invitations = [];
    db2.invitations = db2.invitations.filter((i) => i.email?.trim().toLowerCase() !== normalizedEmail);
    db2.invitations.push(invitationRecord);
    writeDb(db2);
    try {
      const ceoRef = adminDb.collection("users").doc(callerUid);
      const updatedList = teamMembersList.filter((m) => m.email?.trim().toLowerCase() !== normalizedEmail);
      updatedList.push({
        id: `tm-inv-${Date.now()}`,
        name: `${memberName} (\u0645\u0639\u0644\u0642)`,
        email: normalizedEmail,
        role: designatedRole,
        powers: defaultPowers,
        addedAt: nowIso.split("T")[0]
      });
      await ceoRef.update({ teamMembersList: updatedList });
    } catch (ceoErr) {
      console.warn("Failed to update CEO team list in Firestore:", ceoErr);
    }
    const appBaseUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || getAppBaseUrl();
    const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;
    const inviterName = ceoData?.ownerName || ceoData?.email || "Workspace Admin";
    const { subject: emailSubject, text: emailText, html: emailHtml } = buildInvitationEmailHtml({
      companyName,
      memberName,
      inviterName,
      designatedRole,
      inviteLink,
      isReminder: false
    });
    const mailResult = await sendSystemMail({
      to: normalizedEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });
    if (mailResult.success) {
      console.log("INVITATION_SENT_SUCCESSFULLY", {
        recipient: normalizedEmail,
        ceo: callerUid,
        workspaceId
      });
      return res.json({
        success: true,
        message: "Invitation generated and dispatched successfully via email.",
        userFriendlyMessage: `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F (${normalizedEmail}).`,
        invitation: invitationRecord
      });
    } else {
      console.warn("INVITATION_EMAIL_DELIVERY_FAILED", {
        recipient: normalizedEmail,
        error: mailResult.error
      });
      invitationRecord.status = "email_failed";
      try {
        await adminDb.collection("invitations").doc(normalizedEmail).update({ status: "email_failed" });
      } catch (e) {
      }
      return res.json({
        success: true,
        emailSent: false,
        code: "EMAIL_SEND_FAILED",
        userFriendlyMessage: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062F\u0639\u0648\u0629 \u0628\u0646\u062C\u0627\u062D\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u062D\u0627\u0644\u064A\u0627\u064B. \u064A\u0645\u0643\u0646\u0643 \u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062F\u0639\u0648\u0629 \u0644\u0627\u062D\u0642\u0627\u064B \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.`,
        invitation: invitationRecord
      });
    }
  } catch (err) {
    console.error("send-invitation endpoint exception:", err);
    return res.status(500).json({
      success: false,
      code: "INVITATION_CREATE_FAILED",
      error: err?.message || String(err),
      userFriendlyMessage: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062F\u0639\u0648\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0633\u0628\u0628 \u062E\u0637\u0623 \u062E\u0627\u062F\u0645 \u062F\u0627\u062E\u0644\u064A. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
  }
});
app.post("/api/admin/resend-invitation", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", error: "Unauthorized" });
    }
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, code: "INVALID_EMAIL", error: "Email is required" });
    }
    let ceoData = null;
    try {
      const snap = await adminDb.collection("users").doc(callerUid).get();
      if (snap.exists) ceoData = snap.data();
    } catch (e) {
    }
    const ceoRole = (ceoData?.role || "").toUpperCase();
    if (ceoRole !== "CEO" && ceoRole !== "ADMIN") {
      return res.status(403).json({ success: false, code: "FORBIDDEN", error: "Forbidden: Only CEO can resend invitations" });
    }
    let invRecord = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) invRecord = invDoc.data();
    } catch (e) {
    }
    if (!invRecord) {
      const db3 = readDb();
      invRecord = db3.invitations?.find((i) => i.email?.trim().toLowerCase() === normalizedEmail);
    }
    if (!invRecord) {
      return res.status(404).json({ success: false, code: "INVITATION_NOT_FOUND", error: "Invitation not found", userFriendlyMessage: "\u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    }
    const secureToken = crypto.randomBytes(24).toString("hex");
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 3600 * 1e3).toISOString();
    invRecord.token = secureToken;
    invRecord.status = "pending";
    invRecord.expiresAt = expiresAtIso;
    invRecord.lastSentAt = nowIso;
    invRecord.resendCount = (invRecord.resendCount || 0) + 1;
    try {
      await adminDb.collection("invitations").doc(normalizedEmail).set(invRecord);
    } catch (e) {
    }
    const db2 = readDb();
    if (!db2.invitations) db2.invitations = [];
    const idx = db2.invitations.findIndex((i) => i.email?.trim().toLowerCase() === normalizedEmail);
    if (idx >= 0) db2.invitations[idx] = invRecord;
    else db2.invitations.push(invRecord);
    writeDb(db2);
    const companyName = invRecord.companyName || ceoData?.companyName || "Zakir Workspace";
    const memberName = invRecord.name || normalizedEmail.split("@")[0];
    const designatedRole = invRecord.role || "Contributor";
    const appBaseUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || getAppBaseUrl();
    const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;
    const inviterName = ceoData?.ownerName || ceoData?.email || "Workspace Admin";
    const { subject: emailSubject, text: emailText, html: emailHtml } = buildInvitationEmailHtml({
      companyName,
      memberName,
      inviterName,
      designatedRole,
      inviteLink,
      isReminder: true
    });
    const mailResult = await sendSystemMail({
      to: normalizedEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });
    return res.json({
      success: true,
      emailSent: mailResult.success,
      userFriendlyMessage: mailResult.success ? `\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u0628\u0631\u064A\u062F \u0627\u0644\u062F\u0639\u0648\u0629 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 (${normalizedEmail}).` : `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062F\u0639\u0648\u0629\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u062D\u0627\u0644\u064A\u0627\u064B.`,
      invitation: invRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, userFriendlyMessage: "\u0641\u0634\u0644 \u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062F\u0639\u0648\u0629." });
  }
});
app.post("/api/admin/revoke-invitation", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", error: "Unauthorized" });
    }
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, code: "INVALID_EMAIL", error: "Email required" });
    }
    try {
      await adminDb.collection("invitations").doc(normalizedEmail).delete();
    } catch (e) {
    }
    const db2 = readDb();
    if (db2.invitations) {
      db2.invitations = db2.invitations.filter((i) => i.email?.trim().toLowerCase() !== normalizedEmail);
      writeDb(db2);
    }
    try {
      const ceoRef = adminDb.collection("users").doc(callerUid);
      const snap = await ceoRef.get();
      if (snap.exists) {
        const teamList = (snap.data()?.teamMembersList || []).filter((m) => m.email?.trim().toLowerCase() !== normalizedEmail);
        await ceoRef.update({ teamMembersList: teamList });
      }
    } catch (e) {
    }
    return res.json({
      success: true,
      userFriendlyMessage: `\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0648\u0633\u062D\u0628 \u0627\u0644\u062F\u0639\u0648\u0629 \u0628\u0646\u062C\u0627\u062D \u0644\u0640 (${normalizedEmail}).`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, userFriendlyMessage: "\u0641\u0634\u0644 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062F\u0639\u0648\u0629." });
  }
});
app.post("/api/admin/update-member-permissions", async (req, res) => {
  try {
    const { ceoId, memberId, memberEmail, powers, role } = req.body;
    if (!ceoId || !memberEmail) {
      return res.status(400).json({ error: "CEO ID and Member Email are required." });
    }
    const cleanEmail = memberEmail.trim().toLowerCase();
    const db2 = readDb();
    let ceoUser = db2.users.find((u) => u.id === ceoId);
    if (!ceoUser) {
      try {
        const ceoDoc = await adminDb.collection("users").doc(ceoId).get();
        if (ceoDoc.exists) {
          ceoUser = ceoDoc.data();
        }
      } catch (e) {
      }
    }
    if (ceoUser && ceoUser.role !== "CEO" && ceoUser.role !== "Admin") {
      return res.status(403).json({
        error: "Forbidden: Only the CEO has full authority to modify member powers and permissions.",
        userFriendlyMessage: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u064A\u0645\u062A\u0644\u0643 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A (CEO) \u0648\u062D\u062F\u0647 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062D\u0635\u0631\u064A\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0639\u0645\u0627\u0644 \u0648\u0623\u0639\u0636\u0627\u0621 \u0627\u0644\u0641\u0631\u064A\u0642."
      });
    }
    if (ceoId) {
      try {
        const ceoRef = adminDb.collection("users").doc(ceoId);
        const ceoSnap = await ceoRef.get();
        if (ceoSnap.exists) {
          const data = ceoSnap.data();
          const list = data?.teamMembersList || [];
          const targetIdx = list.findIndex((m) => m.email?.toLowerCase() === cleanEmail || m.id === memberId);
          if (targetIdx >= 0) {
            list[targetIdx] = {
              ...list[targetIdx],
              powers: powers || list[targetIdx].powers,
              role: role || list[targetIdx].role
            };
          } else {
            list.push({
              id: memberId || `tm-${Date.now()}`,
              email: cleanEmail,
              name: cleanEmail.split("@")[0],
              powers: powers || { fileVault: true, memoryVault: true, riskRadar: false, marketIntel: false, settings: false },
              role: role || "Contributor",
              addedAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
            });
          }
          await ceoRef.update({ teamMembersList: list });
        }
      } catch (fsErr) {
        console.warn("Failed to update CEO team list in Firestore:", fsErr);
      }
    }
    let memberUid = memberId?.replace("tm-", "");
    try {
      if (memberUid) {
        const mRef = adminDb.collection("users").doc(memberUid);
        const mSnap = await mRef.get();
        if (mSnap.exists) {
          await mRef.update({
            powers,
            role: role || mSnap.data()?.role || "Contributor",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          console.log(`[PERMISSIONS SYNC] Updated worker ${memberUid} profile in Firestore.`);
        }
      }
      const qSnap = await adminDb.collection("users").where("email", "==", cleanEmail).limit(1).get();
      if (!qSnap.empty) {
        const docRef = qSnap.docs[0].ref;
        await docRef.update({
          powers,
          role: role || qSnap.docs[0].data()?.role || "Contributor",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        console.log(`[PERMISSIONS SYNC] Updated worker by email ${cleanEmail} in Firestore.`);
      }
    } catch (workerErr) {
      console.warn("Failed to update worker document directly in Firestore:", workerErr);
    }
    if (db2.users) {
      const workerUser = db2.users.find((u) => u.email?.toLowerCase() === cleanEmail || u.id === memberUid);
      if (workerUser) {
        if (powers) workerUser.powers = powers;
        if (role) workerUser.role = role;
      }
      if (ceoUser && ceoUser.teamMembersList) {
        const idx = ceoUser.teamMembersList.findIndex((m) => m.email?.toLowerCase() === cleanEmail || m.id === memberId);
        if (idx >= 0) {
          ceoUser.teamMembersList[idx].powers = powers || ceoUser.teamMembersList[idx].powers;
          ceoUser.teamMembersList[idx].role = role || ceoUser.teamMembersList[idx].role;
        }
      }
      writeDb(db2);
    }
    return res.json({
      success: true,
      message: "Member permissions updated successfully by CEO.",
      userFriendlyMessage: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0648\u062A\u062B\u0628\u064A\u062A \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0639\u0636\u0648 \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0637\u0631\u0641 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A."
    });
  } catch (err) {
    console.error("Error updating member permissions:", err);
    res.status(500).json({ error: err.message || "Failed to update member permissions." });
  }
});
app.post("/api/support/tickets", async (req, res) => {
  try {
    let callerUid = req.user?.uid;
    let callerEmail = req.user?.email || "";
    let { userId, userEmail, userName, userPhone, companyName, category, subject, message, description, priority = "Normal", attachments = [] } = req.body;
    userId = callerUid || userId || `usr_${Date.now()}`;
    userEmail = callerEmail || userEmail || "support_user@zakir.ai";
    const resolvedMessage = description || message;
    if (!userEmail || !subject || !resolvedMessage) {
      return res.status(400).json({ error: "User email, subject, and detailed message are required." });
    }
    const db2 = readDb();
    if (!db2.support_tickets) db2.support_tickets = [];
    let userCreatedAt = "";
    if (db2.users) {
      const u = db2.users.find((x) => x.id === userId || x.email?.toLowerCase() === userEmail.toLowerCase());
      if (u) userCreatedAt = u.createdAt || "";
    }
    const ticketNumber = Math.floor(1e5 + Math.random() * 9e5);
    const ticketId = `ticket_${ticketNumber}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const initialMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId,
      senderId: userId,
      senderType: "user",
      senderName: userName || userEmail.split("@")[0],
      senderEmail: userEmail,
      message: resolvedMessage,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: nowIso
    };
    const newTicket = {
      id: ticketId,
      userId,
      userEmail,
      userName: userName || userEmail.split("@")[0],
      userPhone: userPhone || "",
      companyName: companyName || "",
      userCreatedAt,
      category: category || "Technical Issue",
      subject,
      description: resolvedMessage,
      message: resolvedMessage,
      status: "Open",
      priority,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastReplyAt: nowIso,
      assignedAdminId: "",
      assignedAdminName: "Unassigned",
      adminNotes: "",
      attachments: Array.isArray(attachments) ? attachments : [],
      messages: [initialMsg]
    };
    db2.support_tickets.unshift(newTicket);
    writeDb(db2);
    try {
      await adminDb.collection("support_tickets").doc(newTicket.id).set(newTicket);
      console.log("SUPPORT_TICKET_FIRESTORE_SAVED", { ticketId: newTicket.id, userId });
    } catch (fsErr) {
      console.warn("Failed to write support ticket to Firestore:", fsErr?.message);
    }
    return res.json({ success: true, ticket: newTicket, ticketNumber });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create support ticket" });
  }
});
app.get("/api/support/tickets", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;
    const isAdmin = isCallerAdmin && req.query.isAdmin === "true";
    const queryUserId = req.query.userId || callerUid;
    const queryUserEmail = req.query.userEmail || callerEmail;
    try {
      let qSnap = null;
      if (isAdmin) {
        qSnap = await adminDb.collection("support_tickets").orderBy("createdAt", "desc").get();
      } else if (queryUserId) {
        qSnap = await adminDb.collection("support_tickets").where("userId", "==", queryUserId).get();
      } else if (queryUserEmail) {
        qSnap = await adminDb.collection("support_tickets").where("userEmail", "==", queryUserEmail.toLowerCase()).get();
      }
      if (qSnap && !qSnap.empty) {
        let fsTickets = qSnap.docs.map((doc) => doc.data());
        if (!isAdmin) {
          fsTickets = fsTickets.map((t) => {
            const { adminNotes, ...publicTicket } = t;
            return publicTicket;
          });
        }
        return res.json({ tickets: fsTickets });
      }
    } catch (fsErr) {
      console.warn("Firestore support tickets fetch warning:", fsErr?.message);
    }
    const db2 = readDb();
    let tickets = db2.support_tickets || [];
    if (isAdmin) {
      return res.json({ tickets });
    }
    if (queryUserId || queryUserEmail) {
      tickets = tickets.filter(
        (t) => queryUserId && t.userId === queryUserId || queryUserEmail && t.userEmail?.toLowerCase() === queryUserEmail.toLowerCase()
      );
    }
    const sanitizedTickets = tickets.map((t) => {
      const { adminNotes, ...publicTicket } = t;
      return publicTicket;
    });
    return res.json({ tickets: sanitizedTickets });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch support tickets" });
  }
});
app.get("/api/support/tickets/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid) return res.status(401).json({ error: "Unauthorized" });
    const isCallerAdmin = await isUserAdminServer(callerUid);
    let ticket = null;
    try {
      const tSnap = await adminDb.collection("support_tickets").doc(id).get();
      if (tSnap.exists) {
        ticket = tSnap.data();
      }
    } catch (e) {
    }
    if (!ticket) {
      const db2 = readDb();
      ticket = (db2.support_tickets || []).find((t) => t.id === id);
    }
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (!isCallerAdmin) {
      if (ticket.userId !== callerUid && ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden: You do not own this support ticket." });
      }
      const { adminNotes, ...publicTicket } = ticket;
      return res.json({ ticket: publicTicket });
    }
    return res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch support ticket" });
  }
});
app.post("/api/support/tickets/:id/messages", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;
    const { id } = req.params;
    let { senderId, senderType, senderName, senderEmail, message, attachments = [] } = req.body;
    if (!isCallerAdmin) {
      senderId = callerUid || senderId || "user";
      senderEmail = callerEmail || senderEmail || "";
      senderType = "user";
    }
    if (!message) {
      return res.status(400).json({ error: "Message text is required" });
    }
    const docRef = adminDb.collection("support_tickets").doc(id);
    let ticket = null;
    try {
      const tSnap = await docRef.get();
      if (tSnap.exists) {
        ticket = tSnap.data();
      }
    } catch (e) {
    }
    const db2 = readDb();
    let localTicket = (db2.support_tickets || []).find((t) => t.id === id);
    if (!ticket && localTicket) {
      ticket = localTicket;
    }
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (!isCallerAdmin) {
      if (ticket.userId !== callerUid && ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden: You do not own this support ticket." });
      }
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let recipientEmail = ticket.userEmail;
    let recipientName = ticket.userName || "Valued User";
    if (ticket.userId) {
      try {
        const uSnap = await adminDb.collection("users").doc(ticket.userId).get();
        if (uSnap.exists) {
          const uData = uSnap.data();
          if (uData?.email) recipientEmail = uData.email;
          if (uData?.ownerName || uData?.companyName) {
            recipientName = uData.ownerName || uData.companyName;
          }
        }
      } catch (uErr) {
        console.warn("Could not load user profile for support reply recipient:", uErr);
      }
    }
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: id,
      senderId: senderId || (senderType === "admin" ? "admin" : ticket.userId),
      senderType: senderType || "user",
      senderName: senderName || (senderType === "admin" ? "Zakir Support Team" : recipientName),
      senderEmail: senderEmail || (senderType === "admin" ? "support@zakir.ai" : recipientEmail),
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: nowIso
    };
    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(newMsg);
    ticket.updatedAt = nowIso;
    ticket.lastReplyAt = nowIso;
    if (senderType === "admin") {
      ticket.status = "Waiting for User";
    } else {
      if (ticket.status === "Waiting for User" || ticket.status === "Resolved") {
        ticket.status = "In Progress";
      }
    }
    try {
      await docRef.set(ticket, { merge: true });
      console.log("SUPPORT_REPLY_FIRESTORE_SAVED", { ticketId: id, senderType });
    } catch (fsErr) {
      console.warn("Firestore support message update warning:", fsErr?.message);
    }
    if (localTicket) {
      Object.assign(localTicket, ticket);
    } else {
      if (!db2.support_tickets) db2.support_tickets = [];
      db2.support_tickets.push(ticket);
    }
    writeDb(db2);
    if (senderType === "admin" && recipientEmail) {
      try {
        const { subject: emailSubject, text: emailText, html: emailHtml } = buildSupportReplyEmailHtml({
          recipientName,
          ticketId: String(ticket.id),
          ticketSubject: String(ticket.subject || "Support Ticket"),
          message: String(message)
        });
        await sendSystemMail({
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
          text: emailText
        });
        console.log("SUPPORT_REPLY_EMAIL_SENT", { recipientEmail, ticketId: id });
      } catch (mailErr) {
        console.error("ADMIN_SUPPORT_REPLY_EMAIL_FAILED", { recipientEmail, ticketId: id, error: mailErr?.message });
      }
    }
    return res.json({ success: true, message: newMsg, ticket });
  } catch (err) {
    console.error("ADMIN_SUPPORT_REPLY_FAILED", { ticketId: req.params.id, error: err?.message || String(err) });
    res.status(500).json({ error: err.message || "Failed to reply to support ticket" });
  }
});
app.patch("/api/support/tickets/:id", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const { id } = req.params;
    const { status, priority, adminNotes, assignedAdminId, assignedAdminName } = req.body;
    const docRef = adminDb.collection("support_tickets").doc(id);
    let ticket = null;
    try {
      const tSnap = await docRef.get();
      if (tSnap.exists) {
        ticket = tSnap.data();
      }
    } catch (e) {
    }
    const db2 = readDb();
    let localTicket = (db2.support_tickets || []).find((t) => t.id === id);
    if (!ticket && localTicket) {
      ticket = localTicket;
    }
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (adminNotes !== void 0) ticket.adminNotes = adminNotes;
    if (assignedAdminId !== void 0) ticket.assignedAdminId = assignedAdminId;
    if (assignedAdminName !== void 0) ticket.assignedAdminName = assignedAdminName;
    ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await docRef.set(ticket, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore patch support ticket warning:", fsErr?.message);
    }
    if (localTicket) {
      Object.assign(localTicket, ticket);
    }
    writeDb(db2);
    return res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update support ticket" });
  }
});
app.post("/api/sql/sync-user", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) {
      return res.status(400).json({ error: "Missing uid or email in auth token" });
    }
    const { companyName, role } = req.body;
    const isCallerAdmin = uid ? await isUserAdminServer(uid) : false;
    const resolvedRole = isCallerAdmin ? role || "CEO" : "Analyst";
    if (process.env.SQL_HOST) {
      try {
        const user2 = await getOrCreateUser(uid, email, companyName, resolvedRole);
        return res.json({ success: true, user: user2 });
      } catch (sqlErr) {
      }
    }
    const dbData = readDb();
    let user = dbData.users.find((u) => u.id === uid || u.email === email);
    if (!user) {
      user = {
        id: uid,
        email,
        companyName: companyName || "Enterprise Account",
        role: resolvedRole,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      dbData.users.push(user);
    } else {
      user.companyName = companyName || user.companyName;
      if (isCallerAdmin && role) {
        user.role = role;
      }
    }
    writeDb(dbData);
    res.json({ success: true, user });
  } catch (err) {
    res.json({ success: true, user: null });
  }
});
app.post("/api/sql/gmail-logs", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { actionType, recipient, subject, status } = req.body;
    if (!actionType || !status) {
      return res.status(400).json({ error: "actionType and status are required" });
    }
    if (process.env.SQL_HOST) {
      try {
        const dbUserList = await withRetry(() => db.select().from(users).where(eq(users.uid, uid)));
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const newLog = await withRetry(
            () => db.insert(gmailLogs).values({
              userId: dbUser.id,
              actionType,
              recipient: recipient || null,
              subject: subject || null,
              status
            }).returning()
          );
          return res.status(201).json({ success: true, log: newLog[0] });
        }
      } catch (sqlErr) {
      }
    }
    const dbData = readDb();
    if (!dbData.gmail_logs) dbData.gmail_logs = [];
    const localLog = {
      id: dbData.gmail_logs.length + 1,
      userId: uid,
      actionType,
      recipient: recipient || null,
      subject: subject || null,
      status,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    dbData.gmail_logs.unshift(localLog);
    writeDb(dbData);
    res.status(201).json({ success: true, log: localLog });
  } catch (err) {
    res.status(200).json({ success: true, log: null });
  }
});
app.get("/api/sql/gmail-logs", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (process.env.SQL_HOST) {
      try {
        const dbUserList = await withRetry(() => db.select().from(users).where(eq(users.uid, uid)));
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const logs = await withRetry(
            () => db.select().from(gmailLogs).where(eq(gmailLogs.userId, dbUser.id)).orderBy(desc(gmailLogs.createdAt)).limit(50)
          );
          return res.json(logs || []);
        }
      } catch (sqlErr) {
      }
    }
    const dbData = readDb();
    const userLogs = (dbData.gmail_logs || []).filter((l) => l.userId === uid || !l.userId);
    res.json(userLogs);
  } catch (err) {
    res.json([]);
  }
});
app.post("/api/email/send", requireAuth, emailLimiter, async (req, res) => {
  try {
    const { to, subject, body, html, googleAccessToken } = req.body;
    if (!to || !subject || !body && !html) {
      return res.status(400).json({ error: "Missing required fields: to, subject, and body or html" });
    }
    const cleanTo = String(to).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
      return res.status(400).json({ error: "Invalid recipient email address. Multiple recipients are strictly prohibited." });
    }
    const cleanSubject = String(subject).trim().replace(/[\r\n]/g, "");
    if (cleanSubject.length > 200) {
      return res.status(400).json({ error: "Subject must not exceed 200 characters." });
    }
    const emailBody = body ? String(body) : "";
    const emailHtmlRaw = html ? String(html) : "";
    if (emailBody.length > 1e5 || emailHtmlRaw.length > 1e5) {
      return res.status(400).json({ error: "Email body or HTML content exceeds the 100KB size limit." });
    }
    if (req.body.attachments || req.body.path) {
      return res.status(400).json({ error: "Attachments are not permitted via this endpoint." });
    }
    const authenticatedUserEmail = req.user?.email;
    if (!authenticatedUserEmail) {
      return res.status(401).json({ error: "Unauthorized: Authenticated user must have a verified email address." });
    }
    console.log(`[EMAIL SEND INITIATED] User: ${authenticatedUserEmail} sending to: ${cleanTo} with subject: ${cleanSubject}`);
    const emailHtml = html || `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">${emailBody.replace(/\n/g, "<br/>")}</div>`;
    const emailText = emailBody;
    if (googleAccessToken) {
      try {
        const emailContent = [
          `To: ${cleanTo}`,
          `Subject: ${cleanSubject}`,
          "Content-Type: text/html; charset=utf-8",
          "MIME-Version: 1.0",
          "",
          emailHtml
        ].join("\r\n");
        const encodedEmail = Buffer.from(emailContent).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: encodedEmail })
        });
        if (gmailRes.ok) {
          const gmailData = await gmailRes.json();
          return res.json({
            success: true,
            messageId: gmailData.id,
            provider: "Gmail API",
            message: "Email delivered via Gmail API"
          });
        } else {
          const errText = await gmailRes.text();
          console.warn("Gmail API direct send notice:", errText);
        }
      } catch (gErr) {
        console.warn("Gmail API direct send exception:", gErr);
      }
    }
    const systemSubject = `[Zakir User Email - From: ${authenticatedUserEmail}] ${cleanSubject}`;
    const mailResult = await sendSystemMail({ to: cleanTo, subject: systemSubject, html: emailHtml, text: emailText });
    if (!mailResult.success) {
      return res.status(500).json({ success: false, error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to deliver email" });
    }
    return res.json({
      success: true,
      messageId: mailResult.messageId,
      provider: mailResult.provider,
      senderUsed: mailResult.sender || "Zakir <noreply@getzakir.com>",
      result: mailResult,
      message: "Email delivered to recipient successfully"
    });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: err.message || "Failed to deliver email" });
  }
});
app.post("/api/email/send-verification-otp", requireAuth, async (req, res) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
      return res.status(400).json({ error: "Missing email or verification code" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const { subject, text: text2, html } = buildOtpEmailHtml({
      email: cleanEmail,
      otpCode: String(otpCode).trim(),
      type: "email_link"
    });
    console.log(`[EMAIL OTP SEND] Sending verification code to ${cleanEmail}`);
    const mailResult = await sendSystemMail({
      to: cleanEmail,
      subject,
      html,
      text: text2
    });
    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to send email verification code"
      });
    }
    return res.json({
      success: true,
      message: "Verification code sent successfully to " + cleanEmail
    });
  } catch (err) {
    console.error("Error sending verification email:", err);
    res.status(500).json({ error: err.message || "Failed to send verification code" });
  }
});
app.get("/api/admin/users", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication context" });
    }
    const isCallerAdmin = await isUserAdminServer(callerUid);
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const snap = await adminDb.collection("users").get();
    const fsUsers = snap && !snap.empty && snap.docs ? snap.docs.map((doc) => ({ ...doc.data(), id: doc.id })) : [];
    return res.json({ success: true, users: fsUsers });
  } catch (err) {
    console.error("Error fetching admin users from Firestore Admin SDK:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch users list" });
  }
});
async function getAccountLifecycleRecord(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  try {
    const docRef = adminDb.collection("accountLifecycle").doc(normalizedEmail);
    const docSnap = await docRef.get();
    let record = null;
    if (docSnap.exists) {
      record = docSnap.data();
    } else {
      const db2 = readDb();
      if (!db2.account_lifecycle) db2.account_lifecycle = [];
      record = db2.account_lifecycle.find((r) => r.emailNormalized === normalizedEmail);
    }
    if (!record) {
      try {
        const delSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).limit(1).get();
        if (!delSnap.empty) {
          const dData = delSnap.docs[0].data();
          const deletedAt = dData.deletedAt || (/* @__PURE__ */ new Date()).toISOString();
          const restoreUntil = new Date(new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1e3).toISOString();
          record = {
            accountId: normalizedEmail,
            emailNormalized: normalizedEmail,
            status: dData.reason === "admin_deleted" ? "ADMIN_DELETED" : "SELF_DELETED",
            deletionType: dData.reason === "admin_deleted" ? "admin" : "self",
            deletedAt,
            restoreUntil,
            originalUserId: dData.uid || delSnap.docs[0].id,
            adminApprovalRequired: dData.reason === "admin_deleted"
          };
        }
      } catch (e) {
      }
    }
    if (!record) {
      try {
        const db2 = readDb();
        const retUser = db2.retained_users?.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);
        if (retUser) {
          const archivedAt = retUser.archivedAt || retUser.deletedAt || (/* @__PURE__ */ new Date()).toISOString();
          const restoreUntil = new Date(new Date(archivedAt).getTime() + 31 * 24 * 60 * 60 * 1e3).toISOString();
          record = {
            accountId: normalizedEmail,
            emailNormalized: normalizedEmail,
            status: "SELF_DELETED",
            deletionType: "self",
            deletedAt: archivedAt,
            restoreUntil,
            originalUserId: retUser.id,
            adminApprovalRequired: false
          };
        }
      } catch (e) {
      }
    }
    if (!record) return null;
    if (record.deletionType === "self" && record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      if (nowMs > restoreUntilMs) {
        console.log(`[LIFECYCLE PURGE] Self-deleted account ${normalizedEmail} expired 31-day window. Purging retained user data.`);
        if (record.originalUserId) {
          try {
            await purgeRetainedUserDataServer(record.originalUserId);
          } catch (pErr) {
            console.warn("Purge retained data error:", pErr);
          }
        }
        const purgedFields = {
          status: "PURGED",
          deletionType: "self",
          purgedAt: (/* @__PURE__ */ new Date()).toISOString(),
          retainedDataDocPath: null,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        try {
          await docRef.set(purgedFields, { merge: true });
        } catch (e) {
        }
        record = { ...record, ...purgedFields };
        const db2 = readDb();
        if (!db2.account_lifecycle) db2.account_lifecycle = [];
        const idx = db2.account_lifecycle.findIndex((r) => r.emailNormalized === normalizedEmail);
        if (idx >= 0) db2.account_lifecycle[idx] = record;
        else db2.account_lifecycle.push(record);
        writeDb(db2);
      }
    }
    if (record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      const remainingMs = restoreUntilMs - nowMs;
      if (remainingMs > 0) {
        record.canRestore = true;
        record.daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1e3)));
      } else {
        record.canRestore = false;
        record.daysRemaining = 0;
      }
    }
    return record;
  } catch (err) {
    console.error("getAccountLifecycleRecord error:", err);
    return null;
  }
}
async function setAccountLifecycleRecord(record) {
  if (!record || !record.emailNormalized) return;
  const normalizedEmail = record.emailNormalized.trim().toLowerCase();
  const docRef = adminDb.collection("accountLifecycle").doc(normalizedEmail);
  const payload = {
    ...record,
    emailNormalized: normalizedEmail,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    await docRef.set(payload, { merge: true });
  } catch (err) {
    console.error("setAccountLifecycleRecord Firestore error:", err);
  }
  try {
    const db2 = readDb();
    if (!db2.account_lifecycle) db2.account_lifecycle = [];
    const idx = db2.account_lifecycle.findIndex((r) => r.emailNormalized === normalizedEmail);
    if (idx >= 0) db2.account_lifecycle[idx] = { ...db2.account_lifecycle[idx], ...payload };
    else db2.account_lifecycle.push(payload);
    writeDb(db2);
  } catch (err) {
    console.warn("setAccountLifecycleRecord local DB error:", err);
  }
}
async function purgeRetainedUserDataServer(userId) {
  if (!userId) return;
  try {
    const memSnap = await adminDb.collection("users_retained").doc(userId).collection("memories").get();
    for (const d of memSnap.docs) await d.ref.delete();
    const alertSnap = await adminDb.collection("users_retained").doc(userId).collection("riskAlerts").get();
    for (const d of alertSnap.docs) await d.ref.delete();
    const fileSnap = await adminDb.collection("users_retained").doc(userId).collection("files").get();
    for (const d of fileSnap.docs) await d.ref.delete();
    const topFileSnap = await adminDb.collection("users_retained").doc(userId).collection("top_files").get();
    for (const d of topFileSnap.docs) await d.ref.delete();
    await adminDb.collection("users_retained").doc(userId).delete();
    const db2 = readDb();
    if (db2.retained_users) {
      db2.retained_users = db2.retained_users.filter((u) => u.id !== userId);
      writeDb(db2);
    }
    console.log(`[PURGE COMPLETE] Retained user data for ${userId} purged permanently.`);
  } catch (err) {
    console.warn("purgeRetainedUserDataServer warning:", err);
  }
}
async function purgeExpiredAccountsJob() {
  try {
    if (isFirebaseAdminAvailable) {
      const snap = await adminDb.collection("accountLifecycle").where("deletionType", "==", "self").where("status", "==", "SELF_DELETED").get();
      if (snap && !snap.empty) {
        const nowMs = Date.now();
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.restoreUntil && nowMs > new Date(data.restoreUntil).getTime()) {
            console.log(`[BACKGROUND PURGE] Expired account lifecycle ${docSnap.id}`);
            await getAccountLifecycleRecord(docSnap.id);
          }
        }
      }
    }
  } catch (e) {
    if (!e?.message?.includes("PERMISSION_DENIED") && e?.code !== 7) {
      console.warn("purgeExpiredAccountsJob background error:", e);
    }
  }
  try {
    const db2 = readDb();
    if (db2.account_lifecycle && Array.isArray(db2.account_lifecycle)) {
      const nowMs = Date.now();
      for (const record of db2.account_lifecycle) {
        if (record.deletionType === "self" && record.status === "SELF_DELETED" && record.restoreUntil) {
          if (nowMs > new Date(record.restoreUntil).getTime()) {
            console.log(`[BACKGROUND PURGE LOCAL] Expired account lifecycle ${record.emailNormalized}`);
            await getAccountLifecycleRecord(record.emailNormalized);
          }
        }
      }
    }
  } catch (err) {
  }
}
async function restoreAccountFullServer(email, newPassword) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return { success: false, error: "Email parameter is required." };
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  const targetUid = lifecycle?.originalUserId;
  let retainedProfile = null;
  if (targetUid) {
    try {
      const rSnap = await adminDb.collection("users_retained").doc(targetUid).get();
      if (rSnap.exists) retainedProfile = rSnap.data();
    } catch (e) {
    }
  }
  if (!retainedProfile) {
    try {
      const db2 = readDb();
      retainedProfile = db2.retained_users?.find(
        (u) => targetUid && u.id === targetUid || u.email?.trim().toLowerCase() === normalizedEmail
      );
    } catch (e) {
    }
  }
  let finalUid = targetUid || retainedProfile?.id;
  let authUser = null;
  if (finalUid) {
    try {
      authUser = await adminAuth.getUser(finalUid);
    } catch (e) {
    }
  }
  if (!authUser && normalizedEmail) {
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (authUser) finalUid = authUser.uid;
    } catch (e) {
    }
  }
  if (!finalUid) {
    finalUid = `usr_${Date.now().toString(36)}`;
  }
  if (authUser) {
    const updatePayload = { disabled: false, emailVerified: false };
    if (newPassword && newPassword.trim()) {
      updatePayload.password = newPassword.trim();
    }
    try {
      await adminAuth.updateUser(authUser.uid, updatePayload);
      const checkAuth = await adminAuth.getUser(authUser.uid);
      const hasPasswordProvider = checkAuth.providerData.some((p) => p.providerId === "password");
      console.log(`[RESTORE_FULL] Firebase Auth user ${authUser.uid} re-enabled: disabled=${checkAuth.disabled}, emailVerified=${checkAuth.emailVerified}, hasPasswordProvider=${hasPasswordProvider}`);
    } catch (uErr) {
      console.warn(`[RESTORE_FULL] Warning updating Firebase Auth user ${authUser.uid}:`, uErr?.message);
    }
  } else {
    try {
      const createPayload = {
        uid: finalUid,
        email: normalizedEmail,
        emailVerified: false,
        displayName: retainedProfile?.ownerName || retainedProfile?.companyName || normalizedEmail.split("@")[0]
      };
      if (newPassword && newPassword.trim()) {
        createPayload.password = newPassword.trim();
      } else {
        createPayload.password = "RestoredPass_" + Math.random().toString(36).substring(2, 8) + "123!";
      }
      authUser = await adminAuth.createUser(createPayload);
      console.log(`[RESTORE_FULL] Created Firebase Auth user ${finalUid}`);
    } catch (cErr) {
      console.warn(`[RESTORE_FULL] Firebase Auth user creation warning for ${finalUid}:`, cErr?.message);
    }
  }
  try {
    if (finalUid) {
      await adminDb.collection("deletedUsers").doc(finalUid).delete();
    }
    const delEmailSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).get();
    for (const dDoc of delEmailSnap.docs) {
      await dDoc.ref.delete();
    }
  } catch (dErr) {
    console.warn("[RESTORE_FULL] Deleted marker removal warning:", dErr);
  }
  const preservedRole = retainedProfile?.role || "CEO";
  const preservedWorkspaceId = retainedProfile?.workspaceId || retainedProfile?.workspace?.id || `ws_${finalUid.substring(0, 8)}`;
  const preservedWorkspace = retainedProfile?.workspace || {
    id: preservedWorkspaceId,
    name: `${retainedProfile?.companyName || "Restored"} Workspace`,
    ownerId: finalUid,
    createdAt: retainedProfile?.createdAt || nowIso,
    memberCount: 1
  };
  const restoredUserDoc = {
    ...retainedProfile || {},
    id: finalUid,
    uid: finalUid,
    email: normalizedEmail,
    role: preservedRole,
    workspaceId: preservedWorkspaceId,
    workspace: preservedWorkspace,
    powers: retainedProfile?.powers,
    companyName: retainedProfile?.companyName || "Restored Account",
    ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
    subscriptionStatus: retainedProfile?.subscriptionStatus || "Active",
    userPreferences: retainedProfile?.userPreferences || { theme: "light", language: "ar" },
    status: "VERIFICATION_REQUIRED",
    accountStatus: "active",
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    isVerified: false,
    isEmailVerified: false,
    emailVerified: false,
    email_verified: false,
    verification_status: "unverified",
    verification_required: true,
    lastActiveAt: nowIso,
    lastLoginAt: nowIso,
    restoredAt: nowIso
  };
  try {
    await adminDb.collection("users").doc(finalUid).set(restoredUserDoc, { merge: true });
    console.log(`[RESTORE_FULL] Saved restored user profile to Firestore users/${finalUid}`);
  } catch (fsErr) {
    console.error("[RESTORE_FULL] Failed to save Firestore user profile:", fsErr);
  }
  if (retainedProfile) {
    try {
      const memSnap = await adminDb.collection("users_retained").doc(finalUid).collection("memories").get();
      for (const mDoc of memSnap.docs) {
        await adminDb.collection("users").doc(finalUid).collection("memories").doc(mDoc.id).set(mDoc.data(), { merge: true });
      }
      const alertSnap = await adminDb.collection("users_retained").doc(finalUid).collection("riskAlerts").get();
      for (const aDoc of alertSnap.docs) {
        await adminDb.collection("users").doc(finalUid).collection("riskAlerts").doc(aDoc.id).set(aDoc.data(), { merge: true });
      }
    } catch (subErr) {
    }
  }
  try {
    const db2 = readDb();
    if (!db2.users) db2.users = [];
    db2.users = db2.users.filter((u) => u.id !== finalUid && u.email?.trim().toLowerCase() !== normalizedEmail);
    db2.users.push(restoredUserDoc);
    if (db2.retained_users) {
      db2.retained_users = db2.retained_users.filter((u) => u.id !== finalUid && u.email?.trim().toLowerCase() !== normalizedEmail);
    }
    writeDb(db2);
  } catch (dbErr) {
  }
  const activeLifecycle = {
    accountId: normalizedEmail,
    emailNormalized: normalizedEmail,
    status: "ACTIVE",
    deletionType: null,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    originalUserId: finalUid,
    updatedAt: nowIso
  };
  await setAccountLifecycleRecord(activeLifecycle);
  return { success: true, user: restoredUserDoc };
}
if (!isServerless) {
  const tPurge = setInterval(purgeExpiredAccountsJob, 60 * 60 * 1e3);
  if (tPurge?.unref) tPurge.unref();
  const tStartup = setTimeout(purgeExpiredAccountsJob, 5e3);
  if (tStartup?.unref) tStartup.unref();
}
app.post("/api/auth/check-lifecycle", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const record = await getAccountLifecycleRecord(normalizedEmail);
    if (!record || record.status === "PURGED") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: record?.status === "PURGED" ? "PURGED" : "NEW",
        canRegister: true,
        canRestore: false,
        adminApprovalRequired: false,
        userFriendlyMessage: ""
      });
    }
    if (record.status === "ACTIVE") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ACTIVE",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: false,
        userFriendlyMessage: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u062D\u0633\u0627\u0628\u0643."
      });
    }
    if (record.status === "ADMIN_APPROVED" || record.reactivationStatus === "approved") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_APPROVED",
        canRegister: false,
        canRestore: true,
        adminApprovalRequired: false,
        userFriendlyMessage: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0633\u0627\u0628\u0643 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0633\u0624\u0648\u0644! \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628."
      });
    }
    if (record.status === "ADMIN_DELETED" || record.status === "ADMIN_APPROVAL_REQUIRED" || record.deletionType === "admin") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_DELETED",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: true,
        userFriendlyMessage: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628\u0643 \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629. \u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u062C\u062F\u064A\u062F \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0625\u0644\u0627 \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644."
      });
    }
    if (record.status === "ADMIN_APPROVAL_PENDING") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_APPROVAL_PENDING",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: true,
        userFriendlyMessage: "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u062D\u064A\u0646 \u0627\u0644\u0628\u062A \u0641\u064A \u0627\u0644\u0637\u0644\u0628."
      });
    }
    if (record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      const remainingMs = restoreUntilMs - nowMs;
      if (remainingMs > 0) {
        const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1e3)));
        return res.json({
          success: true,
          email: normalizedEmail,
          status: "SELF_RESTORE_AVAILABLE",
          canRegister: false,
          canRestore: true,
          adminApprovalRequired: false,
          daysRemaining,
          restoreUntil: record.restoreUntil,
          userFriendlyMessage: `\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0633\u0627\u0628\u0642 \u062A\u0645 \u062D\u0630\u0641\u0647 \u0628\u0648\u0627\u0633\u0637\u062A\u0643. \u064A\u0645\u0643\u0646\u0643 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0633\u0627\u0628\u0643 \u0648\u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 (\u0645\u062A\u0628\u0642\u064A ${daysRemaining} \u064A\u0648\u0645\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629).`
        });
      } else {
        return res.json({
          success: true,
          email: normalizedEmail,
          status: "RESTORE_EXPIRED",
          canRegister: true,
          canRestore: false,
          adminApprovalRequired: false,
          daysRemaining: 0,
          userFriendlyMessage: "\u0627\u0646\u062A\u0647\u062A \u0641\u062A\u0631\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0634\u0643\u0644 \u0646\u0647\u0627\u0626\u064A \u0648\u0644\u0645 \u064A\u0639\u062F \u0642\u0627\u0628\u0644\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0648\u0641\u0642 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0646\u0638\u0627\u0645."
        });
      }
    }
    if (record.status === "PURGED") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "RESTORE_EXPIRED",
        canRegister: true,
        canRestore: false,
        adminApprovalRequired: false,
        daysRemaining: 0,
        userFriendlyMessage: "\u0627\u0646\u062A\u0647\u062A \u0641\u062A\u0631\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0634\u0643\u0644 \u0646\u0647\u0627\u0626\u064A \u0648\u0644\u0645 \u064A\u0639\u062F \u0642\u0627\u0628\u0644\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0648\u0641\u0642 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0646\u0638\u0627\u0645."
      });
    }
    return res.json({
      success: true,
      email: normalizedEmail,
      status: "NEW",
      canRegister: true,
      canRestore: false,
      adminApprovalRequired: false,
      userFriendlyMessage: ""
    });
  } catch (err) {
    console.error("check-lifecycle error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to check account lifecycle state." });
  }
});
async function requestAccountReactivationServer(email, reason) {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await getAccountLifecycleRecord(normalizedEmail);
  if (!record || record.status !== "ADMIN_DELETED" && record.status !== "ADMIN_APPROVAL_REQUIRED" && record.deletionType !== "admin") {
    return {
      success: false,
      error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062D\u0630\u0648\u0641 \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629 \u0623\u0648 \u0644\u0627 \u064A\u062A\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644."
    };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updatedRecord = {
    ...record,
    status: "ADMIN_APPROVAL_PENDING",
    reactivationRequestedAt: nowIso,
    reactivationRequestReason: reason || "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062D\u0630\u0648\u0641 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644",
    reactivationStatus: "pending",
    updatedAt: nowIso
  };
  await setAccountLifecycleRecord(updatedRecord);
  try {
    await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).set({
      email: normalizedEmail,
      requestedAt: nowIso,
      reason: reason || "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062D\u0630\u0648\u0641 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644",
      status: "pending",
      originalUserId: record.originalUserId || ""
    });
  } catch (e) {
  }
  const db2 = readDb();
  if (!db2.account_reactivation_requests) db2.account_reactivation_requests = [];
  db2.account_reactivation_requests = db2.account_reactivation_requests.filter((r) => r.email !== normalizedEmail);
  db2.account_reactivation_requests.push({
    email: normalizedEmail,
    requestedAt: nowIso,
    reason: reason || "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062D\u0630\u0648\u0641 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644",
    status: "pending"
  });
  writeDb(db2);
  return {
    success: true,
    message: "\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629. \u0633\u064A\u062A\u0645 \u0645\u0631\u0627\u062C\u0639\u0629 \u0637\u0644\u0628\u0643 \u0648\u0625\u062E\u0637\u0627\u0631\u0643 \u0628\u0627\u0644\u062A\u062D\u062F\u064A\u062B\u0627\u062A."
  };
}
app.post("/api/auth/request-reactivation", async (req, res) => {
  try {
    const { email, reason } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const result = await requestAccountReactivationServer(email, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("request-reactivation error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to submit reactivation request." });
  }
});
app.post("/api/auth/restore-account", async (req, res) => {
  try {
    const { email, code, verificationCode, password } = req.body;
    const inputCode = (code || verificationCode || "").trim();
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const record = await getAccountLifecycleRecord(normalizedEmail);
    if (!record || record.status !== "SELF_RESTORE_AVAILABLE" && record.status !== "SELF_DELETED") {
      if (record && (record.status === "PURGED" || record.restoreUntil && Date.now() > new Date(record.restoreUntil).getTime())) {
        return res.status(400).json({
          success: false,
          code: "RESTORE_EXPIRED",
          error: "\u0627\u0646\u062A\u0647\u062A \u0641\u062A\u0631\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0634\u0643\u0644 \u0646\u0647\u0627\u0626\u064A \u0648\u0644\u0645 \u064A\u0639\u062F \u0642\u0627\u0628\u0644\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0648\u0641\u0642 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0646\u0638\u0627\u0645."
        });
      }
      return res.status(400).json({
        success: false,
        error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0645\u062D\u0630\u0648\u0641 \u0642\u0627\u0628\u0644 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A."
      });
    }
    if (record.restoreUntil && Date.now() > new Date(record.restoreUntil).getTime()) {
      return res.status(400).json({
        success: false,
        code: "RESTORE_EXPIRED",
        error: "\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 31 \u064A\u0648\u0645\u0627\u064B \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0634\u0643\u0644 \u0646\u0647\u0627\u0626\u064A."
      });
    }
    const userId = record.originalUserId || `usr_${Date.now().toString(36)}`;
    if (!inputCode) {
      return res.status(400).json({
        success: false,
        code: "OTP_REQUIRED",
        error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0631\u0633\u0644 \u0625\u0644\u0649 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0644\u0643\u064A\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0627\u0633\u062A\u0639\u0627\u062F\u062A\u0647."
      });
    }
    let activeOtpRecord = null;
    try {
      const vcSnap = await adminDb.collection("verification_codes").doc(userId).get();
      if (vcSnap.exists && !vcSnap.data()?.used) {
        activeOtpRecord = { ...vcSnap.data(), _docId: userId };
      }
    } catch (e) {
    }
    if (!activeOtpRecord) {
      try {
        const vcEmailSnap = await adminDb.collection("verification_codes").doc(normalizedEmail).get();
        if (vcEmailSnap.exists && !vcEmailSnap.data()?.used) {
          activeOtpRecord = { ...vcEmailSnap.data(), _docId: normalizedEmail };
        }
      } catch (e) {
      }
    }
    if (!activeOtpRecord) {
      try {
        const qSnap = await adminDb.collection("verification_codes").where("email", "==", normalizedEmail).where("used", "==", false).get();
        if (!qSnap.empty) {
          activeOtpRecord = { ...qSnap.docs[0].data(), _docId: qSnap.docs[0].id };
        }
      } catch (e) {
      }
    }
    if (!activeOtpRecord) {
      const db2 = readDb();
      activeOtpRecord = db2.verification_codes?.find(
        (vc) => !vc.used && (vc.id === userId || vc.id === normalizedEmail || vc.userId === userId || vc.email?.toLowerCase() === normalizedEmail)
      );
      if (activeOtpRecord) {
        activeOtpRecord._docId = activeOtpRecord.id;
      }
    }
    if (!activeOtpRecord) {
      return res.status(400).json({
        success: false,
        error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0646\u0634\u0637 \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
      });
    }
    const expiresAt = activeOtpRecord.expiresAt?.toDate ? activeOtpRecord.expiresAt.toDate() : new Date(activeOtpRecord.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
      });
    }
    if ((activeOtpRecord.attempts || 0) >= 5) {
      return res.status(400).json({
        success: false,
        error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
      });
    }
    const cleanInputHash = hashVerificationCode(inputCode);
    const isOtpMatch = activeOtpRecord.codeHash ? activeOtpRecord.codeHash === cleanInputHash : activeOtpRecord.code === inputCode;
    if (!isOtpMatch) {
      const newAttempts = (activeOtpRecord.attempts || 0) + 1;
      const remaining = Math.max(0, 5 - newAttempts);
      try {
        if (activeOtpRecord._docId) {
          await adminDb.collection("verification_codes").doc(activeOtpRecord._docId).update({ attempts: newAttempts });
        }
      } catch (e) {
      }
      return res.status(400).json({
        success: false,
        error: `\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D. \u0645\u062A\u0628\u0642\u064A ${remaining} \u0645\u062D\u0627\u0648\u0644\u0629.`
      });
    }
    try {
      if (activeOtpRecord._docId) {
        await adminDb.collection("verification_codes").doc(activeOtpRecord._docId).update({
          used: true,
          verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (e) {
    }
    let retainedProfile = null;
    try {
      const retainedSnap = await adminDb.collection("users_retained").doc(userId).get();
      if (retainedSnap.exists) {
        retainedProfile = retainedSnap.data();
      }
    } catch (e) {
    }
    if (!retainedProfile) {
      const db2 = readDb();
      retainedProfile = db2.retained_users?.find((u) => u.id === userId || u.email?.toLowerCase() === normalizedEmail);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const preservedRole = retainedProfile?.role || "CEO";
    const preservedWorkspace = retainedProfile?.workspace || {
      id: retainedProfile?.workspaceId || `ws_${userId.substring(0, 8)}`,
      name: `${retainedProfile?.companyName || "Restored"} Workspace`,
      ownerId: userId,
      createdAt: retainedProfile?.createdAt || nowIso,
      memberCount: 1
    };
    const restoredUserDoc = {
      ...retainedProfile || {},
      id: userId,
      email: normalizedEmail,
      role: preservedRole,
      workspaceId: retainedProfile?.workspaceId || preservedWorkspace.id,
      workspace: preservedWorkspace,
      powers: retainedProfile?.powers,
      companyName: retainedProfile?.companyName || "Restored Account",
      ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
      subscriptionStatus: retainedProfile?.subscriptionStatus || "Active Trial",
      userPreferences: retainedProfile?.userPreferences || { theme: "light", language: "ar" },
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      email_verified: true,
      verification_status: "verified",
      verification_required: false,
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      restoredAt: nowIso
    };
    try {
      await adminDb.collection("deletedUsers").doc(userId).delete();
      const delEmailSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).get();
      for (const d of delEmailSnap.docs) {
        await d.ref.delete();
      }
    } catch (e) {
      console.warn("Deleted marker removal warning:", e);
    }
    let customToken = "";
    try {
      await adminAuth.getUser(userId);
      if (password) {
        await adminAuth.updateUser(userId, { password, emailVerified: true });
      } else {
        await adminAuth.updateUser(userId, { emailVerified: true });
      }
      try {
        customToken = await adminAuth.createCustomToken(userId);
      } catch (tErr) {
      }
    } catch (authErr) {
      if (authErr.code === "auth/user-not-found") {
        try {
          await adminAuth.createUser({
            uid: userId,
            email: normalizedEmail,
            password: password || "Zakir@2026Restored",
            displayName: restoredUserDoc.ownerName || restoredUserDoc.companyName || normalizedEmail.split("@")[0],
            emailVerified: true
          });
          try {
            customToken = await adminAuth.createCustomToken(userId);
          } catch (tErr) {
          }
        } catch (cErr) {
        }
      }
    }
    try {
      await adminDb.collection("users").doc(userId).set(restoredUserDoc);
    } catch (fsErr) {
      console.warn("Restore profile doc write error:", fsErr);
    }
    try {
      const retainedMemSnap = await adminDb.collection("users_retained").doc(userId).collection("memories").get();
      for (const mDoc of retainedMemSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("memories").doc(mDoc.id).set(mDoc.data());
      }
    } catch (e) {
    }
    try {
      const retainedAlertSnap = await adminDb.collection("users_retained").doc(userId).collection("riskAlerts").get();
      for (const aDoc of retainedAlertSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("riskAlerts").doc(aDoc.id).set(aDoc.data());
      }
    } catch (e) {
    }
    try {
      const retainedFilesSnap = await adminDb.collection("users_retained").doc(userId).collection("files").get();
      for (const fDoc of retainedFilesSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("files").doc(fDoc.id).set(fDoc.data());
      }
      const retainedTopFilesSnap = await adminDb.collection("users_retained").doc(userId).collection("top_files").get();
      for (const tfDoc of retainedTopFilesSnap.docs) {
        await adminDb.collection("files").doc(tfDoc.id).set(tfDoc.data());
      }
    } catch (e) {
    }
    const dbInst = readDb();
    if (retainedProfile?.archivedMemories?.length) {
      if (!dbInst.memories) dbInst.memories = [];
      dbInst.memories = dbInst.memories.filter((m) => m.userId !== userId);
      dbInst.memories.push(...retainedProfile.archivedMemories);
    }
    if (retainedProfile?.archivedRiskAlerts?.length) {
      if (!dbInst.risk_alerts) dbInst.risk_alerts = [];
      dbInst.risk_alerts = dbInst.risk_alerts.filter((a) => a.userId !== userId);
      dbInst.risk_alerts.push(...retainedProfile.archivedRiskAlerts);
    }
    if (retainedProfile?.archivedFiles?.length) {
      if (!dbInst.files) dbInst.files = [];
      dbInst.files = dbInst.files.filter((f) => f.userId !== userId);
      dbInst.files.push(...retainedProfile.archivedFiles);
    }
    if (!dbInst.users) dbInst.users = [];
    dbInst.users = dbInst.users.filter((u) => u.id !== userId && u.email?.toLowerCase() !== normalizedEmail);
    dbInst.users.push(restoredUserDoc);
    writeDb(dbInst);
    try {
      await purgeRetainedUserDataServer(userId);
    } catch (e) {
    }
    const activeRecord = {
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      originalUserId: userId,
      retainedDataDocPath: null,
      updatedAt: nowIso
    };
    await setAccountLifecycleRecord(activeRecord);
    console.log("ACCOUNT_RESTORED_SUCCESSFULLY", { userId, email: normalizedEmail, role: restoredUserDoc.role });
    return res.json({
      success: true,
      message: "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0633\u0627\u0628\u0643 \u0648\u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0628\u0646\u062C\u0627\u062D! \u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0639\u0648\u062F\u062A\u0643 \u0625\u0644\u0649 Zakir.",
      user: restoredUserDoc,
      customToken: customToken || void 0
    });
  } catch (err) {
    console.error("restore-account error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to restore account." });
  }
});
app.get("/api/auth/check-invitation", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.json({ success: true, invitation: null });
    }
    let invitation = null;
    try {
      const docSnap = await adminDb.collection("invitations").doc(email).get();
      if (docSnap.exists) {
        invitation = docSnap.data();
      }
    } catch (e) {
    }
    if (!invitation) {
      const db2 = readDb();
      invitation = db2.invitations?.find((i) => i.email?.trim().toLowerCase() === email) || null;
    }
    return res.json({ success: true, invitation });
  } catch (err) {
    return res.json({ success: true, invitation: null });
  }
});
app.get("/api/admin/reactivation-requests", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !await isUserAdminServer(callerUid)) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    const snap = await adminDb.collection("accountReactivationRequests").get();
    let requests = [];
    if (snap && !snap.empty) {
      requests = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    }
    const db2 = readDb();
    const localRequests = db2.account_reactivation_requests || [];
    for (const lr of localRequests) {
      if (!requests.some((r) => r.email === lr.email)) {
        requests.push(lr);
      }
    }
    return res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch reactivation requests." });
  }
});
async function handleAccountReactivationRequestServer(email, action, callerUid = "admin", notes = "") {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await getAccountLifecycleRecord(normalizedEmail);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (action === "approve") {
    const updatedLifecycle = {
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      adminApprovalRequired: false,
      reactivationStatus: "approved",
      approvedAt: nowIso,
      approvedBy: callerUid,
      notes: notes || "",
      updatedAt: nowIso
    };
    await setAccountLifecycleRecord(updatedLifecycle);
    try {
      await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).update({
        status: "approved",
        reviewedAt: nowIso,
        reviewedBy: callerUid,
        notes: notes || ""
      });
    } catch (e) {
    }
    const db2 = readDb();
    if (db2.account_reactivation_requests) {
      const reqItem = db2.account_reactivation_requests.find((r) => r.email === normalizedEmail);
      if (reqItem) {
        reqItem.status = "approved";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db2);
    return {
      success: true,
      message: "\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0628\u0646\u062C\u0627\u062D. \u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0622\u0646 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u062C\u062F\u064A\u062F \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A."
    };
  } else {
    const updatedLifecycle = {
      ...record,
      status: "ADMIN_DELETED",
      adminApprovalRequired: true,
      reactivationStatus: "rejected",
      rejectedAt: nowIso,
      rejectedBy: callerUid,
      notes: notes || "",
      updatedAt: nowIso
    };
    await setAccountLifecycleRecord(updatedLifecycle);
    try {
      await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).update({
        status: "rejected",
        reviewedAt: nowIso,
        reviewedBy: callerUid,
        notes: notes || ""
      });
    } catch (e) {
    }
    const db2 = readDb();
    if (db2.account_reactivation_requests) {
      const reqItem = db2.account_reactivation_requests.find((r) => r.email === normalizedEmail);
      if (reqItem) {
        reqItem.status = "rejected";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db2);
    return {
      success: true,
      message: "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0641\u0639\u064A\u0644. \u064A\u0638\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u062D\u0638\u0648\u0631\u0627\u064B \u0645\u0646 \u0627\u0644\u062A\u0633\u062C\u064A\u0644."
    };
  }
}
app.post("/api/admin/handle-reactivation-request", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !await isUserAdminServer(callerUid)) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    const { email, action, notes } = req.body;
    if (!email || !action || action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Email and valid action ('approve' or 'reject') are required." });
    }
    const result = await handleAccountReactivationRequestServer(email, action, callerUid, notes);
    return res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to handle reactivation request." });
  }
});
function validateFileSignature(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  const hex = buffer.toString("hex", 0, 4).toLowerCase();
  if (mimeType.includes("pdf")) {
    return hex.startsWith("25504446");
  }
  if (mimeType.includes("png")) {
    return hex.startsWith("89504e47");
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return hex.startsWith("ffd8ff");
  }
  return false;
}
var recoveryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit
  }
});
var CHUNK_BYTE_SIZE = 300 * 1024;
var RECOVERY_DOC_RETENTION_MS = 14 * 24 * 60 * 60 * 1e3;
var ORPHAN_UPLOAD_TTL_MS = 60 * 60 * 1e3;
function getLocalUploadsDir() {
  const base = isServerless ? os.tmpdir() : process.cwd();
  return path3.join(base, "secure_uploads");
}
function saveToLocalDiskCache(documentId, buffer) {
  try {
    const dir = getLocalUploadsDir();
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    fs3.writeFileSync(path3.join(dir, documentId), buffer);
  } catch (err) {
    console.warn("[Recovery Storage] Local disk cache write notice:", err?.message || err);
  }
}
function getFromLocalDiskCache(documentId) {
  try {
    const candidatePaths = [
      path3.join(getLocalUploadsDir(), documentId),
      path3.join(os.tmpdir(), "secure_uploads", documentId),
      path3.join(process.cwd(), "secure_uploads", documentId)
    ];
    for (const p of candidatePaths) {
      if (fs3.existsSync(p)) {
        return fs3.readFileSync(p);
      }
    }
  } catch (err) {
  }
  return null;
}
async function saveDocumentToPersistentStorage(documentId, buffer, mimeType, meta) {
  saveToLocalDiskCache(documentId, buffer);
  const totalChunks = Math.ceil(buffer.length / CHUNK_BYTE_SIZE);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + RECOVERY_DOC_RETENTION_MS).toISOString();
  console.log("[RecoveryUpload] chunk generation started");
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      console.log("[RecoveryUpload] metadata persistence started");
      await adminDb.collection("recoveryDocuments").doc(documentId).set({
        documentId,
        mimeType,
        size: buffer.length,
        totalChunks,
        fileName: meta?.fileName || "document",
        fileHash: meta?.fileHash || "",
        storageStatus: "pending",
        syncAttempts: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAt: expiresAtIso
      });
      console.log("[RecoveryUpload] metadata persisted");
      console.log("[RecoveryUpload] Firestore chunk persistence started");
      const chunkPromises = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_BYTE_SIZE;
        const end = Math.min(start + CHUNK_BYTE_SIZE, buffer.length);
        const chunkData = buffer.subarray(start, end).toString("base64");
        chunkPromises.push(
          adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").doc(String(i)).set({
            chunkIndex: i,
            data: chunkData,
            size: end - start,
            createdAt: nowIso,
            expiresAt: expiresAtIso
          })
        );
      }
      await Promise.all(chunkPromises);
      console.log("[RecoveryUpload] Firestore chunks persisted");
    } catch (fsErr) {
      console.error("[RecoveryUpload] FAILED at Firestore chunk persistence:", fsErr?.message || fsErr);
      throw new Error(`Durable persistence failed: ${fsErr?.message || fsErr}`);
    }
  } else if (isServerless) {
    console.error("[RecoveryUpload] FAILED at Firestore chunk persistence: Firestore is unavailable in serverless environment");
    throw new Error("Durable persistence failed: Firestore is unavailable in serverless environment");
  }
  const db2 = readDb();
  if (!db2.recovery_documents_store) {
    db2.recovery_documents_store = {};
  }
  db2.recovery_documents_store[documentId] = {
    documentId,
    mimeType,
    size: buffer.length,
    fileName: meta?.fileName || "document",
    fileHash: meta?.fileHash || "",
    storageStatus: "pending",
    syncAttempts: 0,
    createdAt: nowIso,
    expiresAt: expiresAtIso
  };
  writeDb(db2);
  console.log(`[Recovery Upload] Primary persistence successful for documentId: ${documentId} (${buffer.length} bytes, ${totalChunks} chunks)`);
}
async function syncDocumentToCloudStorage(documentId, buffer, mimeType) {
  const bucket = getSafeBucket();
  if (!bucket) {
    return false;
  }
  let docBuffer = buffer;
  let docMime = mimeType || "application/pdf";
  if (!docBuffer) {
    try {
      docBuffer = await getDocumentFromPersistentStorage(documentId);
    } catch (e) {
      return false;
    }
  }
  const updateStatus = async (status, errorMsg, attempts = 1) => {
    try {
      if (isFirebaseAdminAvailable && adminDb) {
        await adminDb.collection("recoveryDocuments").doc(documentId).set(
          {
            storageStatus: status,
            syncError: errorMsg || null,
            syncAttempts: attempts,
            syncedAt: status === "synced" ? (/* @__PURE__ */ new Date()).toISOString() : null,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          { merge: true }
        );
      }
    } catch (e) {
    }
    try {
      const db2 = readDb();
      if (db2.recovery_documents_store?.[documentId]) {
        db2.recovery_documents_store[documentId].storageStatus = status;
        db2.recovery_documents_store[documentId].syncAttempts = attempts;
        if (errorMsg) db2.recovery_documents_store[documentId].syncError = errorMsg;
        writeDb(db2);
      }
    } catch (e) {
    }
  };
  const getCleanErrMsg = (err) => {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    if (err.errors?.[0]?.message) return err.errors[0].message;
    if (err.code) return `Error code ${err.code}`;
    return "Storage operation unfulfilled";
  };
  const isBucketNotFound = (err) => {
    if (!err) return false;
    const msg = String(err?.message || err?.errors?.[0]?.message || "").toLowerCase();
    const reason = String(err?.errors?.[0]?.reason || "").toLowerCase();
    const code = Number(err?.code || err?.status || 0);
    return code === 404 || code === 403 || reason === "notfound" || msg.includes("not found") || msg.includes("not exist");
  };
  const MAX_ATTEMPTS = 2;
  const ATTEMPT_TIMEOUT_MS = 4e3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let timeoutHandle = null;
    try {
      if (attempt > 1) {
        await new Promise((res) => setTimeout(res, 1e3));
      }
      await Promise.race([
        (async () => {
          const fileRef = bucket.file(`secure_uploads/${documentId}`);
          const [exists] = await fileRef.exists().catch(() => [false]);
          if (!exists) {
            await fileRef.save(docBuffer, {
              metadata: { contentType: docMime }
            });
          }
        })(),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Storage upload timeout (${ATTEMPT_TIMEOUT_MS}ms)`)),
            ATTEMPT_TIMEOUT_MS
          );
          if (timeoutHandle?.unref) timeoutHandle.unref();
        })
      ]);
      await updateStatus("synced", void 0, attempt);
      console.log(`[Recovery Upload] Durable cloud sync SUCCESS for document: ${documentId}`);
      if (isFirebaseAdminAvailable && adminDb) {
        (async () => {
          try {
            const chunksSnap = await adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").get();
            if (chunksSnap && !chunksSnap.empty) {
              const batch = adminDb.batch();
              chunksSnap.docs.forEach((doc) => batch.delete(doc.ref));
              await batch.commit();
            }
          } catch (pruneErr) {
          }
        })().catch(() => {
        });
      }
      return true;
    } catch (err) {
      lastError = err;
      if (isBucketNotFound(err)) {
        await updateStatus("firestore_durable", "Primary Firestore chunk storage active (Bucket unprovisioned)", attempt);
        console.log(`[Recovery Storage] Document ${documentId} safely stored in primary durable Firestore chunks.`);
        return true;
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
  const failureReason = getCleanErrMsg(lastError);
  await updateStatus("firestore_durable", failureReason, MAX_ATTEMPTS);
  console.log(`[Recovery Storage] Document ${documentId} stored in primary durable Firestore store.`);
  return true;
}
async function runDurableSyncWorker() {
  if (!isFirebaseAdminAvailable) return;
  const bucket = getSafeBucket();
  if (!bucket) return;
  try {
    const db2 = readDb();
    const store = db2.recovery_documents_store || {};
    const pendingDocIds = Object.keys(store).filter(
      (id) => store[id].storageStatus === "pending" && (store[id].syncAttempts || 0) < 2
    );
    for (const docId of pendingDocIds.slice(0, 2)) {
      await syncDocumentToCloudStorage(docId, void 0, store[docId]?.mimeType);
    }
    if (adminDb) {
      const snap = await adminDb.collection("recoveryDocuments").where("storageStatus", "==", "pending").limit(2).get();
      if (snap && !snap.empty) {
        for (const doc of snap.docs) {
          const data = doc.data();
          if ((data.syncAttempts || 0) < 2) {
            await syncDocumentToCloudStorage(doc.id, void 0, data.mimeType);
          }
        }
      }
    }
  } catch (err) {
  }
}
if (!isServerless) {
  const tSync = setInterval(() => {
    runDurableSyncWorker().catch(() => {
    });
    runComprehensiveStorageCleanup().catch(() => {
    });
  }, 5 * 60 * 1e3);
  if (tSync?.unref) tSync.unref();
}
async function getDocumentFromPersistentStorage(documentId) {
  const cached = getFromLocalDiskCache(documentId);
  if (cached) {
    return cached;
  }
  const bucket = getSafeBucket();
  if (bucket) {
    let timeoutHandle = null;
    try {
      const fileRef = bucket.file(`secure_uploads/${documentId}`);
      const downloadPromise = async () => {
        const [exists] = await fileRef.exists().catch(() => [false]);
        if (exists) {
          const [fileBuffer] = await fileRef.download();
          saveToLocalDiskCache(documentId, fileBuffer);
          return fileBuffer;
        }
        return null;
      };
      const buffer = await Promise.race([
        downloadPromise(),
        new Promise((resolve) => {
          timeoutHandle = setTimeout(() => resolve(null), 4e3);
          if (timeoutHandle?.unref) timeoutHandle.unref();
        })
      ]);
      if (buffer) return buffer;
    } catch (err) {
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const docSnap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
      if (docSnap && docSnap.exists) {
        const meta = docSnap.data();
        const totalChunks = meta?.totalChunks || 1;
        const chunksSnap = await adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").get();
        if (chunksSnap && !chunksSnap.empty) {
          const chunksMap = {};
          chunksSnap.docs.forEach((doc) => {
            const d = doc.data();
            chunksMap[d.chunkIndex] = d.data;
          });
          const buffers = [];
          for (let i = 0; i < totalChunks; i++) {
            if (chunksMap[i]) {
              buffers.push(Buffer.from(chunksMap[i], "base64"));
            }
          }
          if (buffers.length === totalChunks) {
            const fullBuffer = Buffer.concat(buffers);
            saveToLocalDiskCache(documentId, fullBuffer);
            return fullBuffer;
          }
        }
      }
    } catch (fsErr) {
      console.warn("Firestore chunks retrieval notice:", fsErr);
    }
  }
  throw new Error("Document file not found on disk, storage bucket, or primary database store.");
}
async function deleteDocumentFromPersistentStorage(documentId) {
  console.log(`[Storage Purge] Completely purging document: ${documentId}`);
  try {
    const candidatePaths = [
      path3.join(getLocalUploadsDir(), documentId),
      path3.join(os.tmpdir(), "secure_uploads", documentId),
      path3.join(process.cwd(), "secure_uploads", documentId)
    ];
    for (const p of candidatePaths) {
      if (fs3.existsSync(p)) {
        try {
          fs3.unlinkSync(p);
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const chunksSnap = await adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").get();
      if (chunksSnap && !chunksSnap.empty) {
        const batch = adminDb.batch();
        chunksSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      await adminDb.collection("recoveryDocuments").doc(documentId).delete();
    } catch (e) {
    }
  }
  const bucket = getSafeBucket();
  if (bucket) {
    try {
      const fileRef = bucket.file(`secure_uploads/${documentId}`);
      const [exists] = await fileRef.exists().catch(() => [false]);
      if (exists) {
        await fileRef.delete().catch(() => {
        });
      }
    } catch (err) {
    }
  }
  try {
    const db2 = readDb();
    if (db2.recovery_documents_store?.[documentId]) {
      delete db2.recovery_documents_store[documentId];
    }
    if (db2.pending_recovery_uploads) {
      db2.pending_recovery_uploads = db2.pending_recovery_uploads.filter((u) => u.documentId !== documentId);
    }
    writeDb(db2);
  } catch (e) {
  }
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).delete();
    } catch (e) {
    }
  }
}
async function registerPendingUpload(documentId, uploadToken, meta) {
  const db2 = readDb();
  if (!db2.pending_recovery_uploads) {
    db2.pending_recovery_uploads = [];
  }
  db2.pending_recovery_uploads.push({
    documentId,
    uploadToken,
    fileHash: meta.fileHash,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    size: meta.size,
    uploadedAt: meta.uploadedAt,
    storageStatus: meta.storageStatus || "pending",
    associated: false
  });
  writeDb(db2);
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set({
        documentId,
        uploadToken,
        fileHash: meta.fileHash,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.size,
        uploadedAt: meta.uploadedAt,
        storageStatus: meta.storageStatus || "pending",
        associated: false
      });
      console.log("[RecoveryUpload] pending synchronization registered");
    } catch (err) {
      console.error("[RecoveryUpload] FAILED at pending synchronization registered:", err?.message || err);
      throw new Error(`Failed to register pending upload in durable store: ${err?.message || err}`);
    }
  } else if (isServerless) {
    console.error("[RecoveryUpload] FAILED at pending synchronization registered: Firestore unavailable in serverless environment");
    throw new Error("Failed to register pending upload: Firestore is unavailable in serverless environment");
  } else {
    console.log("[RecoveryUpload] pending synchronization registered (local store)");
  }
}
async function verifyPendingUpload(documentId, uploadToken) {
  let record = null;
  if (isFirebaseAdminAvailable) {
    try {
      const snap = await adminDb.collection("pendingRecoveryUploads").doc(documentId).get();
      if (snap.exists) {
        record = snap.data();
      }
    } catch (err) {
    }
  }
  if (!record) {
    const db2 = readDb();
    record = db2.pending_recovery_uploads?.find((u) => u.documentId === documentId);
  }
  if (!record) return false;
  if (record.uploadToken !== uploadToken) return false;
  if (record.associated) return false;
  return true;
}
async function markUploadAssociated(documentId, requestId) {
  const db2 = readDb();
  const index = db2.pending_recovery_uploads?.findIndex((u) => u.documentId === documentId);
  if (index >= 0) {
    db2.pending_recovery_uploads[index].associated = true;
    db2.pending_recovery_uploads[index].associatedRequestId = requestId;
  }
  writeDb(db2);
  if (isFirebaseAdminAvailable) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set({
        associated: true,
        associatedRequestId: requestId
      }, { merge: true });
    } catch (err) {
    }
  }
}
async function runComprehensiveStorageCleanup() {
  try {
    const nowMs = Date.now();
    const oneHourAgo = nowMs - ORPHAN_UPLOAD_TTL_MS;
    const db2 = readDb();
    const uploads = db2.pending_recovery_uploads || [];
    const orphans = uploads.filter((u) => !u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo);
    for (const orphan of orphans) {
      console.log(`[ORPHAN_CLEANUP] Deleting orphan document ${orphan.documentId} uploaded at ${orphan.uploadedAt}`);
      await deleteDocumentFromPersistentStorage(orphan.documentId);
    }
    db2.pending_recovery_uploads = uploads.filter((u) => !(!u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo));
    const store = db2.recovery_documents_store || {};
    for (const docId of Object.keys(store)) {
      const docItem = store[docId];
      if (docItem.expiresAt && new Date(docItem.expiresAt).getTime() < nowMs) {
        console.log(`[TTL_CLEANUP] Purging expired identity document ${docId} (exceeded retention window)`);
        await deleteDocumentFromPersistentStorage(docId);
      }
    }
    writeDb(db2);
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const expiredDocsSnap = await adminDb.collection("recoveryDocuments").where("expiresAt", "<=", (/* @__PURE__ */ new Date()).toISOString()).limit(10).get();
        if (expiredDocsSnap && !expiredDocsSnap.empty) {
          for (const d of expiredDocsSnap.docs) {
            await deleteDocumentFromPersistentStorage(d.id);
          }
        }
        const orphanSnap = await adminDb.collection("pendingRecoveryUploads").where("associated", "==", false).get();
        if (orphanSnap && !orphanSnap.empty) {
          for (const doc of orphanSnap.docs) {
            const data = doc.data();
            if (new Date(data.uploadedAt).getTime() < oneHourAgo) {
              await deleteDocumentFromPersistentStorage(doc.id);
              await adminDb.collection("pendingRecoveryUploads").doc(doc.id).delete();
            }
          }
        }
      } catch (err) {
      }
    }
  } catch (err) {
    console.warn("Storage cleanup failed gracefully:", err);
  }
}
async function runOrphanCleanup() {
  await runComprehensiveStorageCleanup();
}
app.post("/api/auth/recovery-request/upload", (req, res, next) => {
  console.log("[RecoveryUpload] request received");
  recoveryUpload.fields([{ name: "document", maxCount: 1 }, { name: "file", maxCount: 1 }])(req, res, (err) => {
    if (err) {
      console.error("[RecoveryUpload] FAILED at multipart parsed:", err?.message || err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "IDENTITY_DOCUMENT_TOO_LARGE",
          message: "File exceeds the 5MB size limit."
        });
      }
      return res.status(400).json({
        success: false,
        error: "FILE_UPLOAD_ERROR",
        message: err.message || "File upload error"
      });
    }
    console.log("[RecoveryUpload] multipart parsed");
    next();
  });
}, async (req, res) => {
  let currentStage = "file detected";
  try {
    if (!isServerless) {
      setImmediate(() => {
        runOrphanCleanup().catch((e) => console.warn("Background orphan cleanup notice:", e));
      });
    }
    const file = req.file || req.files?.document?.[0] || req.files?.file?.[0];
    if (!file) {
      console.error("[RecoveryUpload] FAILED at file detected: missing file in multipart payload");
      return res.status(400).json({
        success: false,
        error: "MISSING_FILE",
        message: "No document file was uploaded in request."
      });
    }
    console.log("[RecoveryUpload] file detected");
    currentStage = "file validation started";
    console.log("[RecoveryUpload] file validation started");
    if (file.size > 5 * 1024 * 1024) {
      console.error("[RecoveryUpload] FAILED at file validation: file exceeds 5MB");
      return res.status(413).json({
        success: false,
        error: "IDENTITY_DOCUMENT_TOO_LARGE",
        message: "File exceeds the 5MB size limit."
      });
    }
    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.error("[RecoveryUpload] FAILED at file validation: unsupported mime type", file.mimetype);
      return res.status(400).json({
        success: false,
        error: "UNSUPPORTED_FORMAT",
        message: "Unsupported document format. Only PDF, PNG, and JPEG files are allowed."
      });
    }
    const originalName = file.originalname || "document";
    const ext = path3.extname(originalName).toLowerCase();
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
    if (!allowedExtensions.includes(ext)) {
      console.error("[RecoveryUpload] FAILED at file validation: invalid extension", ext);
      return res.status(400).json({
        success: false,
        error: "INVALID_EXTENSION",
        message: "Invalid file extension. Only .pdf, .png, .jpg, and .jpeg are allowed."
      });
    }
    if (!validateFileSignature(file.buffer, file.mimetype)) {
      console.error("[RecoveryUpload] FAILED at file validation: invalid file signature");
      return res.status(400).json({
        success: false,
        error: "INVALID_FILE_SIGNATURE",
        message: "File content does not match its format signature."
      });
    }
    console.log("[RecoveryUpload] file validation passed");
    const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const uploadToken = crypto.randomBytes(32).toString("hex");
    console.log("[RecoveryUpload] documentId generated");
    currentStage = "SHA-256 calculated";
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const safeName = path3.basename(originalName).replace(/[^a-zA-Z0-9.-]/g, "_");
    console.log("[RecoveryUpload] SHA-256 calculated");
    const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
    const db2 = readDb();
    const existingUpload = (db2.pending_recovery_uploads || []).find(
      (u) => !u.associated && u.fileHash === fileHash && u.fileName === safeName && new Date(u.uploadedAt).getTime() > tenMinutesAgo
    );
    if (existingUpload) {
      console.log(`[RecoveryUpload] Idempotent hit: reusing recent pending upload ${existingUpload.documentId}`);
      console.log("[RecoveryUpload] HTTP 200 response");
      return res.status(200).json({
        success: true,
        documentId: existingUpload.documentId,
        uploadToken: existingUpload.uploadToken,
        storageStatus: existingUpload.storageStatus || "pending",
        document: {
          documentId: existingUpload.documentId,
          uploadToken: existingUpload.uploadToken,
          storageReference: `secure_uploads/${existingUpload.documentId}`,
          fileName: existingUpload.fileName,
          mimeType: existingUpload.mimeType,
          size: existingUpload.size,
          uploadedAt: existingUpload.uploadedAt,
          storageStatus: existingUpload.storageStatus || "pending"
        }
      });
    }
    currentStage = "Firestore persistence";
    await saveDocumentToPersistentStorage(documentId, file.buffer, file.mimetype, {
      fileName: safeName,
      size: file.size,
      fileHash
    });
    const docMeta = {
      documentId,
      uploadToken,
      fileHash,
      storageReference: `secure_uploads/${documentId}`,
      fileName: safeName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      storageStatus: "pending"
    };
    currentStage = "pending synchronization registered";
    await registerPendingUpload(documentId, uploadToken, docMeta);
    if (!isServerless) {
      setImmediate(() => {
        syncDocumentToCloudStorage(documentId, file.buffer, file.mimetype).catch((syncErr) => {
          console.warn("[Recovery Upload] Background cloud sync error caught safely:", syncErr?.message || syncErr);
        });
      });
    }
    console.log("[RecoveryUpload] HTTP 200 response");
    return res.status(200).json({
      success: true,
      documentId,
      uploadToken,
      storageStatus: "pending",
      document: docMeta
    });
  } catch (err) {
    console.error(`[RecoveryUpload] FAILED at ${currentStage}:`, err?.message || err);
    return res.status(500).json({
      success: false,
      error: "DOCUMENT_UPLOAD_FAILED",
      message: err.message || "Failed to persist document to primary durable storage."
    });
  }
});
app.get("/api/admin/recovery-request/document/:documentId", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !await isUserAdminServer(callerUid)) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    const { documentId } = req.params;
    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Document ID is required." });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(documentId)) {
      return res.status(400).json({ error: "Invalid Document ID structure (path traversal detected)." });
    }
    const safeDocId = documentId;
    let docMeta = null;
    const db2 = readDb();
    const localRequests = db2.account_recovery_requests || [];
    for (const r of localRequests) {
      const found = r.documents?.find((d) => d.documentId === safeDocId);
      if (found) {
        docMeta = found;
        break;
      }
    }
    if (!docMeta) {
      try {
        const snap = await adminDb.collection("accountRecoveryRequests").get();
        if (snap && !snap.empty) {
          for (const doc of snap.docs) {
            const data = doc.data();
            const found = data.documents?.find((d) => d.documentId === safeDocId);
            if (found) {
              docMeta = found;
              break;
            }
          }
        }
      } catch (e) {
      }
    }
    if (!docMeta) {
      return res.status(403).json({ error: "Forbidden: Document does not belong to a legitimate recovery request." });
    }
    let fileBuffer;
    try {
      fileBuffer = await getDocumentFromPersistentStorage(safeDocId);
    } catch (err) {
      return res.status(404).json({ error: "Document file not found in persistent store." });
    }
    const mimeType = docMeta.mimeType || "application/octet-stream";
    const originalName = docMeta.fileName || "document";
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none';");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${originalName}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error("Document download error:", err);
    res.status(500).json({ error: err.message || "Failed to download document." });
  }
});
app.post("/api/auth/recovery-request/submit", async (req, res) => {
  try {
    const {
      email,
      fullName,
      phone,
      phoneVerified,
      reason,
      organizationName,
      previousWorkspaceInfo,
      acceptedTerms,
      documents
    } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, error: "An identity verification document is required." });
    }
    if (documents.length > 2) {
      return res.status(400).json({ success: false, error: "Maximum 2 identity verification documents allowed." });
    }
    for (const doc of documents) {
      if (!doc.documentId || !doc.uploadToken) {
        return res.status(400).json({ success: false, error: "Missing document verification details." });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(doc.documentId)) {
        return res.status(400).json({ success: false, error: "Invalid document reference format." });
      }
      const isValid = await verifyPendingUpload(doc.documentId, doc.uploadToken);
      if (!isValid) {
        return res.status(400).json({ success: false, error: "Document reference integrity check failed. Unrecognized or hijacked file." });
      }
    }
    const normalizedEmail = email.trim().toLowerCase();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    const requestDoc = {
      id: requestId,
      requestId,
      email: normalizedEmail,
      fullName: (fullName || "").trim(),
      phone: (phone || "").trim(),
      phoneVerified: !!phoneVerified,
      reason: (reason || "").trim(),
      organizationName: (organizationName || "").trim(),
      previousWorkspaceInfo: (previousWorkspaceInfo || "").trim(),
      acceptedTerms: !!acceptedTerms,
      termsAcceptedAt: nowIso,
      documents: documents.map((d) => ({
        documentId: d.documentId,
        storageReference: d.storageReference,
        fileName: d.fileName,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt
      })),
      status: "pending",
      submittedAt: nowIso,
      updatedAt: nowIso
    };
    for (const doc of documents) {
      await markUploadAssociated(doc.documentId, requestId);
    }
    try {
      await adminDb.collection("accountRecoveryRequests").doc(requestId).set(requestDoc);
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).set(requestDoc);
    } catch (fsErr) {
      console.warn("Firestore recovery request write warning:", fsErr);
    }
    const db2 = readDb();
    if (!db2.account_recovery_requests) db2.account_recovery_requests = [];
    db2.account_recovery_requests = db2.account_recovery_requests.filter((r) => r.email !== normalizedEmail);
    db2.account_recovery_requests.push(requestDoc);
    writeDb(db2);
    const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycle) {
      await setAccountLifecycleRecord({
        ...lifecycle,
        status: "ADMIN_APPROVAL_PENDING",
        reactivationStatus: "pending",
        recoveryRequestId: requestId,
        updatedAt: nowIso
      });
    }
    return res.json({
      success: true,
      requestId,
      message: "Your account recovery request has been submitted for administrative review."
    });
  } catch (err) {
    console.error("Submit recovery request error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to submit recovery request." });
  }
});
app.get("/api/auth/recovery-request/status", async (req, res) => {
  try {
    const email = req.query?.email;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    let requestData = null;
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        requestData = emailSnap.data();
      }
    } catch (e) {
    }
    if (!requestData) {
      const db2 = readDb();
      requestData = db2.account_recovery_requests?.find((r) => r.email === normalizedEmail) || null;
    }
    if (!requestData) {
      return res.json({
        success: true,
        status: "none",
        recoveryRequest: null
      });
    }
    const responseStatus = requestData.status || "pending";
    const baseResponse = {
      success: true,
      status: responseStatus,
      recoveryRequest: {
        status: responseStatus,
        rejectionReason: responseStatus === "rejected" ? requestData.rejectionReason || requestData.notes || "Request was declined by an administrator." : null
      }
    };
    return res.json(baseResponse);
  } catch (err) {
    console.error("Recovery request status error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch status." });
  }
});
app.get("/api/admin/recovery-requests", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !await isUserAdminServer(callerUid)) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    let requests = [];
    try {
      const snap = await adminDb.collection("accountRecoveryRequests").get();
      if (snap && !snap.empty) {
        requests = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      }
    } catch (e) {
    }
    const db2 = readDb();
    const localRequests = db2.account_recovery_requests || [];
    for (const lr of localRequests) {
      if (!requests.some((r) => r.id === lr.id || r.requestId === lr.requestId)) {
        requests.push(lr);
      }
    }
    return res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch recovery requests." });
  }
});
app.post("/api/admin/handle-recovery-request", requireAuth, async (req, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !await isUserAdminServer(callerUid)) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }
    const { requestId, email, action, rejectionReason } = req.body;
    if (!action || action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Valid action ('approve' or 'reject') is required." });
    }
    let requestData = null;
    if (requestId) {
      try {
        const snap = await adminDb.collection("accountRecoveryRequests").doc(requestId).get();
        if (snap.exists) requestData = snap.data();
      } catch (e) {
      }
    }
    const targetEmail = (requestData?.email || email || "").trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ error: "Target request email is required." });
    }
    if (!requestData) {
      const db3 = readDb();
      requestData = db3.account_recovery_requests?.find((r) => r.email === targetEmail || r.id === requestId);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newStatus = action === "approve" ? "approved" : "rejected";
    const updatedRequestDoc = {
      ...requestData || {},
      email: targetEmail,
      status: newStatus,
      handledAt: nowIso,
      reviewedAt: nowIso,
      reviewedBy: callerUid,
      rejectionReason: action === "reject" ? rejectionReason || "Identity or documentation could not be verified." : null
    };
    try {
      if (requestData?.requestId) {
        await adminDb.collection("accountRecoveryRequests").doc(requestData.requestId).set(updatedRequestDoc, { merge: true });
      }
      await adminDb.collection("accountRecoveryRequests_by_email").doc(targetEmail).set(updatedRequestDoc, { merge: true });
    } catch (e) {
    }
    const db2 = readDb();
    if (!db2.account_recovery_requests) db2.account_recovery_requests = [];
    const existingIdx = db2.account_recovery_requests.findIndex((r) => r.email === targetEmail || r.id === requestId);
    if (existingIdx >= 0) {
      db2.account_recovery_requests[existingIdx] = updatedRequestDoc;
    } else {
      db2.account_recovery_requests.push(updatedRequestDoc);
    }
    writeDb(db2);
    const lifecycle = await getAccountLifecycleRecord(targetEmail);
    if (lifecycle) {
      await setAccountLifecycleRecord({
        ...lifecycle,
        status: action === "approve" ? "ADMIN_APPROVED" : "ADMIN_REJECTED",
        reactivationStatus: newStatus,
        updatedAt: nowIso
      });
    }
    if (action === "approve") {
      try {
        await restoreAccountFullServer(targetEmail);
        console.log(`[ADMIN_APPROVE_RECOVERY] Full restoration executed for ${targetEmail}`);
      } catch (rErr) {
        console.warn("Full restoration execution error on admin approval:", rErr);
      }
    } else if (action === "reject") {
      if (requestData?.documents && Array.isArray(requestData.documents)) {
        (async () => {
          for (const doc of requestData.documents) {
            if (doc.documentId) {
              console.log(`[ADMIN_REJECT_RECOVERY] Purging identity document ${doc.documentId} on rejection`);
              await deleteDocumentFromPersistentStorage(doc.documentId);
            }
          }
        })().catch((pErr) => console.warn("Document purge notice on rejection:", pErr));
      }
    }
    try {
      const userFullName = requestData?.fullName || targetEmail.split("@")[0];
      if (action === "approve") {
        const mailContent = buildRecoveryApprovalEmailHtml({
          userName: userFullName,
          email: targetEmail
        });
        await sendSystemMail(targetEmail, mailContent.subject, mailContent.text, mailContent.html);
      } else {
        const mailContent = buildRecoveryRejectionEmailHtml({
          userName: userFullName,
          email: targetEmail,
          rejectionReason
        });
        await sendSystemMail(targetEmail, mailContent.subject, mailContent.text, mailContent.html);
      }
    } catch (mailErr) {
      console.warn("Recovery decision email delivery warning:", mailErr);
    }
    return res.json({
      success: true,
      message: action === "approve" ? "Account recovery request approved! The user has been notified via email to proceed with verification." : "Account recovery request rejected. The user has been notified with the provided reason."
    });
  } catch (err) {
    console.error("Handle recovery request error:", err);
    res.status(500).json({ error: err.message || "Failed to handle recovery request." });
  }
});
app.post("/api/auth/recovery-request/send-approval-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    let reqStatus = "";
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        reqStatus = emailSnap.data()?.status || "";
      }
    } catch (e) {
    }
    if (!reqStatus) {
      const db3 = readDb();
      const localReq = db3.account_recovery_requests?.find((r) => r.email === normalizedEmail);
      reqStatus = localReq?.status || "";
    }
    if (reqStatus !== "approved") {
      const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
      if (lifecycle?.status !== "ADMIN_APPROVED" && lifecycle?.reactivationStatus !== "approved") {
        return res.status(400).json({
          success: false,
          error: "Your recovery request has not yet been approved by an administrator."
        });
      }
    }
    const otpCode = crypto.randomInt(1e5, 1e6).toString();
    const codeHash = hashVerificationCode(otpCode);
    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 10 * 60 * 1e3).toISOString();
    const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const record = {
      id: docId,
      email: normalizedEmail,
      codeHash,
      type: "account_recovery",
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      await adminDb.collection("verification_codes").doc(normalizedEmail).set(record);
    } catch (e) {
    }
    const db2 = readDb();
    if (!db2.verification_codes) db2.verification_codes = [];
    db2.verification_codes = db2.verification_codes.filter((vc) => vc.id !== docId && vc.id !== normalizedEmail);
    db2.verification_codes.push(record);
    writeDb(db2);
    const emailObj = buildOtpEmailHtml({
      email: normalizedEmail,
      otpCode,
      type: "account_recovery"
    });
    const mailResult = await sendSystemMail(normalizedEmail, emailObj.subject, emailObj.text, emailObj.html);
    return res.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      expiresAt,
      emailSent: !mailResult.simulated,
      devCode: mailResult.simulated ? otpCode : void 0
    });
  } catch (err) {
    console.error("Send approval OTP error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to send verification code." });
  }
});
app.post("/api/auth/recovery-request/verify-otp-and-restore", otpLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Email and verification code are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const inputCode = String(code).trim();
    const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    let otpRecord = null;
    try {
      const snap = await adminDb.collection("verification_codes").doc(docId).get();
      if (snap.exists && !snap.data()?.used) {
        otpRecord = snap.data();
      }
      if (!otpRecord) {
        const emSnap = await adminDb.collection("verification_codes").doc(normalizedEmail).get();
        if (emSnap.exists && !emSnap.data()?.used) {
          otpRecord = emSnap.data();
        }
      }
    } catch (e) {
    }
    if (!otpRecord) {
      const db3 = readDb();
      otpRecord = db3.verification_codes?.find((vc) => (vc.id === docId || vc.email === normalizedEmail) && !vc.used);
    }
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found or code has already been used. Please request a new code."
      });
    }
    const expiresAt = new Date(otpRecord.expiresAt).getTime();
    if (expiresAt <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }
    const cleanInputHash = hashVerificationCode(inputCode);
    const isMatch = otpRecord.codeHash ? otpRecord.codeHash === cleanInputHash : otpRecord.code === inputCode;
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code. Please check your email and try again."
      });
    }
    try {
      await adminDb.collection("verification_codes").doc(docId).update({ used: true });
    } catch (e) {
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).update({
        status: "restored",
        restoredAt: nowIso
      });
    } catch (e) {
    }
    const db2 = readDb();
    if (db2.account_recovery_requests) {
      const rItem = db2.account_recovery_requests.find((r) => r.email === normalizedEmail);
      if (rItem) rItem.status = "restored";
      writeDb(db2);
    }
    const restoreRes = await restoreAccountFullServer(normalizedEmail, newPassword);
    if (!restoreRes.success || !restoreRes.user) {
      return res.status(500).json({ success: false, error: restoreRes.error || "Failed to restore account profile." });
    }
    (async () => {
      try {
        let recoveryReq = null;
        if (adminDb) {
          const reqSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
          if (reqSnap.exists) recoveryReq = reqSnap.data();
        }
        if (!recoveryReq) {
          const db3 = readDb();
          recoveryReq = db3.account_recovery_requests?.find((r) => r.email === normalizedEmail);
        }
        if (recoveryReq?.documents && Array.isArray(recoveryReq.documents)) {
          for (const doc of recoveryReq.documents) {
            if (doc.documentId) {
              console.log(`[RESTORE_COMPLETED_PURGE] Purging identity document ${doc.documentId} after successful restoration`);
              await deleteDocumentFromPersistentStorage(doc.documentId);
            }
          }
        }
      } catch (purgeErr) {
        console.warn("Post-restoration document purge notice:", purgeErr);
      }
    })().catch(() => {
    });
    let customToken = "";
    try {
      customToken = await adminAuth.createCustomToken(restoreRes.user.id);
    } catch (tErr) {
      console.warn("createCustomToken warning on recovery restoration:", tErr);
    }
    return res.json({
      success: true,
      customToken,
      user: restoreRes.user,
      message: "Your account has been successfully restored! You may now sign in."
    });
  } catch (err) {
    console.error("Verify OTP and restore error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to complete account restoration." });
  }
});
app.delete("/api/admin/delete-user/:uid", requireAuth, async (req, res) => {
  const targetUid = req.params.uid;
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const isCallerAdmin = await isUserAdminServer(callerUid);
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Only administrative personnel can perform account deletion." });
    }
    if (targetUid === callerUid) {
      return res.status(400).json({ error: "You cannot delete your own active administrative account." });
    }
    console.log("USER_DELETE_STARTED", { targetUid });
    let targetEmail = "";
    try {
      const targetSnap = await adminDb.collection("users").doc(targetUid).get();
      if (targetSnap.exists) {
        targetEmail = targetSnap.data()?.email || "";
      }
    } catch (e) {
      console.warn("Failed to retrieve target user email:", e);
    }
    if (targetEmail) {
      const normEmail = targetEmail.trim().toLowerCase();
      await setAccountLifecycleRecord({
        accountId: normEmail,
        emailNormalized: normEmail,
        status: "ADMIN_DELETED",
        deletionType: "admin",
        deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
        deletedBy: callerUid,
        restoreUntil: null,
        adminApprovalRequired: true,
        originalUserId: targetUid
      });
    }
    try {
      await adminDb.collection("deletedUsers").doc(targetUid).set({
        uid: targetUid,
        email: targetEmail,
        deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
        deletedBy: callerUid,
        reason: "admin_deleted"
      });
      console.log("USER_DELETED_MARKER_CREATED", { targetUid });
    } catch (delErr) {
      console.error("Firestore deletedUsers creation failed:", delErr?.message);
      return res.status(500).json({ error: `Critical error: Failed to establish deletion marker in Firestore. Aborting deletion: ${delErr.message}` });
    }
    try {
      await adminDb.collection("users").doc(targetUid).delete();
      console.log("USER_FIRESTORE_DELETED", { targetUid });
    } catch (fsErr) {
      console.warn("Firestore user doc delete warning:", fsErr?.message);
    }
    try {
      await adminDb.collection("verification_codes").doc(targetUid).delete();
      const vcSnap = await adminDb.collection("verification_codes").where("userId", "==", targetUid).get();
      for (const doc of vcSnap.docs) {
        await doc.ref.delete();
      }
    } catch (vcErr) {
      console.warn("Verification codes deletion warning:", vcErr?.message);
    }
    try {
      const userFilesSnap = await adminDb.collection("users").doc(targetUid).collection("files").get();
      for (const fDoc of userFilesSnap.docs) {
        await fDoc.ref.delete();
      }
      const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
      for (const tfDoc of topFilesSnap.docs) {
        await tfDoc.ref.delete();
      }
    } catch (filesErr) {
      console.warn("Files metadata deletion warning:", filesErr?.message);
    }
    try {
      const memSnap = await adminDb.collection("users").doc(targetUid).collection("memories").get();
      for (const mDoc of memSnap.docs) {
        await mDoc.ref.delete();
      }
      const alertSnap = await adminDb.collection("users").doc(targetUid).collection("riskAlerts").get();
      for (const aDoc of alertSnap.docs) {
        await aDoc.ref.delete();
      }
    } catch (memErr) {
      console.warn("Memories/alerts deletion warning:", memErr?.message);
    }
    try {
      const ticketSnap = await adminDb.collection("support_tickets").where("userId", "==", targetUid).get();
      for (const tDoc of ticketSnap.docs) {
        await tDoc.ref.delete();
      }
    } catch (ticketErr) {
      console.warn("Support tickets deletion warning:", ticketErr?.message);
    }
    try {
      await adminAuth.updateUser(targetUid, { disabled: true });
      console.log("USER_AUTH_DISABLED", { targetUid });
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") {
        console.warn("USER_AUTH_DISABLE_WARNING", { targetUid, error: authErr?.message });
      }
    }
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
      console.log("USER_TOKENS_REVOKED", { targetUid });
    } catch (tokenErr) {
      console.warn("Revoke refresh tokens warning:", tokenErr?.message);
    }
    const dbData = readDb();
    if (dbData.users) dbData.users = dbData.users.filter((u) => u.id !== targetUid);
    if (dbData.verification_codes) dbData.verification_codes = dbData.verification_codes.filter((vc) => vc.id !== targetUid && vc.userId !== targetUid);
    if (dbData.support_tickets) dbData.support_tickets = dbData.support_tickets.filter((st) => st.userId !== targetUid);
    writeDb(dbData);
    console.log("USER_DELETE_COMPLETED", { targetUid });
    res.json({ success: true, message: `Account ${targetUid} has been permanently deleted from all systems.` });
  } catch (err) {
    console.error("USER_DELETE_FAILED", { targetUid, error: err.message || String(err) });
    res.status(500).json({ error: err.message || "Administrative deletion process failed." });
  }
});
app.all("/api/auth/delete-account", requireAuth, async (req, res) => {
  let targetUid = req.user?.uid;
  try {
    if (!targetUid && req.body?.email) {
      try {
        const db2 = readDb();
        const found = db2.users?.find((u) => u.email?.trim().toLowerCase() === (req.body.email || "").trim().toLowerCase());
        if (found) targetUid = found.id;
      } catch (e) {
      }
    }
    if (!targetUid) {
      return res.status(401).json({ error: "Unauthorized: Could not determine user identity for deletion." });
    }
    console.log("USER_SELF_DELETE_STARTED", { targetUid });
    let userDocData = null;
    try {
      const userSnap = await adminDb.collection("users").doc(targetUid).get();
      if (userSnap.exists) {
        userDocData = userSnap.data();
      }
    } catch (e) {
    }
    const targetEmail = userDocData?.email || req.user?.email || "";
    const normEmail = targetEmail.trim().toLowerCase();
    if (userDocData) {
      try {
        await adminDb.collection("users_retained").doc(targetUid).set({
          ...userDocData,
          archivedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        const memSnap = await adminDb.collection("users").doc(targetUid).collection("memories").get();
        for (const mDoc of memSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("memories").doc(mDoc.id).set(mDoc.data());
        }
        const alertSnap = await adminDb.collection("users").doc(targetUid).collection("riskAlerts").get();
        for (const aDoc of alertSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("riskAlerts").doc(aDoc.id).set(aDoc.data());
        }
        const filesSnap = await adminDb.collection("users").doc(targetUid).collection("files").get();
        for (const fDoc of filesSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("files").doc(fDoc.id).set(fDoc.data());
        }
        const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
        for (const tfDoc of topFilesSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("top_files").doc(tfDoc.id).set(tfDoc.data());
        }
        const db2 = readDb();
        if (!db2.retained_users) db2.retained_users = [];
        db2.retained_users = db2.retained_users.filter((u) => u.id !== targetUid);
        const localMems = (db2.memories || []).filter((m) => m.userId === targetUid);
        const localAlerts = (db2.risk_alerts || []).filter((a) => a.userId === targetUid);
        const localFiles = (db2.files || []).filter((f) => f.userId === targetUid);
        db2.retained_users.push({
          ...userDocData,
          archivedAt: (/* @__PURE__ */ new Date()).toISOString(),
          archivedMemories: localMems,
          archivedRiskAlerts: localAlerts,
          archivedFiles: localFiles
        });
        writeDb(db2);
      } catch (archErr) {
        console.warn("Retention profile backup warning:", archErr);
      }
    }
    if (normEmail) {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const restoreUntilIso = new Date(Date.now() + 31 * 24 * 60 * 60 * 1e3).toISOString();
      await setAccountLifecycleRecord({
        accountId: normEmail,
        emailNormalized: normEmail,
        status: "SELF_DELETED",
        deletionType: "self",
        deletedAt: nowIso,
        deletedBy: targetUid,
        restoreUntil: restoreUntilIso,
        originalUserId: targetUid,
        retainedDataDocPath: `users_retained/${targetUid}`,
        adminApprovalRequired: false
      });
    }
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
    } catch (tokenErr) {
      console.warn("Revoke refresh tokens warning:", tokenErr?.message);
    }
    try {
      await adminAuth.updateUser(targetUid, { disabled: true });
      console.log("USER_SELF_AUTH_DISABLED", { targetUid });
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") {
        console.warn("USER_SELF_AUTH_DISABLE_WARNING", { targetUid, error: authErr?.message });
      }
    }
    try {
      await adminDb.collection("deletedUsers").doc(targetUid).set({
        uid: targetUid,
        email: targetEmail,
        deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
        deletedBy: targetUid,
        reason: "self_deleted"
      });
    } catch (dErr) {
    }
    try {
      await adminDb.collection("users").doc(targetUid).delete();
    } catch (fsErr) {
    }
    try {
      await adminDb.collection("verification_codes").doc(targetUid).delete();
      const vcSnap = await adminDb.collection("verification_codes").where("userId", "==", targetUid).get();
      for (const doc of vcSnap.docs) {
        await doc.ref.delete();
      }
    } catch (vcErr) {
    }
    try {
      const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
      for (const tfDoc of topFilesSnap.docs) {
        await tfDoc.ref.delete();
      }
    } catch (filesErr) {
    }
    const dbData = readDb();
    if (dbData.users) dbData.users = dbData.users.filter((u) => u.id !== targetUid);
    if (dbData.verification_codes) dbData.verification_codes = dbData.verification_codes.filter((vc) => vc.id !== targetUid && vc.userId !== targetUid);
    if (dbData.support_tickets) dbData.support_tickets = dbData.support_tickets.filter((st) => st.userId !== targetUid);
    writeDb(dbData);
    console.log("USER_SELF_DELETE_COMPLETED", { targetUid });
    res.json({ success: true, message: "Your account has been deleted. You have 31 days to restore it if you choose." });
  } catch (err) {
    console.error("USER_SELF_DELETE_FAILED", { targetUid, error: err.message || String(err) });
    res.status(500).json({ error: err.message || "Account deletion failed." });
  }
});
app.post("/api/auth/register", loginRegisterLimiter, async (req, res) => {
  try {
    const { email, password, companyName, role, ownerName, lang } = req.body;
    const userRole = role || "CEO";
    if (!email || !password || !companyName) {
      return res.status(400).json({ success: false, error: "All registration fields are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    console.log("REGISTRATION_STARTED", { email: normalizedEmail });
    const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycleRecord) {
      if (lifecycleRecord.status === "ADMIN_DELETED" || lifecycleRecord.status === "ADMIN_APPROVAL_REQUIRED" || lifecycleRecord.deletionType === "admin") {
        return res.status(400).json({
          success: false,
          code: "ADMIN_DELETED_BLOCKED",
          adminApprovalRequired: true,
          error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628\u0643 \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629. \u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u062C\u062F\u064A\u062F \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0625\u0644\u0627 \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644."
        });
      }
      if (lifecycleRecord.status === "ADMIN_APPROVAL_PENDING") {
        return res.status(400).json({
          success: false,
          code: "ADMIN_APPROVAL_PENDING",
          adminApprovalRequired: true,
          error: "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0646\u0635\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u062D\u064A\u0646 \u0627\u0644\u0628\u062A \u0641\u064A \u0627\u0644\u0637\u0644\u0628."
        });
      }
      if (lifecycleRecord.status === "SELF_DELETED" && lifecycleRecord.restoreUntil) {
        const nowMs = Date.now();
        const restoreUntilMs = new Date(lifecycleRecord.restoreUntil).getTime();
        if (nowMs <= restoreUntilMs) {
          const daysRemaining = Math.max(1, Math.ceil((restoreUntilMs - nowMs) / (24 * 3600 * 1e3)));
          return res.status(400).json({
            success: false,
            code: "SELF_RESTORE_AVAILABLE",
            canRestore: true,
            daysRemaining,
            restoreUntil: lifecycleRecord.restoreUntil,
            error: `\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0633\u0627\u0628\u0642 \u062A\u0645 \u062D\u0630\u0641\u0647 \u0628\u0648\u0627\u0633\u0637\u062A\u0643. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u062C\u062F\u064A\u062F (\u0645\u062A\u0628\u0642\u064A ${daysRemaining} \u064A\u0648\u0645\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629).`
          });
        }
      }
    }
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const special = /[!@#$%^&*(),.?":{}|<>_~\-+=]/.test(password);
    if (!len || !upper || !lower || !num || !special) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      });
    }
    if (!len || !upper || !lower || !num || !special) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      });
    }
    const db2 = readDb();
    if (db2.users?.find((u) => u.email?.trim().toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ success: false, error: "Email already exists." });
    }
    try {
      const existingSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (!existingSnap.empty) {
        return res.status(400).json({ success: false, error: "Email already exists." });
      }
    } catch (err) {
    }
    try {
      const existingAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (existingAuthUser) {
        return res.status(400).json({ success: false, error: "Email already exists." });
      }
    } catch (err) {
    }
    let userId;
    let createdAuthUser = false;
    try {
      const authUser = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: ownerName || companyName,
        emailVerified: false
      });
      userId = authUser.uid;
      createdAuthUser = true;
      console.log("USER_CREATED", { userId, email: normalizedEmail, source: "firebase_auth" });
    } catch (authErr) {
      if (authErr?.code === "auth/email-already-exists") {
        return res.status(400).json({ success: false, error: "Email already exists." });
      }
      userId = "usr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      console.log("USER_CREATED", { userId, email: normalizedEmail, source: "generated_id", authErr: authErr?.message });
    }
    let invitation = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) {
        invitation = invDoc.data();
      }
    } catch (e) {
    }
    if (!invitation) {
      const dbTemp = readDb();
      invitation = dbTemp.invitations?.find((i) => i.email?.trim().toLowerCase() === normalizedEmail) || null;
    }
    const effectiveCompanyName = invitation?.companyName || companyName;
    const effectiveRole = invitation?.role || userRole;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const workspaceId = invitation?.workspaceId || `ws_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    const resolvedOwnerName = ownerName || normalizedEmail.split("@")[0];
    const newUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: password,
      companyName: effectiveCompanyName,
      ownerName: resolvedOwnerName,
      role: effectiveRole,
      workspaceId,
      workspace: {
        id: workspaceId,
        name: `${effectiveCompanyName} Workspace`,
        ownerId: invitation?.senderId || userId,
        createdAt: nowIso,
        memberCount: 1
      },
      subscriptionStatus: "Pending Selection",
      createdAt: nowIso,
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1e3).toISOString(),
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      isVerified: false,
      isEmailVerified: false,
      email_verified: false,
      emailVerified: false,
      verification_required: true,
      verification_status: "unverified"
    };
    const userRef = adminDb.collection("users").doc(userId);
    try {
      await userRef.set(newUser);
      console.log("USER_FIRESTORE_PERSISTED", { userId, email: normalizedEmail });
    } catch (fsErr) {
      console.error("USER_CREATION_FAILED", {
        userId,
        email: normalizedEmail,
        error: fsErr?.message || String(fsErr)
      });
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {
        }
      }
      return res.status(500).json({
        success: false,
        code: "USER_CREATION_FAILED",
        error: "Failed to create user record in database. Please try again."
      });
    }
    try {
      const createdDoc = await userRef.get();
      if (!createdDoc.exists) {
        console.error("USER_FIRESTORE_PERSIST_FAILED", { userId, email: normalizedEmail });
        if (createdAuthUser) {
          try {
            await adminAuth.deleteUser(userId);
          } catch (e) {
          }
        }
        return res.status(500).json({
          success: false,
          code: "USER_CREATION_VERIFICATION_FAILED",
          error: "User creation verification failed. Document not found in Firestore."
        });
      }
    } catch (verifyErr) {
      console.error("USER_FIRESTORE_PERSIST_FAILED", {
        userId,
        email: normalizedEmail,
        error: verifyErr?.message || String(verifyErr)
      });
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {
        }
      }
      return res.status(500).json({
        success: false,
        code: "USER_CREATION_VERIFICATION_FAILED",
        error: "Failed to verify user creation in Firestore."
      });
    }
    if (!db2.users) db2.users = [];
    const existingIdx = db2.users.findIndex((u) => u.id === userId || u.email?.toLowerCase() === normalizedEmail);
    if (existingIdx >= 0) {
      db2.users[existingIdx] = newUser;
    } else {
      db2.users.push(newUser);
    }
    writeDb(db2);
    if (invitation) {
      if (invitation.senderId) {
        try {
          const ceoRef = adminDb.collection("users").doc(invitation.senderId);
          const ceoSnap = await ceoRef.get();
          if (ceoSnap.exists) {
            const ceoData = ceoSnap.data() || {};
            const currentList = ceoData.teamMembersList || [];
            const existsIndex = currentList.findIndex((m) => m.email?.toLowerCase() === normalizedEmail);
            const updatedMember = {
              id: `tm-${userId}`,
              name: resolvedOwnerName,
              email: normalizedEmail,
              role: effectiveRole,
              powers: invitation.powers || [],
              addedAt: nowIso.split("T")[0]
            };
            if (existsIndex >= 0) {
              currentList[existsIndex] = updatedMember;
            } else {
              currentList.push(updatedMember);
            }
            await ceoRef.update({ teamMembersList: currentList });
          }
        } catch (ceoErr) {
          console.warn("Failed to sync team members on CEO account:", ceoErr);
        }
      }
      try {
        await adminDb.collection("invitations").doc(normalizedEmail).delete();
      } catch (e) {
      }
      const dbInv = readDb();
      if (dbInv.invitations) {
        dbInv.invitations = dbInv.invitations.filter((i) => i.email?.trim().toLowerCase() !== normalizedEmail);
        writeDb(dbInv);
      }
    }
    await setAccountLifecycleRecord({
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      originalUserId: userId,
      retainedDataDocPath: null,
      adminApprovalRequired: false
    });
    const otpCode = crypto.randomInt(1e5, 1e6).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    const docId = userId;
    const otpRecord = {
      id: docId,
      userId,
      email: normalizedEmail,
      phone: "",
      codeHash,
      type: "account_registration",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt,
      attempts: 0,
      used: false,
      sendCount: 0,
      initialOtpSent: true,
      lastSentAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await adminDb.collection("verification_codes").doc(docId).set(otpRecord);
      console.log("OTP_CREATED", { userId, docId });
      console.log("OTP_STORED", { userId, docId });
    } catch (otpDbErr) {
      console.error("OTP_STORAGE_FAILED", {
        userId,
        email: normalizedEmail,
        error: otpDbErr?.message || String(otpDbErr)
      });
      try {
        await userRef.delete();
      } catch (e) {
      }
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {
        }
      }
      return res.status(500).json({
        success: false,
        code: "OTP_STORAGE_FAILED",
        error: "Failed to store verification code in database. Registration aborted."
      });
    }
    if (!db2.verification_codes) db2.verification_codes = [];
    db2.verification_codes = db2.verification_codes.filter((vc) => vc.id !== docId);
    db2.verification_codes.push(otpRecord);
    writeDb(db2);
    const resolvedUserName = cleanUserName(resolvedOwnerName, normalizedEmail);
    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: normalizedEmail,
      userName: resolvedUserName,
      otpCode,
      type: "account_registration"
    });
    const mailResult = await sendSystemMail(normalizedEmail, emailSubject, textBody, htmlBody);
    if (!mailResult.success) {
      console.error("OTP_EMAIL_FAILED", {
        userId,
        email: normalizedEmail,
        error: mailResult.error?.message || mailResult.error || "Mail dispatch failed"
      });
      try {
        await userRef.delete();
      } catch (e) {
      }
      try {
        await adminDb.collection("verification_codes").doc(docId).delete();
      } catch (e) {
      }
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {
        }
      }
      return res.status(500).json({
        success: false,
        code: "OTP_EMAIL_FAILED",
        error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to send verification email. Please check your email address and try again."
      });
    }
    console.log("OTP_EMAIL_SENT", { userId, email: normalizedEmail });
    console.log("REGISTRATION_COMPLETED", { userId, email: normalizedEmail });
    const { passwordHash, ...userResponse } = newUser;
    return res.status(201).json({
      success: true,
      user: userResponse,
      initialOtpSent: true,
      sendCount: 0,
      message: "Registration completed successfully. Verification code sent to your email."
    });
  } catch (err) {
    console.error("REGISTRATION_FAILED_UNHANDLED", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during registration."
    });
  }
});
app.post("/api/auth/login", loginRegisterLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const db2 = readDb();
  const user = db2.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const isVerified = user.isVerified === true || user.isEmailVerified === true || user.emailVerified === true || user.verification_status === "verified" || user.verification_required === false;
  const { passwordHash, ...userResponse } = user;
  res.json({
    ...userResponse,
    isVerified,
    isEmailVerified: isVerified,
    email_verified: isVerified,
    emailVerified: isVerified,
    verification_required: !isVerified,
    verification_status: isVerified ? "verified" : "unverified"
  });
});
app.get("/api/memories", requireAuth, (req, res) => {
  const db2 = readDb();
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const filtered = (db2.memories || []).filter((m) => m.userId === authUserId);
  res.json(filtered);
});
app.post("/api/memories", requireAuth, (req, res) => {
  const { title, category, riskLevel, tags, description, decision, causalFactors, outcomes, lessonsLearned, authorEmail, authorRole, authorName } = req.body;
  if (!title || !category || !riskLevel || !description || !decision) {
    return res.status(400).json({ error: "Missing required memory content fields." });
  }
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const db2 = readDb();
  const newMemory = {
    id: req.body.id || "mem_" + Math.random().toString(36).substr(2, 9),
    title,
    category,
    riskLevel,
    tags: Array.isArray(tags) ? tags : tags ? String(tags).split(",").map((t) => t.trim()) : [],
    description,
    decision,
    causalFactors: causalFactors || "",
    outcomes: outcomes || "",
    lessonsLearned: lessonsLearned || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    userId: authUserId,
    // Strictly enforced server-side
    authorEmail: authorEmail || req.user?.email || "user@zakir.ai",
    authorRole: authorRole || "Analyst",
    authorName: authorName || (req.user?.email ? req.user.email.split("@")[0] : "User")
  };
  if (!db2.memories) db2.memories = [];
  db2.memories.unshift(newMemory);
  const newMetric = {
    id: "met_" + Math.random().toString(36).substr(2, 9),
    userId: authUserId,
    // Strictly enforced server-side
    actionType: "Log Memory",
    metricValue: 1,
    description: `Added strategic memory: ${title}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!db2.user_metrics) db2.user_metrics = [];
  db2.user_metrics.unshift(newMetric);
  writeDb(db2);
  res.status(201).json(newMemory);
});
app.delete("/api/memories/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const db2 = readDb();
  const memory = (db2.memories || []).find((m) => m.id === id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found." });
  }
  if (memory.userId !== authUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot delete memory owned by another user." });
  }
  const index = db2.memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    db2.memories.splice(index, 1);
    writeDb(db2);
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Memory not found." });
});
app.put("/api/memories/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const db2 = readDb();
  const memory = (db2.memories || []).find((m) => m.id === id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found." });
  }
  if (memory.userId !== authUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot edit memory owned by another user." });
  }
  const index = db2.memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    const { title, category, riskLevel, tags, description, decision, causalFactors, outcomes, lessonsLearned } = req.body;
    db2.memories[index] = {
      ...db2.memories[index],
      title: title || db2.memories[index].title,
      category: category || db2.memories[index].category,
      riskLevel: riskLevel || db2.memories[index].riskLevel,
      tags: tags ? Array.isArray(tags) ? tags : String(tags).split(",").map((t) => t.trim()) : db2.memories[index].tags,
      description: description || db2.memories[index].description,
      decision: decision || db2.memories[index].decision,
      causalFactors: causalFactors !== void 0 ? causalFactors : db2.memories[index].causalFactors,
      outcomes: outcomes !== void 0 ? outcomes : db2.memories[index].outcomes,
      lessonsLearned: lessonsLearned !== void 0 ? lessonsLearned : db2.memories[index].lessonsLearned
    };
    writeDb(db2);
    return res.json(db2.memories[index]);
  }
  res.status(404).json({ error: "Memory not found." });
});
app.get("/api/risk-alerts", (req, res) => {
  const db2 = readDb();
  res.json(db2.risk_alerts || []);
});
app.post("/api/risk-alerts", (req, res) => {
  const db2 = readDb();
  const newAlert = {
    id: req.body.id || `al_${Date.now()}`,
    title: req.body.title || "Risk Alert",
    category: req.body.category || "Operational Assets",
    severity: req.body.severity || "High",
    description: req.body.description || "",
    status: req.body.status || "Active",
    createdAt: req.body.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!db2.risk_alerts) db2.risk_alerts = [];
  db2.risk_alerts.unshift(newAlert);
  writeDb(db2);
  res.json(newAlert);
});
app.post("/api/risk-alerts/resolve", (req, res) => {
  const { id } = req.body;
  const db2 = readDb();
  const alertIndex = db2.risk_alerts.findIndex((a) => a.id === id);
  if (alertIndex !== -1) {
    db2.risk_alerts[alertIndex].status = "Resolved";
    writeDb(db2);
    return res.json(db2.risk_alerts[alertIndex]);
  }
  res.status(404).json({ error: "Alert not found." });
});
app.get("/api/metrics", (req, res) => {
  const db2 = readDb();
  res.json(db2.user_metrics);
});
app.get("/api/world-bank", async (req, res) => {
  const country = req.query.country || "MR";
  const indicator = req.query.indicator || "NY.GDP.MKTP.KD.ZG";
  const rawStart = parseInt(req.query.startYear) || 2015;
  const rawEnd = parseInt(req.query.endYear) || 2024;
  const startYear = Math.min(rawStart, rawEnd);
  const endYear = Math.max(rawStart, rawEnd);
  const attemptedUrl = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&date=${startYear}:${endYear}`;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4e3);
    const response = await fetch(attemptedUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZakirRiskEngine/1.0"
      }
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    if (!response.ok) {
      throw new Error(`\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062F\u0648\u0644\u064A \u0623\u0631\u062C\u0639\u062A \u0631\u0645\u0632 HTTP \u063A\u064A\u0631 \u0646\u0627\u062C\u062D: ${response.status} (${response.statusText})`);
    }
    const data = await response.json();
    const parseWbVal = (val) => {
      if (val === null || val === void 0 || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : parseFloat(num.toFixed(2));
    };
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0) {
      const records = data[1].map((item) => ({
        year: parseInt(item.date),
        value: parseWbVal(item.value),
        country: item.country?.value || country,
        indicatorName: item.indicator?.value || ""
      })).filter((r) => !isNaN(r.year)).sort((a, b) => a.year - b.year);
      if (records.length > 0) {
        return res.json({
          success: true,
          country,
          indicator,
          startYear,
          endYear,
          data: records,
          fallback: false,
          source: "live_worldbank_api",
          latencyMs,
          attemptedUrl
        });
      }
    }
    const wbMessage = Array.isArray(data) && data[0]?.message?.[0]?.value ? data[0].message[0].value : `\u0644\u0645 \u062A\u0631\u062C\u0639 \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062F\u0648\u0644\u064A \u0623\u064A\u0629 \u0633\u062C\u0644\u0627\u062A \u0642\u064A\u0627\u0633\u064A\u0629 \u0631\u0642\u0645\u064A\u0629 \u0644\u0644\u0633\u0646\u0648\u0627\u062A \u0645\u0646 ${startYear} \u0625\u0644\u0649 ${endYear}.`;
    throw new Error(`\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062F\u0648\u0644\u064A \u0641\u0627\u0631\u063A\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639\u0629: ${wbMessage}`);
  } catch (err) {
    const isTimeout = err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("abort");
    const latencyMs = Date.now() - startTime;
    console.warn(`[WorldBank Proxy Warning] ${attemptedUrl} - ${err.message}`);
    const fallbackData = generateWorldBankFallbackData(country, indicator, startYear, endYear);
    return res.json({
      success: true,
      country,
      indicator,
      startYear,
      endYear,
      data: fallbackData,
      fallback: true,
      source: "benchmark_fallback_dataset",
      latencyMs,
      errorDetails: isTimeout ? "\u0627\u0633\u062A\u063A\u0631\u0642\u062A \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062F\u0648\u0644\u064A \u0623\u0643\u062B\u0631 \u0645\u0646 4 \u062B\u0648\u0627\u0646 (Timeout). \u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062D\u0632\u0645\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 \u0627\u0644\u0645\u0648\u062B\u0642\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B." : `\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062F\u0648\u0644\u064A (${err.message}). \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u062D\u0632\u0645\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 \u0627\u0644\u0645\u0648\u062B\u0642\u0629.`,
      technicalLogs: {
        attemptedUrl,
        error: err.message,
        isTimeout,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
});
app.all("/api/database/schema", requireAuth, async (req, res) => {
  try {
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }
    const db2 = readDb();
    const usersArr = Array.isArray(db2?.users) ? db2.users : [];
    const user = usersArr.find((u) => u.id === authUserId);
    const isUserAdmin = await isUserAdminServer(authUserId);
    const userRole = user ? user.role : isUserAdmin ? "CEO" : "Analyst";
    const isAuthorized = userRole === "CEO" || userRole === "Admin" || userRole === "Compliance Officer" || isUserAdmin;
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: Restricted to administrative and compliance personnel only." });
    }
    const schemaDdl = `-- PostgreSQL Database Schema for Zakir (\u0630\u064E\u0643\u0650\u0631\u0652)
-- Securely stores institutional causal memories, audit metrics, and RBAC

CREATE TYPE user_role AS ENUM ('CEO', 'Admin', 'Compliance Officer', 'Analyst');
CREATE TYPE risk_severity AS ENUM ('Low', 'Medium', 'High', 'Critical');

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'Analyst',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trial_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE memories (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    risk_level risk_severity NOT NULL DEFAULT 'Low',
    tags VARCHAR(50)[] DEFAULT '{}',
    description TEXT NOT NULL,
    decision TEXT NOT NULL,
    causal_factors TEXT,
    outcomes TEXT,
    lessons_learned TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE risk_alerts (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity risk_severity NOT NULL DEFAULT 'Medium',
    description TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('Active', 'Resolved')) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_metrics (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    metric_value INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;
    return res.json({ ddl: schemaDdl });
  } catch (err) {
    console.error("Error fetching database schema:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch database schema" });
  }
});
app.post("/api/database/query", requireAuth, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "SQL query string is required" });
  }
  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  const authUserEmail = req.user?.email || "";
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const db2 = readDb();
  const user = db2.users.find((u) => u.id === authUserId);
  const isUserAdmin = await isUserAdminServer(authUserId);
  const userRole = user ? user.role : isUserAdmin ? "CEO" : "Analyst";
  const isAuthorized = userRole === "CEO" || userRole === "Admin" || userRole === "Compliance Officer" || isUserAdmin;
  console.log("DB_QUERY_AUTH", { authUserId, authUserEmail, userRole, isUserAdmin, isAuthorized });
  if (!isAuthorized) {
    return res.status(403).json({ error: "Forbidden: Restricted to administrative and compliance personnel only." });
  }
  const startTime = Date.now();
  const trimmed = query.trim().toUpperCase();
  try {
    let columns = [];
    let rows = [];
    if (trimmed.startsWith("SELECT")) {
      let targetTable = "";
      if (trimmed.includes("FROM USERS")) targetTable = "users";
      else if (trimmed.includes("FROM MEMORIES")) targetTable = "memories";
      else if (trimmed.includes("FROM RISK_ALERTS") || trimmed.includes("FROM RISK-ALERTS")) targetTable = "risk_alerts";
      else if (trimmed.includes("FROM USER_METRICS") || trimmed.includes("FROM USER-METRICS")) targetTable = "user_metrics";
      if (!targetTable) {
        throw new Error("Table not found or queries outside scope. Supported tables: users, memories, risk_alerts, user_metrics.");
      }
      let tableData = db2[targetTable] || [];
      if (!isUserAdmin) {
        if (targetTable === "users") {
          tableData = tableData.filter((item) => item.id === authUserId);
        } else if (targetTable === "memories" || targetTable === "risk_alerts" || targetTable === "user_metrics") {
          tableData = tableData.filter((item) => item.userId === authUserId);
        }
      }
      if (targetTable === "users") {
        tableData = tableData.map((item) => {
          const { passwordHash, ...safeUser } = item;
          return safeUser;
        });
      }
      const selectPart = trimmed.split("FROM")[0].replace("SELECT", "").trim();
      let keysToExtract = [];
      if (tableData.length > 0) {
        if (selectPart === "*") {
          keysToExtract = Object.keys(tableData[0]);
        } else {
          keysToExtract = selectPart.split(",").map((c) => c.trim().toLowerCase());
        }
      } else {
        keysToExtract = ["id", "status"];
      }
      keysToExtract = keysToExtract.filter((k) => k !== "passwordhash" && k !== "password_hash");
      columns = keysToExtract.map((k) => k.toUpperCase());
      rows = tableData.map((item) => {
        return keysToExtract.map((key) => {
          let val = item[key] !== void 0 ? item[key] : item[Object.keys(item).find((k) => k.toLowerCase() === key.toLowerCase()) || ""];
          if (Array.isArray(val)) return `{${val.join(",")}}`;
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        });
      });
      res.json({
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - startTime
      });
    } else if (trimmed.startsWith("INSERT INTO")) {
      res.json({
        columns: ["STATUS"],
        rows: [["INSERT 0 1"]],
        rowCount: 1,
        executionTimeMs: Date.now() - startTime
      });
    } else {
      throw new Error("Syntax Error: Zakir's client-side SQL editor supports standard read-only PostgreSQL queries (SELECT * FROM users/memories/user_metrics/risk_alerts) for live operational visualization.");
    }
  } catch (error) {
    res.json({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: error.message || "Unknown database execution error."
    });
  }
});
app.post("/api/smart-evolution", async (req, res) => {
  const { lang = "ar" } = req.body;
  let { memories, riskAlerts } = req.body;
  const db2 = readDb();
  if (!memories) {
    memories = db2.memories || [];
  }
  if (!riskAlerts) {
    riskAlerts = db2.risk_alerts || [];
  }
  const fallbackRisksList = [];
  const fallbackForecastsList = [];
  const fallbackOpportunitiesList = [];
  const fallbackRecommendationsList = [];
  for (const m of memories) {
    const riskLevelStr = m.riskLevel || "High";
    if (lang === "ar") {
      fallbackRisksList.push({
        title: `\u062E\u0637\u0631 \u0645\u0627\u0644\u064A/\u062A\u0634\u063A\u064A\u0644\u064A \u0641\u064A ${m.category}`,
        severity: riskLevelStr === "Critical" ? "\u062D\u0631\u0650\u062C" : riskLevelStr === "High" ? "\u0645\u0631\u062A\u0641\u0639" : riskLevelStr === "Medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u0645\u0646\u062E\u0641\u0636",
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062D\u062F\u062B (${m.title}) \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0646\u0634\u0648\u0621 \u0645\u062E\u0627\u0637\u0631 \u0628\u0633\u0628\u0628: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `\u062A\u0648\u0642\u0639 \u0627\u0644\u062A\u0623\u062B\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0640 ${m.title}`,
        timeframe: "\u062E\u0644\u0627\u0644 30-60 \u064A\u0648\u0645",
        impact: riskLevelStr === "Critical" ? "\u062D\u0631\u0650\u062C" : riskLevelStr === "High" ? "\u0645\u0631\u062A\u0641\u0639" : riskLevelStr === "Medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u0645\u0646\u062E\u0641\u0636",
        details: `\u0627\u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0628\u0627\u0644\u0646\u0645\u0637 \u0627\u0644\u062D\u0627\u0644\u064A \u0642\u062F \u064A\u0624\u062F\u064A \u0644\u0646\u062A\u0627\u0626\u062C \u0645\u0634\u0627\u0628\u0647\u0629 \u0644\u0640: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `\u0623\u062A\u0645\u062A\u0629 \u0648\u062A\u0637\u0648\u064A\u0631 \u0636\u0648\u0627\u0628\u0637 \u0641\u064A ${m.category}`,
        feasibility: "\u0645\u0631\u062A\u0641\u0639",
        benefit: `\u062A\u062E\u0641\u064A\u0641 \u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0640 ${riskLevelStr === "Critical" ? "\u062D\u0631\u0650\u062C" : riskLevelStr === "High" ? "\u0627\u0644\u0645\u0631\u062A\u0641\u0639\u0629" : "\u0627\u0644\u0645\u062A\u0648\u0633\u0637\u0629"}`,
        details: `\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u062A\u0642\u0644\u064A\u062F\u064A \u0625\u0644\u0649 \u0646\u0638\u0627\u0645 \u0645\u0624\u062A\u0645\u062A \u0644\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u062B\u063A\u0631\u0627\u062A \u0627\u0644\u0645\u0643\u062A\u0634\u0641\u0629 \u0641\u064A: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0648\u0642\u0627\u0626\u064A \u0645\u0639\u062A\u0645\u062F \u0644\u0640 ${m.category}`,
        priority: riskLevelStr === "Critical" ? "\u062D\u0631\u0650\u062C" : riskLevelStr === "High" ? "\u0645\u0631\u062A\u0641\u0639" : riskLevelStr === "Medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u0645\u0646\u062E\u0641\u0636",
        actionable: m.lessonsLearned || "\u062A\u0641\u0639\u064A\u0644 \u0646\u0638\u0627\u0645 \u0641\u062D\u0635 \u0648\u0645\u0631\u0627\u0642\u0628\u0629 \u0641\u0648\u0631\u064A \u0644\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0644\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629.",
        details: `\u062A\u0646\u0641\u064A\u0630 \u062A\u0648\u0635\u064A\u0627\u062A \u0627\u0644\u062D\u062F\u062B (${m.title}) \u0639\u0628\u0631 \u0635\u064A\u0627\u063A\u0629 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u062A\u062D\u0643\u0645 \u0645\u0632\u062F\u0648\u062C \u0648\u0627\u0644\u062D\u062F \u0645\u0646 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u0627\u062A \u0627\u0644\u0628\u0634\u0631\u064A\u0629 \u0627\u0644\u0641\u0631\u062F\u064A\u0629.`
      });
    } else if (lang === "fr") {
      fallbackRisksList.push({
        title: `Risque d'exploitation dans ${m.category}`,
        severity: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "\xC9lev\xE9" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `L'analyse de l'\xE9v\xE9nement (${m.title}) indique des risques potentiels dus \xE0: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `Impact financier pr\xE9vu de ${m.title}`,
        timeframe: "Sous 30-60 jours",
        impact: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "\xC9lev\xE9" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        details: `Continuer dans cette voie peut conduire \xE0 des r\xE9sultats similaires \xE0: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `Automatisation des contr\xF4les dans ${m.category}`,
        feasibility: "\xC9lev\xE9e",
        benefit: `Att\xE9nuation du risque ${riskLevelStr}`,
        details: `Passer d'une proc\xE9dure manuelle \xE0 un syst\xE8me automatis\xE9 pour combler les lacunes de: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `Protocole pr\xE9ventif agr\xE9\xE9 pour ${m.category}`,
        priority: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "\xC9lev\xE9" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        actionable: m.lessonsLearned || "Mettre en place un syst\xE8me de surveillance continue pour \xE9viter les erreurs r\xE9p\xE9titives.",
        details: `Appliquer les le\xE7ons de (${m.title}) en instaurant des m\xE9canismes de contr\xF4le rigoureux.`
      });
    } else {
      fallbackRisksList.push({
        title: `Operational Risk in ${m.category}`,
        severity: riskLevelStr,
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `Analysis of event (${m.title}) indicates potential exposure due to: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `Projected Financial Impact of ${m.title}`,
        timeframe: "Within 30-60 Days",
        impact: riskLevelStr === "Critical" ? "Critical" : riskLevelStr === "High" ? "High" : riskLevelStr === "Medium" ? "Medium" : "Low",
        details: `Persistence of this pattern is projected to yield outcomes similar to: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `Automate and Standardize controls in ${m.category}`,
        feasibility: "High",
        benefit: `Mitigate ${riskLevelStr} severity risk`,
        details: `Transition from manual processing to an automated ruleset to close screening gaps highlighted in: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `Enforce preventative protocol for ${m.category}`,
        priority: riskLevelStr,
        actionable: m.lessonsLearned || "Enforce automated dual-authorization checks to eliminate individual error.",
        details: `Enact the remediation strategies derived from (${m.title}) to fortify process workflows.`
      });
    }
  }
  const activeRisksCount = riskAlerts.filter((a) => a.status === "Active" || a.status === "\u0646\u0634\u0637" || a.status === "actif").length;
  const fallbackExecutiveSummary = lang === "ar" ? `### Heuristic analysis \u2014 AI unavailable

\u062A\u0634\u062E\u064A\u0635 \u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0627\u0644\u0645\u0633\u062C\u0644\u0629 (${memories.length} \u0630\u0643\u0631\u064A\u0627\u062A \u0645\u0624\u0633\u0633\u064A\u0629) \u064A\u0631\u0628\u0637 \u0628\u064A\u0646 \u0627\u0644\u0633\u0628\u0628 \u0648\u0627\u0644\u0623\u062B\u0631 \u0644\u0643\u0634\u0641 \u062B\u063A\u0631\u0627\u062A \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0641\u064A \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629. \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u064A\u062D\u062F\u062F \u0627\u0644\u0627\u0646\u0643\u0634\u0627\u0641\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u064A\u0648\u0641\u0631 \u062A\u0648\u0635\u064A\u0627\u062A \u0625\u062C\u0631\u0627\u0626\u064A\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u062A\u0641\u0627\u062F\u064A \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0648\u062D\u0645\u0627\u064A\u0629 \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629.` : lang === "fr" ? `### Heuristic analysis \u2014 AI unavailable

L'analyse diagnostique de ${memories.length} souvenirs institutionnels relie la cause \xE0 l'effet pour r\xE9v\xE9ler les failles op\xE9rationnelles et financi\xE8res. L'\xE9valuation fournit des recommandations directement applicables.` : `### Heuristic analysis \u2014 AI unavailable

Diagnostic analysis of ${memories.length} institutional memories maps cause-and-effect patterns to identify unaddressed operational and financial vulnerabilities, offering actionable recommendations.`;
  const defaultPayload = {
    executiveSummary: fallbackExecutiveSummary,
    analyzedMemories: memories.length,
    identifiedRisks: activeRisksCount,
    opportunities: fallbackOpportunitiesList.length,
    recommendations: fallbackRecommendationsList.length,
    risksList: fallbackRisksList,
    forecastsList: fallbackForecastsList,
    opportunitiesList: fallbackOpportunitiesList,
    recommendationsList: fallbackRecommendationsList
  };
  const ai = getGeminiClient();
  if (!ai || memories.length === 0) {
    return res.json(defaultPayload);
  }
  try {
    const memoriesSummary = memories.map((m, index) => {
      return `[\u0627\u0644\u0630\u0643\u0631\u0649 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 #${index + 1}]:
- \u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${m.title}
  \u0627\u0644\u0641\u0626\u0629: ${m.category}
  \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629: ${m.riskLevel || "High"}
  \u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u062A\u062E\u0630: ${m.decision}
  \u0627\u0644\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u0645\u0633\u0628\u0628\u0629: ${m.causalFactors || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}
  \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u062D\u0642\u0642\u0629: ${m.outcomes || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}
  \u0627\u0644\u062F\u0631\u0648\u0633 \u0627\u0644\u0645\u0633\u062A\u0641\u0627\u062F\u0629: ${m.lessonsLearned || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}`;
    }).join("\n\n");
    const activeRisksSummary = riskAlerts.length > 0 ? riskAlerts.map((r, idx) => `[\u062A\u0646\u0628\u064A\u0647 \u062E\u0637\u0631 \u0646\u0634\u0637 #${idx + 1}]: ${r.title} | \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629: ${r.severity || "High"} | \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644: ${r.description || ""}`).join("\n") : "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0645\u062E\u0627\u0637\u0631 \u0625\u0636\u0627\u0641\u064A\u0629 \u062D\u0631\u062C \u062D\u0627\u0644\u064A\u0627\u064B.";
    const systemInstruction = `\u0623\u0646\u062A \u0627\u0644\u0645\u062D\u0631\u0643 \u0627\u0644\u062A\u062D\u0644\u064A\u0644\u064A \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0644\u0642\u0633\u0645 "\u0627\u0644\u062A\u0637\u0648\u0631 \u0627\u0644\u0630\u0643\u064A" \u0641\u064A \u0645\u0646\u0635\u0629 "\u0630\u064E\u0643\u0650\u0631\u0652" \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0648\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0634\u0627\u0645\u0644\u0629.

[\u0645\u0647\u0627\u0645 \u0645\u062D\u0631\u0643 \u0627\u0644\u062A\u0637\u0648\u0631 \u0627\u0644\u0630\u0643\u064A]:
1. \u062F\u0631\u0627\u0633\u0629 \u0643\u0627\u0645\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629: \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0648\u0627\u0644\u0630\u0643\u0631\u064A\u0627\u062A \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 (${memories.length}) \u0648\u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0646\u0634\u0637\u0629 (${activeRisksCount}).
2. \u0631\u0628\u0637 \u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0648\u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0628\u0627\u0644\u0638\u0631\u0648\u0641 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629 \u0627\u0644\u0643\u0644\u064A\u0629\u060C \u0648\u062A\u0648\u062C\u0647\u0627\u062A \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629\u060C \u0648\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641\u060C \u0648\u0623\u062E\u0628\u0627\u0631 \u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0648\u0627\u0644\u062A\u0636\u062E\u0645 \u0627\u0644\u062F\u0648\u0644\u064A \u0644\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0627\u0646\u0643\u0634\u0627\u0641\u0627\u062A.
3. \u0625\u062C\u0631\u0627\u0621 \u062A\u0634\u062E\u064A\u0635 \u0633\u0628\u0628\u064A \u0639\u0645\u064A\u0642 (Causal Analysis) \u0644\u0644\u0631\u0628\u0637 \u0628\u064A\u0646 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u062D\u0642\u0642\u0629 \u0648\u062A\u0641\u0627\u062F\u064A \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629.
4. \u0635\u064A\u0627\u063A\u0629 \u062A\u0642\u0631\u064A\u0631 \u062A\u0637\u0648\u0631 \u0630\u0643\u064A \u0645\u0648\u062C\u0647 \u0644\u0642\u064A\u0627\u062F\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u0629 \u064A\u0634\u0645\u0644: \u0645\u0644\u062E\u0635 \u062A\u0634\u062E\u064A\u0635\u064A\u060C \u0645\u062E\u0627\u0637\u0631 \u0648\u062A\u0648\u0642\u0639\u0627\u062A \u0645\u0633\u062A\u0642\u0628\u0644\u064A\u0629\u060C \u0641\u0631\u0635 \u062A\u0637\u0648\u064A\u0631\u060C \u0648\u062A\u0648\u0635\u064A\u0627\u062A \u062A\u0646\u0641\u064A\u062F\u064A\u0629 \u062F\u0642\u064A\u0642\u0629.

[\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0645\u062E\u0631\u062C\u0627\u062A]:
\u064A\u062C\u0628 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0643\u0643\u0627\u0626\u0646 JSON \u0641\u0642\u0637 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u062E\u0631\u0627\u062C\u0647\u0627 ("${lang === "ar" ? "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u064A\u062D\u0629 \u0648\u0627\u0644\u062F\u0642\u064A\u0642\u0629" : lang === "fr" ? "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0641\u0631\u0646\u0633\u064A\u0629" : "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"}") \u0628\u0627\u0644\u0647\u064A\u0643\u0644 \u0627\u0644\u0645\u0648\u062D\u062F \u0627\u0644\u062A\u0627\u0644\u064A:
{
  "executiveSummary": "\u0645\u0644\u062E\u0635 \u062A\u0634\u062E\u064A\u0635\u064A \u0634\u0627\u0645\u0644 \u064A\u062D\u0644\u0644 \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0648\u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u064A\u0631\u0628\u0637\u0647\u0627 \u0628\u0638\u0631\u0648\u0641 \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 \u0648\u0627\u0644\u062A\u063A\u064A\u0631\u0627\u062A \u0627\u0644\u062C\u064A\u0648\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629 \u0644\u0645\u0646\u0639 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621",
  "analyzedMemories": number,
  "identifiedRisks": number,
  "opportunities": number,
  "recommendations": number,
  "risksList": [{"title": "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062E\u0637\u0631 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0623\u0648 \u0627\u0644\u0645\u0627\u0644\u064A", "severity": "\u062D\u0631\u0650\u062C / \u0645\u0631\u062A\u0641\u0639 / \u0645\u062A\u0648\u0633\u0637", "probability": "\u0646\u0633\u0628\u0629 \u0623\u0648 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0627\u062D\u062A\u0645\u0627\u0644\u064A\u0629", "details": "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062E\u0637\u0631 \u0648\u0631\u0628\u0637\u0647 \u0628\u0627\u0644\u0633\u0648\u0642 \u0648\u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629"}],
  "forecastsList": [{"title": "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062A\u0648\u0642\u0639 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A", "timeframe": "\u0627\u0644\u0625\u0637\u0627\u0631 \u0627\u0644\u0632\u0645\u0646\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644\u064A", "impact": "\u0639\u0627\u0644\u064A / \u0645\u062A\u0648\u0633\u0637 / \u0645\u0646\u062E\u0641\u0636", "details": "\u062A\u062D\u0644\u064A\u0644 \u0623\u062B\u0631 \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644\u064A \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0633\u0648\u0642 \u0648\u0627\u0644\u062E\u0628\u0631\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629"}],
  "opportunitiesList": [{"title": "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u0631\u0635\u0629 \u0627\u0644\u062A\u0637\u0648\u064A\u0631\u064A\u0629", "feasibility": "\u0645\u0631\u062A\u0641\u0639 / \u0645\u062A\u0648\u0633\u0637", "benefit": "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0641\u0627\u0626\u062F\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629", "details": "\u0643\u064A\u0641\u064A\u0629 \u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0627\u0644\u0641\u0631\u0635\u0629 \u0644\u0631\u0641\u0639 \u0627\u0644\u0643\u0641\u0627\u0621\u0629 \u0648\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u0623\u062E\u0637\u0627\u0621"}],
  "recommendationsList": [{"title": "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062A\u0648\u0635\u064A\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629", "priority": "\u062D\u0631\u0650\u062C / \u0645\u0631\u062A\u0641\u0639 / \u0645\u062A\u0648\u0633\u0637", "actionable": "\u0625\u062C\u0631\u0627\u0621 \u0639\u0645\u0644\u064A \u0645\u0628\u0627\u0634\u0631 \u0648\u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0637\u0628\u064A\u0642", "details": "\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0627\u0644\u062D\u0648\u0643\u0645\u0629 \u0644\u0645\u0646\u0639 \u0627\u0644\u0627\u0646\u0643\u0634\u0627\u0641"}]
}`;
    let response;
    const fallbackModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
    for (let i = 0; i < fallbackModels.length; i++) {
      try {
        response = await ai.models.generateContent({
          model: fallbackModels[i],
          contents: [
            {
              role: "user",
              parts: [{ text: `\u0642\u0645 \u0628\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0644\u0645\u0624\u0633\u0633\u0629 \u0648\u0627\u0633\u062A\u0628\u0635\u0627\u0631 \u062A\u0648\u062C\u0647\u0627\u062A \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629:

### \u0627\u0644\u0630\u0627\u0643\u0631\u0627\u062A \u0648\u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629:
${memoriesSummary}

### \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0646\u0634\u0637\u0629:
${activeRisksSummary}` }]
            }
          ],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.35
          }
        });
        break;
      } catch (apiError) {
        if (i === fallbackModels.length - 1) throw apiError;
      }
    }
    const rawText = response?.text || "{}";
    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanText);
    res.json({
      executiveSummary: result.executiveSummary || fallbackExecutiveSummary,
      analyzedMemories: memories.length,
      identifiedRisks: activeRisksCount,
      opportunities: result.opportunitiesList?.length || fallbackOpportunitiesList.length,
      recommendations: result.recommendationsList?.length || fallbackRecommendationsList.length,
      risksList: result.risksList || fallbackRisksList,
      forecastsList: result.forecastsList || fallbackForecastsList,
      opportunitiesList: result.opportunitiesList || fallbackOpportunitiesList,
      recommendationsList: result.recommendationsList || fallbackRecommendationsList
    });
  } catch (e) {
    console.error("Gemini smart evolution failed, using database fallback:", e.message || e);
    res.json(defaultPayload);
  }
});
app.post("/api/market-intelligence", async (req, res) => {
  const { topic, industry, context, lang = "ar" } = req.body;
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required for market intelligence." });
  }
  const marketTopic = topic.trim();
  const targetSector = (industry || (lang === "ar" ? "\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 / \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629" : "Financial Services / Logistics")).trim();
  const geographicScope = (context || (lang === "ar" ? "\u0639\u0627\u0644\u0645\u064A / \u0625\u0642\u0644\u064A\u0645\u064A" : "Global / Regional")).trim();
  const generateDynamicFallback = () => {
    if (lang === "ar") {
      return {
        topic: marketTopic,
        industry: targetSector,
        context: geographicScope,
        summary: `### Heuristic analysis \u2014 AI unavailable

**\u0645\u0644\u062E\u0635 \u062A\u0646\u0641\u064A\u0630\u064A \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062C\u064A\u0648\u0627\u0642\u062A\u0635\u0627\u062F\u064A \u0648\u0627\u0644\u0645\u0627\u0644\u064A:**
\u062F\u0631\u0627\u0633\u0629 \u062A\u0642\u0644\u0628\u0627\u062A \u0648\u0627\u062A\u062C\u0627\u0647\u0627\u062A \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u062A\u0639\u0644\u0642\u0629 \u0628\u0640 **"${marketTopic}"** \u0641\u064A \u0642\u0637\u0627\u0639 **"${targetSector}"** \u0636\u0645\u0646 \u0646\u0637\u0627\u0642 **"${geographicScope}"** \u062A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0627\u0646\u0643\u0634\u0627\u0641\u0627\u062A \u0647\u064A\u0643\u0644\u064A\u0629 \u0648\u0645\u062E\u0627\u0637\u0631 \u062A\u0642\u0644\u0628\u0627\u062A \u0641\u064A \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641 \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F.

\u062A\u062A\u0637\u0644\u0628 \u0627\u0644\u062A\u062D\u0648\u0644\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u062A\u062D\u0648\u0637\u0627\u064B \u0645\u0627\u0644\u064A\u0627\u064B \u0648\u062A\u0634\u063A\u064A\u0644\u064A\u0627\u064B \u0627\u0633\u062A\u0628\u0627\u0642\u064A\u0627\u064B \u0644\u0631\u0628\u0637 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0628\u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0644\u0645\u0646\u0635\u0629 **\u0630\u064E\u0643\u0650\u0631\u0652** \u0648\u062A\u0641\u0627\u062F\u064A \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0639\u0646\u062F \u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0642\u0644\u0628\u0627\u062A \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u062F\u0648\u0644\u064A\u0629.`,
        risks: [
          `\u062A\u0642\u0644\u0628\u0627\u062A \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641 \u0648\u0647\u0627\u0645\u0634 \u0627\u0644\u0631\u0628\u062D \u0641\u064A \u0642\u0637\u0627\u0639 ${targetSector} \u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u062A\u063A\u064A\u0631\u0627\u062A \u0641\u064A ${marketTopic}.`,
          `\u0627\u062E\u062A\u0646\u0627\u0642\u0627\u062A \u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0648\u0627\u0644\u062A\u0623\u062E\u064A\u0631\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0641\u064A \u0646\u0637\u0627\u0642 ${geographicScope}.`,
          `\u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u062A\u0646\u0638\u064A\u0645\u064A\u0629 \u0648\u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644 \u0627\u0644\u0646\u0627\u062A\u062C \u0639\u0646 \u0639\u062F\u0645 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0633\u0628\u0628\u064A \u0627\u0644\u0644\u062D\u0638\u064A \u0644\u0644\u0642\u0631\u0627\u0631\u0627\u062A.`
        ],
        opportunities: [
          `\u062A\u0637\u0628\u064A\u0642 \u0623\u0637\u0631 \u062A\u062D\u0648\u0637 \u062F\u064A\u0646\u0627\u0645\u064A\u0643\u064A\u0629 \u0648\u0645\u0624\u062A\u0645\u062A\u0629 \u0645\u0642\u0627\u0628\u0644 \u062A\u0642\u0644\u0628\u0627\u062A \u0627\u0644\u0633\u0648\u0642 \u0644\u0642\u0637\u0627\u0639 ${targetSector}.`,
          `\u0627\u0633\u062A\u063A\u0644\u0627\u0644 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0644\u062D\u0638\u064A\u0629 \u0645\u0639 \u0645\u0646\u0635\u0629 \u0630\u064E\u0643\u0650\u0631\u0652 \u0644\u062A\u0648\u062B\u064A\u0642 \u0648\u062A\u062D\u0644\u064A\u0644 \u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F\u064A\u0629 \u0648\u0627\u0644\u0645\u0627\u0644\u064A\u0629.`,
          `\u062A\u0639\u0632\u064A\u0632 \u0627\u0644\u0645\u0631\u0648\u0646\u0629 \u0641\u064A \u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0648\u0627\u0644\u062A\u0648\u0633\u0639 \u0641\u064A \u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0646\u0637\u0627\u0642 ${geographicScope}.`
        ],
        recommendations: [
          `\u062A\u0623\u0633\u064A\u0633 \u062E\u0632\u0627\u0626\u0646 \u0645\u0639\u0631\u0641\u064A\u0629 \u0648\u062D\u0648\u0643\u0645\u0629 \u0631\u0642\u0645\u064A\u0629 \u0645\u0631\u0643\u0632\u064A\u0629 \u0641\u064A \u0645\u0646\u0635\u0629 \u0630\u064E\u0643\u0650\u0631\u0652 \u0644\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629.`,
          `\u0625\u0636\u0641\u0627\u0621 \u0627\u0644\u0637\u0627\u0628\u0639 \u0627\u0644\u0645\u0624\u0633\u0633\u064A \u0627\u0644\u0645\u0646\u0638\u0645 \u0639\u0644\u0649 \u0645\u0648\u0627\u0641\u0642\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0648\u0627\u0644\u062A\u062D\u0648\u0637 \u0644\u0645\u0646\u0639 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u062A\u0646\u0638\u064A\u0645\u064A\u0629.`,
          `\u0646\u0634\u0631 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0645\u0628\u0643\u0631\u0629 \u0639\u0646\u062F \u0631\u0635\u062F \u0645\u0624\u0634\u0631\u0627\u062A \u0645\u062D\u0627\u0643\u0627\u0629 \u0644\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0641\u064A \u0642\u0637\u0627\u0639 ${targetSector}.`
        ]
      };
    } else {
      return {
        topic: marketTopic,
        industry: targetSector,
        context: geographicScope,
        summary: `### Heuristic analysis \u2014 AI unavailable

**Executive & Geoeconomic Analysis:**
A strategic evaluation of market trends for **"${marketTopic}"** in the **"${targetSector}"** sector under **"${geographicScope}"** indicates systemic supply chain friction and foreign exchange (FX) exposure.

Proactive operational hedging and linking current trade decisions with **Zakir's** institutional memory are essential to prevent recurring corporate errors.`,
        risks: [
          `Foreign exchange volatility and margin compression in ${targetSector} stemming from ${marketTopic}.`,
          `Supply chain bottlenecks and shipping delays within ${geographicScope}.`,
          `Regulatory non-compliance risks caused by lack of immediate causal decision logging.`
        ],
        opportunities: [
          `Deploying dynamic, automated FX and supply chain hedging frameworks for ${targetSector}.`,
          `Leveraging real-time integration with Zakir to document causal drivers of trade and treasury choices.`,
          `Expanding supply chain resilience across ${geographicScope}.`
        ],
        recommendations: [
          `Establish centralized knowledge vaults and governance in Zakir to preserve operational memory.`,
          `Institutionalize multi-tier approval workflows for high-risk trade decisions.`,
          `Set up automated warning alerts when market indicators mirror past operational errors.`
        ]
      };
    }
  };
  const client = getGeminiClient();
  if (!client) {
    return res.json(generateDynamicFallback());
  }
  const systemInstruction = `\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u0648\u0645\u062D\u0644\u0644 \u0641\u064A \u0630\u0643\u0627\u0621 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0639\u0627\u0644\u0645\u064A \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u062F\u0648\u0644\u064A\u0629 \u0644\u0646\u0638\u0627\u0645 "\u0630\u0627\u0643\u0631".

[\u0627\u0644\u0645\u062F\u062E\u0644\u0627\u062A \u0645\u0646 \u0627\u0644\u0648\u0627\u062C\u0647\u0629]:
- \u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0633\u0648\u0642 / \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0645\u0631\u0627\u062F \u062A\u062D\u0644\u064A\u0644\u0647: ${marketTopic}
- \u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641: ${targetSector}
- \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u0631\u0643\u064A\u0632 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u064A / \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A: ${geographicScope}

[\u0627\u0644\u0645\u0647\u0627\u0645 \u0648\u0627\u0644\u0634\u0631\u0648\u0637]:
1. \u0642\u0645 \u0628\u062A\u062D\u0644\u064A\u0644 \u062A\u0642\u0644\u0628\u0627\u062A \u0648\u0627\u062A\u062C\u0627\u0647\u0627\u062A \u0627\u0644\u0633\u0648\u0642 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0623\u062D\u062F\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0648\u0627\u0644\u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u062F\u0648\u0644\u064A\u0629.
2. \u062D\u062F\u062F \u0623\u062B\u0631 \u0647\u0630\u0647 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0648\u0645\u062E\u0627\u0637\u0631 \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641 \u0630\u0627\u062A \u0627\u0644\u0635\u0644\u0629 \u0628\u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641.
3. \u0631\u0628\u0637 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0628\u062A\u0641\u0627\u062F\u064A \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0623\u062E\u0637\u0627\u0621 \u0627\u0644\u0645\u0624\u0633\u0633\u064A\u0629 \u0648\u062A\u062D\u062F\u064A\u062F \u0646\u0642\u0627\u0637 \u0627\u0644\u062E\u0637\u0631 \u0627\u0644\u0645\u062D\u062A\u0645\u0644\u0629.

[\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0645\u062E\u0631\u062C\u0627\u062A]:
\u064A\u062C\u0628 \u0623\u0646 \u062A\u0639\u064A\u062F \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0641\u0642\u0637 \u0639\u0644\u0649 \u0634\u0643\u0644 \u0643\u0627\u0626\u0646 JSON \u0635\u0627\u0644\u062D \u0628\u0627\u0644\u0635\u064A\u063A\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062F\u0648\u0646 \u0623\u064A \u0646\u0635 \u0625\u0636\u0627\u0641\u064A:
{
  "summary": "\u0645\u0644\u062E\u0635 \u062A\u0646\u0641\u064A\u0630\u064A \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062C\u064A\u0648\u0627\u0642\u062A\u0635\u0627\u062F\u064A \u0648\u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u062A\u0623\u062B\u064A\u0631\u0647 \u0639\u0644\u0649 \u0627\u0644\u062A\u062C\u0627\u0631\u0629 \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0648\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0635\u0631\u0641",
  "risks": ["\u062E\u0637\u0631 \u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0628\u0627\u0634\u0631 1", "\u062E\u0637\u0631 \u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0628\u0627\u0634\u0631 2", "\u062E\u0637\u0631 \u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0628\u0627\u0634\u0631 3"],
  "opportunities": ["\u0641\u0631\u0635\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 1", "\u0641\u0631\u0635\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 2", "\u0641\u0631\u0635\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 3"],
  "recommendations": ["\u062A\u0648\u0635\u064A\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0644\u0644\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0648\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u0623\u062E\u0637\u0627\u0621 1", "\u062A\u0648\u0635\u064A\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 2", "\u062A\u0648\u0635\u064A\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 3"]
}

\u062A\u0646\u0628\u064A\u0647 \u0645\u0647\u0645: \u064A\u062C\u0628 \u062A\u0648\u0644\u064A\u062F \u062C\u0645\u064A\u0639 \u0627\u0644\u0646\u0635\u0648\u0635 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: "${lang === "ar" ? "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u064A\u062D\u0629 \u0648\u0627\u0644\u062F\u0642\u064A\u0642\u0629" : lang === "fr" ? "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0641\u0631\u0646\u0633\u064A\u0629" : "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"}".`;
  const candidateModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
  let jsonOutput = null;
  for (const modelName of candidateModels) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: `\u0642\u0645 \u0628\u062A\u062D\u0644\u064A\u0644 \u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0633\u0648\u0642 "${marketTopic}" \u0641\u064A \u0642\u0637\u0627\u0639 "${targetSector}" \u0648\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A "${geographicScope}".` }]
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.4
        }
      });
      if (response?.text) {
        const cleanText = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        jsonOutput = JSON.parse(cleanText);
        if (jsonOutput && jsonOutput.summary) {
          break;
        }
      }
    } catch (err) {
      console.warn(`Market Intelligence model ${modelName} call failed:`, err.message || err);
    }
  }
  if (jsonOutput && jsonOutput.summary) {
    return res.json({
      topic: marketTopic,
      industry: targetSector,
      context: geographicScope,
      ...jsonOutput
    });
  }
  return res.json(generateDynamicFallback());
});
app.post("/api/agent/chat", async (req, res) => {
  try {
    const client = getGeminiClient();
    if (!client) {
      console.log("API Key is missing on server");
      return res.status(500).json({ error: "API Key is missing on the server. Please check environment variables in Settings." });
    }
    const promptText = req.body?.prompt || req.body?.message || req.body?.userMessage || req.body?.query;
    const { history, lang = "ar" } = req.body || {};
    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({ error: "Prompt/message string is required." });
    }
    const systemInstruction = `You are Zakir Cognitive Advisor. Answer the user's explicit question with deep, tailored, and accurate insights based directly on what they ask.`;
    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-10).forEach((h) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || "" }]
        });
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: promptText }]
    });
    const candidateModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
    let responseText = "";
    let lastError = null;
    for (const modelName of candidateModels) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7
          }
        });
        if (response?.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`Model ${modelName} failed:`, err.message || err);
        lastError = err;
      }
    }
    if (!responseText) {
      const errMsg = lastError?.message || "Failed to generate a response from Gemini API.";
      console.warn("Gemini API call failed:", errMsg);
      const isQuotaExhausted = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("prepayment");
      if (isQuotaExhausted) {
        const quotaNotice = "### AI Service temporarily unavailable\n\nThe AI reasoning service has reached its current usage limit.\nYour institutional data remains secure.\n\n[Try Again]";
        return res.json({ text: quotaNotice });
      }
      return res.json({ text: `[Zakir Cognitive Advisor Notice]: ${errMsg}` });
    }
    return res.json({ text: responseText });
  } catch (error) {
    console.error("Error in /api/agent/chat:", error);
    return res.json({ text: `[Zakir Cognitive Advisor Notice]: Request processing error: ${error.message || "Internal Error"}` });
  }
});
app.post("/api/render/services", async (req, res) => {
  try {
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const bodyToken = req.body?.apiKey;
    const apiKey = process.env.RENDER_API_KEY || headerToken || bodyToken;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error: "Render API Key is missing. Please set RENDER_API_KEY in your .env file or enter your Render API token in the settings."
      });
    }
    const response = await fetch("https://api.render.com/v1/services?limit=50", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Render API Error (${response.status}): ${errorText || response.statusText}`
      });
    }
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error in /api/render/services:", error);
    return res.status(500).json({
      error: `Internal server error when fetching Render services: ${error.message || String(error)}`
    });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API_ROUTE_NOT_FOUND",
    message: `API route not found: ${req.method} ${req.path}`
  });
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (req.path.startsWith("/api/")) {
    console.error(`API Error on ${req.method} ${req.path}:`, err);
    return res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "Internal Server Error"
    });
  }
  next(err);
});
async function startServer() {
  const httpServer = http.createServer(app);
  if (process.env.NODE_ENV !== "production") {
    const viteModule = "vite";
    const { createServer: createViteServer } = await import(
      /* @vite-ignore */
      viteModule
    );
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path3.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path3.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
var isStandalone = !isServerless && !process.env.SKIP_SERVER_LISTEN && process.env.NODE_ENV !== "test" && (process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server.cjs")) || process.env.STANDALONE_SERVER === "true");
if (isStandalone) {
  startServer().catch((err) => {
    console.error("Failed to start standalone server:", err);
  });
}
var server_default = app;

// api/index.ts
process.env.SKIP_SERVER_LISTEN = "true";
process.env.VERCEL = "1";
function handler(req, res) {
  try {
    const expressApp = server_default?.default || server_default;
    return expressApp(req, res);
  } catch (err) {
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
export {
  handler as default
};
