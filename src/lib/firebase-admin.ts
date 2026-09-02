import "./env.js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

function readLocalDb(): any {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
    // ignore
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

function writeLocalDb(data: any): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to write to local db_store.json:", e);
  }
}

function cleanPrivateKey(rawKey: string | undefined): string {
  if (!rawKey) return "";
  let key = rawKey.trim();
  
  // Remove wrapping quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  
  // Unescape backslashes
  key = key.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\"/g, '"');

  // If it's a standard PEM private key, clean and format base64 content
  if (key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) {
    const base64Body = key
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s+/g, ""); // Remove all whitespace / newlines
    
    const chunks = base64Body.match(/.{1,64}/g) || [base64Body];
    return `-----BEGIN PRIVATE KEY-----\n${chunks.join("\n")}\n-----END PRIVATE KEY-----\n`;
  }

  return key;
}

function resolveFirebaseCredentials() {
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let rawKey = process.env.FIREBASE_PRIVATE_KEY;

  // Fallback to firebase-applet-config.json for projectId
  if (!projectId) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (parsed.projectId) projectId = parsed.projectId;
      }
    } catch (e) {}
  }

  // Check for JSON service account in various common environment variables
  const candidateJsonVars = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    process.env.FIREBASE_CONFIG,
    process.env.GOOGLE_SERVICE_ACCOUNT,
    process.env.FIREBASE_ADMIN_CREDENTIALS,
  ];

  for (const candidate of candidateJsonVars) {
    if (candidate && candidate.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.project_id) projectId = projectId || parsed.project_id;
        if (parsed.client_email) clientEmail = clientEmail || parsed.client_email;
        if (parsed.private_key) rawKey = rawKey || parsed.private_key;
      } catch (e) {}
    }
  }

  // Also check if rawKey itself is JSON
  if (rawKey && rawKey.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.project_id) projectId = projectId || parsed.project_id;
      if (parsed.client_email) clientEmail = clientEmail || parsed.client_email;
      if (parsed.private_key) rawKey = parsed.private_key;
    } catch (e) {}
  }

  const cleanedKey = cleanPrivateKey(rawKey);
  const hasPemKey = cleanedKey.includes("-----BEGIN PRIVATE KEY-----");
  const isConfigured = Boolean(projectId && clientEmail && hasPemKey);

  return { projectId, clientEmail, cleanedKey, isConfigured };
}

const creds = resolveFirebaseCredentials();
export const isFirebaseAdminConfigured = creds.isConfigured;

let rawApp: any = null;
let rawFirestore: any = null;
let rawAuth: any = null;
let rawStorage: any = null;

