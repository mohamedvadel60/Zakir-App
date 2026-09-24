import { AdminUserRecord } from "../../lib/firebaseServices.js";
import { UserFile, SupportTicket } from "../../types.js";

export type AdminTab = 
  | "overview" 
  | "users" 
  | "verifications" 
  | "recovery" 
  | "support" 
  | "subscriptions";

export interface PendingApprovalRecord {
  id: string;
  userId: string;
  email: string;
  name?: string;
  companyName?: string;
  role?: string;
  accountStatus: string;
  documentVerificationStatus?: string;
  requiresDocumentVerification?: boolean;
  documents?: any[];
  verificationInfo?: any;
  createdAt?: string;
  trialEndsAt?: string;
  subscriptionPlan?: string;
}

export interface RecoveryRequestRecord {
  id: string;
  requestId?: string;
  userId?: string;
  email: string;
  name?: string;
  status: "pending" | "approved" | "rejected" | "completed";
  reason?: string;
  createdAt: string;
  requestedAt?: string;
  verifiedAt?: string;
  identityDocument?: any;
  documentId?: string;
  documentName?: string;
  adminNotes?: string;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activePaid: number;
  trials: number;
  plans: {
    Enterprise: number;
    Professional: number;
    Starter: number;
    Free: number;
  };
}

export interface SubscriptionCorrectionRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  currentPlan: string;
  requestedPlan: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  createdAt: string;
}
