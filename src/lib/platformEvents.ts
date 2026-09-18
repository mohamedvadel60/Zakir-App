import { adminDb, isFirebaseAdminAvailable } from "./firebase-admin.js";
import fs from "fs";
import path from "path";

export type EventSeverity = "INFO" | "NOTICE" | "WARNING" | "ERROR" | "CRITICAL";

export type EventCategory =
  | "AUTH"
  | "SECURITY"
  | "SUPPORT"
  | "SYSTEM"
  | "BILLING"
  | "EMAIL"
  | "WORKSPACE"
  | "FILE"
  | "MEMORY"
  | "RECOVERY";

export type PlatformEventType =
  // User & Auth
  | "USER_REGISTERED"
  | "USER_EMAIL_VERIFIED"
  | "USER_LOGIN_SUCCESS"
  | "USER_LOGIN_FAILED"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "USER_SESSIONS_REVOKED"
  | "USER_ROLE_CHANGED"
  | "USER_DELETED"
  | "USER_RESTORED"
  // Account Recovery
  | "RECOVERY_REQUESTED"
  | "RECOVERY_APPROVED"
  | "RECOVERY_REJECTED"
  // Support
  | "SUPPORT_TICKET_CREATED"
  | "SUPPORT_TICKET_STATUS_CHANGED"
  | "SUPPORT_TICKET_REPLIED"
  // Production Errors
  | "PRODUCTION_API_ERROR"
  | "UNHANDLED_EXCEPTION"
  // OTP & Resend
  | "OTP_REQUESTED"
  | "OTP_SENT"
  | "OTP_VERIFICATION_SUCCESS"
  | "OTP_VERIFICATION_FAILED"
  | "OTP_EXPIRED"
  | "OTP_RATE_LIMITED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "EMAIL_BOUNCED"
  | "EMAIL_DELIVERED"
  // Files
  | "FILE_UPLOADED"
  | "FILE_DELETED"
  | "FILE_UPDATED"
  | "FILE_PROCESSING_FAILED"
  | "FILE_DOWNLOADED"
  // Memories
  | "MEMORY_CREATED"
  | "MEMORY_UPDATED"
  | "MEMORY_DELETED"
  | "MEMORY_PROCESSING_FAILED"
  // Workspace
  | "WORKSPACE_CREATED"
  | "WORKSPACE_UPDATED"
  | "WORKSPACE_MEMBER_ADDED"
  | "WORKSPACE_MEMBER_REMOVED"
  | "INVITATION_CREATED"
  | "INVITATION_ACCEPTED"
  | "INVITATION_REVOKED"
  // Security
  | "INVALID_ADMIN_ATTEMPT"
  | "IDOR_ATTEMPT"
  | "ROLE_ESCALATION_ATTEMPT"
  | "RECOVERY_ABUSE"
  | "OTP_ABUSE"
  | "SECURITY_ALERT"
  | "SESSION_SECURITY_EVENT"
  // Support Session
  | "SUPPORT_SESSION_STARTED"
  | "SUPPORT_SESSION_ENDED"
  // Billing
  | "STRIPE_PAYMENT_SUCCESS"
  | "STRIPE_PAYMENT_FAILED"
  | "STRIPE_SUBSCRIPTION_UPDATED"
  | "STRIPE_SUBSCRIPTION_CANCELLED"
  // Admin Action
  | "ADMIN_AUDIT_ACTION";

export interface PlatformEvent {
  id: string;
  eventType: PlatformEventType | string;
  severity: EventSeverity;
  category: EventCategory;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  workspaceId?: string;
  resourceId?: string;
  requestId?: string; // correlationId
  endpoint?: string;
  method?: string;
  statusCode?: number;
  sanitizedMessage: string;
  status: string;
  metadata: Record<string, any>;
  source: string;
  incidentId?: string;
}

export interface PlatformIncident {
  id: string;
  incidentNumber: string;
  title: string;
  severity: EventSeverity;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "ACKNOWLEDGED";
  category: EventCategory;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  assignedTo?: string;
  correlationId?: string;
  relatedEventIds: string[];
  affectedUser?: string;
  affectedWorkspace?: string;
  diagnosticDetails?: Record<string, any>;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  severity: EventSeverity;
  category: EventCategory;
  eventId: string;
  incidentId?: string;
  read: boolean;
  acknowledged: boolean;
  timestamp: string;
  targetUser?: string;
  targetWorkspace?: string;
  link?: {
    tab: string;
    targetId?: string;
    filter?: string;
  };
}