if (isFirebaseAdminConfigured) {
  try {
    if (getApps().length > 0) {
      rawApp = getApps()[0];
    } else {
      rawApp = initializeApp({
        credential: cert({
          projectId: creds.projectId!,
          clientEmail: creds.clientEmail!,
          privateKey: creds.cleanedKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "potent-turbine-47c1c.firebasestorage.app",
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
      } catch (e) {}
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

export const isFirebaseAdminAvailable = Boolean(rawFirestore);
export const isFirebaseAuthAvailable = Boolean(rawAuth);
export const adminStorage = rawStorage;

export function getSafeBucket(): any {
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
    console.warn("Notice: getSafeBucket warning:", (err as any)?.message || err);
    return null;
  }
}

// Helper for local mock collection mappings
function getCollectionArrayName(colName: string): string {
  const map: Record<string, string> = {
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

function getCollectionItems(db: any, colName: string): any[] {
  const key = getCollectionArrayName(colName);
  if (Array.isArray(db[key])) return db[key];
  if (!db.collections_data) db.collections_data = {};
  if (!Array.isArray(db.collections_data[colName])) db.collections_data[colName] = [];
  return db.collections_data[colName];
}

function setCollectionItems(db: any, colName: string, items: any[]): void {
  const key = getCollectionArrayName(colName);
  if (Array.isArray(db[key]) || key in db) {
    db[key] = items;
  } else {
    if (!db.collections_data) db.collections_data = {};
    db.collections_data[colName] = items;
  }
}

// Local mock query implementation
class MockQuery {
  private colName: string;
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orderField?: string;
  private orderDirection?: "asc" | "desc";
  private limitCount?: number;
  private subPath?: string;

  constructor(colName: string, subPath?: string) {
    this.colName = colName;
    this.subPath = subPath;
  }

  where(field: string, op: string, value: any): MockQuery {
    const q = new MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters, { field, op, value }];
    q.orderField = this.orderField;
    q.orderDirection = this.orderDirection;
    q.limitCount = this.limitCount;
    return q;
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): MockQuery {
    const q = new MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters];
    q.orderField = field;
    q.orderDirection = direction;
    q.limitCount = this.limitCount;
    return q;
  }

  limit(count: number): MockQuery {
    const q = new MockQuery(this.colName, this.subPath);
    q.filters = [...this.filters];
    q.orderField = this.orderField;
    q.orderDirection = this.orderDirection;
    q.limitCount = count;
    return q;
  }

  async get(): Promise<any> {
    const db = readLocalDb();
    let items = getCollectionItems(db, this.colName);

    // If subPath is defined (e.g. users_retained/usr_123/memories)
    if (this.subPath) {
      if (!db.subcollections) db.subcollections = {};
      items = db.subcollections[this.subPath] || [];
    }

    let filtered = items.filter((item: any) => {
      for (const f of this.filters) {
        const itemVal = item[f.field];
        if (f.op === "==" && itemVal !== f.value) {
          // support normalized lowercase emails
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

    const docs = filtered.map((item: any) => ({
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
                (i: any) => (i.id || i.email) !== (item.id || item.email)
              );
              writeLocalDb(freshDb);
            }
          } else {
            const list = getCollectionItems(freshDb, this.colName);
            const nextList = list.filter((i: any) => (i.id || i.email || i.accountId) !== (item.id || item.email || item.accountId));
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
}

// Local mock Document Reference
class MockDocRef {
  private colName: string;
  private docId: string;
  private subPath?: string;

  constructor(colName: string, docId: string, subPath?: string) {
    this.colName = colName;
    this.docId = docId;
    this.subPath = subPath;
  }

  get id(): string {
    return this.docId;
  }

  collection(subCol: string): MockCollectionRef {
    const fullSubPath = this.subPath ? `${this.subPath}/${this.docId}/${subCol}` : `${this.colName}/${this.docId}/${subCol}`;
    return new MockCollectionRef(subCol, fullSubPath);
  }

  async get(): Promise<any> {
    const db = readLocalDb();
    let item: any = null;

    if (this.subPath) {
      if (db.subcollections && db.subcollections[this.subPath]) {
        item = db.subcollections[this.subPath].find((i: any) => (i.id || i.email) === this.docId);
      }
    } else {
      const items = getCollectionItems(db, this.colName);
      item = items.find((i: any) => (i.id || i.email || i.emailNormalized || i.accountId) === this.docId);
      if (!item && this.docId.includes("@")) {
        item = items.find((i: any) => (i.email || "").trim().toLowerCase() === this.docId.trim().toLowerCase());
      }
    }

    return {
      id: this.docId,
      exists: Boolean(item),
      data: () => (item ? { ...item } : undefined),
      ref: {
        id: this.docId,
        delete: () => this.delete(),
        set: (d: any, o?: any) => this.set(d, o),
        update: (d: any) => this.update(d)
      }
    };
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    const db = readLocalDb();
    const docData = { ...data, id: this.docId };

    if (this.subPath) {
      if (!db.subcollections) db.subcollections = {};
      if (!Array.isArray(db.subcollections[this.subPath])) db.subcollections[this.subPath] = [];
      const idx = db.subcollections[this.subPath].findIndex((i: any) => (i.id || i.email) === this.docId);
      if (idx >= 0) {
        db.subcollections[this.subPath][idx] = options?.merge ? { ...db.subcollections[this.subPath][idx], ...docData } : docData;
      } else {
        db.subcollections[this.subPath].push(docData);
      }
      writeLocalDb(db);
      return;
    }

    const items = getCollectionItems(db, this.colName);
    const idx = items.findIndex((i: any) => (i.id || i.email || i.emailNormalized || i.accountId) === this.docId);
    if (idx >= 0) {
      items[idx] = options?.merge ? { ...items[idx], ...docData } : docData;
    } else {
      items.push(docData);
    }
    setCollectionItems(db, this.colName, items);
    writeLocalDb(db);
  }

  async update(data: any): Promise<void> {
    return this.set(data, { merge: true });
  }

  async delete(): Promise<void> {
    const db = readLocalDb();
    if (this.subPath) {
      if (db.subcollections && db.subcollections[this.subPath]) {
        db.subcollections[this.subPath] = db.subcollections[this.subPath].filter(
          (i: any) => (i.id || i.email) !== this.docId
        );
        writeLocalDb(db);
      }
      return;
    }

    const items = getCollectionItems(db, this.colName);
    const nextItems = items.filter((i: any) => (i.id || i.email || i.emailNormalized || i.accountId) !== this.docId);
    setCollectionItems(db, this.colName, nextItems);
    writeLocalDb(db);
  }
}

// Local mock Collection Reference
class MockCollectionRef {
  private colName: string;
  private subPath?: string;

  constructor(colName: string, subPath?: string) {
    this.colName = colName;
    this.subPath = subPath;
  }

  doc(docId: string): MockDocRef {
    return new MockDocRef(this.colName, docId, this.subPath);
  }

  where(field: string, op: string, value: any): MockQuery {
    return new MockQuery(this.colName, this.subPath).where(field, op, value);
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): MockQuery {
    return new MockQuery(this.colName, this.subPath).orderBy(field, direction);
  }

  limit(count: number): MockQuery {
    return new MockQuery(this.colName, this.subPath).limit(count);
  }

  async get(): Promise<any> {
    return new MockQuery(this.colName, this.subPath).get();
  }
}

// Create safe fallback proxy for adminDb
function createSafeAdminDb(realDb: any): any {
  return {
    collection(colName: string): any {
      if (!isFirebaseAdminAvailable || !realDb) {
        return new MockCollectionRef(colName);
      }
      try {
        return realDb.collection(colName);
      } catch (err) {
        return new MockCollectionRef(colName);
      }
    },

    batch(): any {
      if (isFirebaseAdminAvailable && realDb && typeof realDb.batch === "function") {
        try {
          return realDb.batch();
        } catch (e) {
          // fall through
        }
      }
      const ops: Array<() => Promise<any> | any> = [];
      return {
        set(ref: any, data: any, options?: any) {
          ops.push(() => (ref?.set ? ref.set(data, options) : null));
          return this;
        },
        update(ref: any, data: any) {
          ops.push(() => (ref?.update ? ref.update(data) : null));
          return this;
        },
        delete(ref: any) {
          ops.push(() => (ref?.delete ? ref.delete() : null));
          return this;
        },
        async commit() {
          for (const op of ops) {
            try { await op(); } catch (e) {}
          }
          return [];
        }
      };
    }
  };
}

// Safe fallback for adminAuth
function createSafeAdminAuth(realAuth: any): any {
  return {
    async getUser(uid: string): Promise<any> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.getUser(uid);
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
            // let auth/user-not-found pass through
            if (e?.code === "auth/user-not-found") throw e;
          }
        }
      }
      const db = readLocalDb();
      const user = db.users?.find((u: any) => u.id === uid);
      if (user) {
        return {
          uid: user.id,
          email: user.email,
          displayName: user.name || user.ownerName || user.companyName || "Zakir User",
          emailVerified: Boolean(user.isEmailVerified)
        };
      }
      const err: any = new Error(`No user record found for the provided identifier: ${uid}`);
      err.code = "auth/user-not-found";
      throw err;
    },

    async getUserByEmail(email: string): Promise<any> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.getUserByEmail(email);
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
            if (e?.code === "auth/user-not-found") throw e;
          }
        }
      }
      const db = readLocalDb();
      const user = db.users?.find((u: any) => (u.email || "").trim().toLowerCase() === (email || "").trim().toLowerCase());
      if (user) {
        return {
          uid: user.id,
          email: user.email,
          displayName: user.name || user.ownerName || user.companyName || "Zakir User",
          emailVerified: Boolean(user.isEmailVerified)
        };
      }
      const err: any = new Error(`No user record found for the provided email: ${email}`);
      err.code = "auth/user-not-found";
      throw err;
    },

    async createUser(props: any): Promise<any> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.createUser(props);
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      const db = readLocalDb();
      const uid = props.uid || `usr_${Date.now()}`;
      const newUser = {
        id: uid,
        email: props.email,
        name: props.displayName,
        isEmailVerified: props.emailVerified ?? false,
        createdAt: new Date().toISOString()
      };
      if (!db.users) db.users = [];
      const idx = db.users.findIndex((u: any) => (u.email || "").toLowerCase() === (props.email || "").toLowerCase());
      if (idx >= 0) db.users[idx] = { ...db.users[idx], ...newUser };
      else db.users.push(newUser);
      writeLocalDb(db);
      return { uid, email: props.email };
    },

    async updateUser(uid: string, props: any): Promise<any> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.updateUser(uid, props);
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      const db = readLocalDb();
      if (db.users) {
        const idx = db.users.findIndex((u: any) => u.id === uid || (u.email && props.email && u.email.toLowerCase() === props.email.toLowerCase()));
        if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...props };
          writeLocalDb(db);
        }
      }
      return { uid, ...props };
    },

    async deleteUser(uid: string): Promise<void> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          await realAuth.deleteUser(uid);
          return;
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) {
            // quiet
          }
        }
      }
      const db = readLocalDb();
      if (db.users) {
        db.users = db.users.filter((u: any) => u.id !== uid);
        writeLocalDb(db);
      }
    },

    async revokeRefreshTokens(uid: string): Promise<void> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          await realAuth.revokeRefreshTokens(uid);
        } catch (e) {}
      }
    },

    async createCustomToken(uid: string): Promise<string> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.createCustomToken(uid);
        } catch (e: any) {
          if (!e?.message?.includes("PERMISSION_DENIED")) throw e;
        }
      }
      return `custom_token_${uid}_${Date.now()}`;
    },

    async verifyIdToken(token: string): Promise<any> {
      if (isFirebaseAdminAvailable && realAuth) {
        try {
          return await realAuth.verifyIdToken(token);
        } catch (e: any) {
          // fall through to local check
        }
      }
      const db = readLocalDb();
      const user = db.users?.find((u: any) => u.id === token || u.email === token);
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

export const adminDb = createSafeAdminDb(rawFirestore);
export const adminAuth = createSafeAdminAuth(rawAuth);