const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

function getLocalStore(): any {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {}
  return {};
}

function saveLocalStore(data: any): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to persist to db_store.json:", e);
  }
}

/**
 * Strict data sanitizer to ensure secrets, passwords, tokens, API keys,
 * private keys, plaintext OTPs, credit cards and authorization headers
 * are NEVER persisted in event logs or notifications.
 */
export function sanitizeEventPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeEventPayload(item));
  }

  const forbiddenKeyRegex = /(password|passcode|token|secret|key|otp|auth|credential|authorization|cookie|session|card|cvv|pin)/i;
  const sanitized: Record<string, any> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (forbiddenKeyRegex.test(k)) {
      if (k.toLowerCase().includes("id") || k.toLowerCase().includes("type") || k.toLowerCase().includes("status")) {
        sanitized[k] = sanitizeEventPayload(v);
      } else {
        sanitized[k] = "[REDACTED_SECURE]";
      }
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeEventPayload(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

let incidentCounter = 1000;

/**
 * Centralized Platform Event Emitter.
 * Persists to Firestore `platform_events`, updates in-memory/JSON DB,
 * automatically generates Admin Notifications and Incidents as required.
 */
export async function emitPlatformEvent(
  rawEvent: Partial<PlatformEvent> & {
    eventType: PlatformEventType | string;
    category: EventCategory;
    sanitizedMessage: string;
  }
): Promise<PlatformEvent> {
  const nowIso = new Date().toISOString();
  const eventId = rawEvent.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const severity: EventSeverity = rawEvent.severity || "INFO";
  const sanitizedMetadata = sanitizeEventPayload(rawEvent.metadata || {});

  const event: PlatformEvent = {
    id: eventId,
    eventType: rawEvent.eventType,
    severity,
    category: rawEvent.category,
    timestamp: rawEvent.timestamp || nowIso,
    userId: rawEvent.userId,
    userEmail: rawEvent.userEmail,
    workspaceId: rawEvent.workspaceId,
    resourceId: rawEvent.resourceId,
    requestId: rawEvent.requestId,
    endpoint: rawEvent.endpoint,
    method: rawEvent.method,
    statusCode: rawEvent.statusCode,
    sanitizedMessage: rawEvent.sanitizedMessage,
    status: rawEvent.status || "ACTIVE",
    metadata: sanitizedMetadata,
    source: rawEvent.source || "server",
    incidentId: rawEvent.incidentId,
  };

  // 1. Check if an Incident should be automatically spawned
  const requiresIncident =
    severity === "ERROR" ||
    severity === "CRITICAL" ||
    rawEvent.eventType === "PRODUCTION_API_ERROR" ||
    rawEvent.eventType === "INVALID_ADMIN_ATTEMPT" ||
    rawEvent.eventType === "IDOR_ATTEMPT" ||
    rawEvent.eventType === "SECURITY_ALERT";

  let createdIncident: PlatformIncident | null = null;

  if (requiresIncident && !event.incidentId) {
    incidentCounter += 1;
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const incidentNumber = `INC-${incidentCounter}`;
    
    createdIncident = {
      id: incidentId,
      incidentNumber,
      title: `${rawEvent.eventType}: ${rawEvent.sanitizedMessage.slice(0, 100)}`,
      severity,
      status: "OPEN",
      category: rawEvent.category,
      createdAt: nowIso,
      updatedAt: nowIso,
      correlationId: rawEvent.requestId,
      relatedEventIds: [eventId],
      affectedUser: rawEvent.userEmail || rawEvent.userId,
      affectedWorkspace: rawEvent.workspaceId,
      diagnosticDetails: {
        endpoint: rawEvent.endpoint,
        method: rawEvent.method,
        statusCode: rawEvent.statusCode,
        metadata: sanitizedMetadata,
      },
    };

    event.incidentId = incidentId;
  }

  // 2. Check if an Admin Notification should be created
  const requiresNotification =
    severity === "WARNING" ||
    severity === "ERROR" ||
    severity === "CRITICAL" ||
    rawEvent.category === "SUPPORT" ||
    rawEvent.category === "SECURITY" ||
    rawEvent.category === "RECOVERY" ||
    rawEvent.eventType === "SUPPORT_TICKET_CREATED" ||
    rawEvent.eventType === "RECOVERY_REQUESTED" ||
    rawEvent.eventType === "INVALID_ADMIN_ATTEMPT";

  let createdNotification: AdminNotification | null = null;

  if (requiresNotification) {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let linkTab = "overview";
    if (rawEvent.category === "SUPPORT") linkTab = "support";
    else if (rawEvent.category === "RECOVERY") linkTab = "reactivations";
    else if (rawEvent.category === "SECURITY") linkTab = "security";
    else if (rawEvent.category === "BILLING") linkTab = "billing";
    else if (rawEvent.category === "AUTH" || rawEvent.category === "EMAIL") linkTab = "emails";

    createdNotification = {
      id: notificationId,
      title: `${rawEvent.eventType.replace(/_/g, " ")}`,
      message: rawEvent.sanitizedMessage,
      severity,
      category: rawEvent.category,
      eventId,
      incidentId: event.incidentId,
      read: false,
      acknowledged: false,
      timestamp: nowIso,
      targetUser: rawEvent.userEmail || rawEvent.userId,
      targetWorkspace: rawEvent.workspaceId,
      link: {
        tab: linkTab,
        targetId: rawEvent.resourceId,
      },
    };
  }

  // 3. Persist to Firestore
  try {
    await adminDb.collection("platform_events").doc(eventId).set(event);
    if (createdIncident) {
      await adminDb.collection("platform_incidents").doc(createdIncident.id).set(createdIncident);
    }
    if (createdNotification) {
      await adminDb.collection("admin_notifications").doc(createdNotification.id).set(createdNotification);
    }
  } catch (fsErr: any) {
    console.warn("Firestore event persistence warning (fallback used):", fsErr.message);
  }

  // 4. Persist to Local Store for resiliency
  try {
    const store = getLocalStore();
    if (!Array.isArray(store.platform_events)) store.platform_events = [];
    if (!Array.isArray(store.platform_incidents)) store.platform_incidents = [];
    if (!Array.isArray(store.admin_notifications)) store.admin_notifications = [];

    store.platform_events.unshift(event);
    if (store.platform_events.length > 500) {
      store.platform_events = store.platform_events.slice(0, 500);
    }

    if (createdIncident) {
      store.platform_incidents.unshift(createdIncident);
      if (store.platform_incidents.length > 200) {
        store.platform_incidents = store.platform_incidents.slice(0, 200);
      }
    }

    if (createdNotification) {
      store.admin_notifications.unshift(createdNotification);
      if (store.admin_notifications.length > 200) {
        store.admin_notifications = store.admin_notifications.slice(0, 200);
      }
    }

    saveLocalStore(store);
  } catch (locErr: any) {
    console.warn("Local event store persistence error:", locErr.message);
  }

  console.log(`[PLATFORM EVENT] [${severity}] ${event.eventType} - ${event.sanitizedMessage}`);
  return event;
}

/**
 * Fetch platform events from Firestore with fallback to local store.
 */
export async function getPlatformEvents(options?: {
  category?: string;
  severity?: string;
  limit?: number;
}): Promise<PlatformEvent[]> {
  const maxLimit = options?.limit || 100;
  try {
    let q: any = adminDb.collection("platform_events").orderBy("timestamp", "desc").limit(maxLimit);
    if (options?.category && options.category !== "all") {
      q = q.where("category", "==", options.category);
    }
    if (options?.severity && options.severity !== "all") {
      q = q.where("severity", "==", options.severity);
    }
    const snap = await q.get();
    if (snap && !snap.empty) {
      return snap.docs.map((d: any) => d.data() as PlatformEvent);
    }
  } catch (e: any) {
    console.warn("Firestore getPlatformEvents failed, reading local store:", e.message);
  }

  const store = getLocalStore();
  let list: PlatformEvent[] = store.platform_events || [];
  if (options?.category && options.category !== "all") {
    list = list.filter((e) => e.category === options.category);
  }
  if (options?.severity && options.severity !== "all") {
    list = list.filter((e) => e.severity === options.severity);
  }
  return list.slice(0, maxLimit);
}

/**
 * Fetch platform incidents.
 */
export async function getPlatformIncidents(options?: {
  status?: string;
  limit?: number;
}): Promise<PlatformIncident[]> {
  const maxLimit = options?.limit || 100;
  try {
    let q: any = adminDb.collection("platform_incidents").orderBy("createdAt", "desc").limit(maxLimit);
    if (options?.status && options.status !== "all") {
      q = q.where("status", "==", options.status);
    }
    const snap = await q.get();
    if (snap && !snap.empty) {
      return snap.docs.map((d: any) => d.data() as PlatformIncident);
    }
  } catch (e: any) {
    console.warn("Firestore getPlatformIncidents failed, reading local store:", e.message);
  }

  const store = getLocalStore();
  let list: PlatformIncident[] = store.platform_incidents || [];
  if (options?.status && options.status !== "all") {
    list = list.filter((inc) => inc.status === options.status);
  }
  return list.slice(0, maxLimit);
}

/**
 * Update incident status.
 */
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: "OPEN" | "INVESTIGATING" | "RESOLVED" | "ACKNOWLEDGED",
  notes?: string,
  resolvedBy?: string
): Promise<PlatformIncident | null> {
  const nowIso = new Date().toISOString();
  const updateData: any = {
    status: newStatus,
    updatedAt: nowIso,
  };
  if (newStatus === "RESOLVED") {
    updateData.resolvedAt = nowIso;
    updateData.resolvedBy = resolvedBy || "Admin";
    if (notes) updateData.resolutionNotes = notes;
  }

  try {
    await adminDb.collection("platform_incidents").doc(incidentId).update(updateData);
  } catch (e) {}

  const store = getLocalStore();
  if (Array.isArray(store.platform_incidents)) {
    const idx = store.platform_incidents.findIndex((i: any) => i.id === incidentId);
    if (idx >= 0) {
      store.platform_incidents[idx] = { ...store.platform_incidents[idx], ...updateData };
      saveLocalStore(store);
      return store.platform_incidents[idx];
    }
  }
  return null;
}

/**
 * Fetch admin notifications.
 */
export async function getAdminNotifications(options?: {
  onlyUnread?: boolean;
  limit?: number;
}): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  const maxLimit = options?.limit || 50;
  let notifications: AdminNotification[] = [];

  try {
    let q = adminDb.collection("admin_notifications").orderBy("timestamp", "desc").limit(maxLimit);
    const snap = await q.get();
    if (snap && !snap.empty) {
      notifications = snap.docs.map((d: any) => d.data() as AdminNotification);
    }
  } catch (e: any) {
    console.warn("Firestore getAdminNotifications failed, reading local store:", e.message);
  }

  if (notifications.length === 0) {
    const store = getLocalStore();
    notifications = store.admin_notifications || [];
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  if (options?.onlyUnread) {
    notifications = notifications.filter((n) => !n.read);
  }

  return { notifications: notifications.slice(0, maxLimit), unreadCount };
}

/**
 * Mark notification as read.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await adminDb.collection("admin_notifications").doc(id).update({ read: true });
  } catch (e) {}

  const store = getLocalStore();
  if (Array.isArray(store.admin_notifications)) {
    const idx = store.admin_notifications.findIndex((n: any) => n.id === id);
    if (idx >= 0) {
      store.admin_notifications[idx].read = true;
      saveLocalStore(store);
      return true;
    }
  }
  return false;
}

/**
 * Acknowledge notification.
 */
export async function acknowledgeNotification(id: string): Promise<boolean> {
  try {
    await adminDb.collection("admin_notifications").doc(id).update({ acknowledged: true, read: true });
  } catch (e) {}

  const store = getLocalStore();
  if (Array.isArray(store.admin_notifications)) {
    const idx = store.admin_notifications.findIndex((n: any) => n.id === id);
    if (idx >= 0) {
      store.admin_notifications[idx].acknowledged = true;
      store.admin_notifications[idx].read = true;
      saveLocalStore(store);
      return true;
    }
  }
  return false;
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<number> {
  const store = getLocalStore();
  let count = 0;
  if (Array.isArray(store.admin_notifications)) {
    for (const n of store.admin_notifications) {
      if (!n.read) {
        n.read = true;
        count++;
        try {
          adminDb.collection("admin_notifications").doc(n.id).update({ read: true }).catch(() => {});
        } catch (e) {}
      }
    }
    saveLocalStore(store);
  }
  return count;
}
