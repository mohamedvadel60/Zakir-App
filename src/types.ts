export type UserRole = "CEO" | "Admin" | "Compliance Officer" | "Analyst" | "Risk Auditor" | "Contributor" | "View Only";

export interface ModulePermissions {
  fileVault: boolean;
  memoryVault: boolean;
  riskRadar: boolean;
  marketIntel: boolean;
  settings: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  powers: ModulePermissions;
  addedAt: string;
}

export interface EncryptedModuleSettings {
  secretPasscode?: string;
  isPinSet?: boolean;
  lockedModules: {
    fileVault: boolean;
    memoryVault: boolean;
    riskRadar: boolean;
    settings: boolean;
  };
}

export interface UserPreferences {
  theme: "dark" | "light";
  language: "ar" | "en" | "fr";
  emailNotifications: boolean;
  riskRadarAlerts: boolean;
  autoSaveMemories: boolean;
  defaultView: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberCount: number;
}

export type SubscriptionStatus = "Free Tier" | "Inactive" | "Active" | "Paused" | "Premium" | "Pending Selection";

export type VerificationStatus = "unverified" | "under_review" | "verified" | "action_required";

export interface VerificationCode {
  id: string;
  userId?: string;
  email: string;
  phone?: string;
  codeHash: string;
  rawCodeForDemo?: string;
  type: "account_registration" | "password_reset" | "email_change" | "phone_change";
  expiresAt: string;
  attempts: number;
  used: boolean;
  createdAt: string;
}

export type SupportCategory = 
  | "Technical Issue" 
  | "Account & Login" 
  | "Email / OTP" 
  | "Billing" 
  | "Feature Request" 
  | "Bug Report"
  | "Technical Problem"
  | "Account Problem"
  | "Verification Issue"
  | "Password Recovery"
  | "Billing Issue"
  | "Suggestion"
  | "Other";

export type SupportStatus = "Open" | "In Progress" | "Waiting for User" | "Resolved" | "Closed";
export type SupportPriority = "Low" | "Normal" | "Medium" | "High" | "Urgent";

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId?: string;
  senderType: "user" | "admin";
  senderName: string;
  senderEmail: string;
  message: string;
  createdAt: string;
  attachments?: string[];
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  companyName?: string;
  userCreatedAt?: string;
  category: SupportCategory;
  subject: string;
  description?: string;
  message: string;
  status: SupportStatus;
  priority: SupportPriority;
  createdAt: string;
  updatedAt: string;
  lastReplyAt?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  adminNotes?: string;
  attachments?: string[];
  messages?: SupportMessage[];
}

export interface AccountVerificationDoc {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadDate: string;
  docType?: string;
  category?: string;
  description?: string;
}

export interface VerificationInfo {
  status: VerificationStatus;
  requestedAt?: string;
  verifiedAt?: string;
  adminNote?: string;
  documents?: AccountVerificationDoc[];
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  issuingEntity?: string;
  organizationName?: string;
  signatureUrl?: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  email_verified?: boolean;
  emailVerified?: boolean;
  verification_status?: string;
  verified_at?: string;
  verification_required?: boolean;
  companyName: string;
  companyLogoUrl?: string;
  ownerName?: string;
  avatarUrl?: string;
  subscriptionPlan?: "Starter" | "Professional" | "Enterprise";
  subscriptionStatus?: SubscriptionStatus;
  billingCycle?: "monthly" | "annual";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: string;
  nextBillingDate?: string;
  receiptUrl?: string;
  verificationInfo?: VerificationInfo;
  workspaceId?: string;
  workspace?: WorkspaceInfo;
  hasPasswordSet?: boolean;
  userPreferences?: UserPreferences;
  customTheme?: {
    primaryBg?: string;
    textColor?: string;
    secondaryColor?: string;
    approvedAt?: string;
  };
  role: UserRole;
  powers?: ModulePermissions;
  createdAt: string;
  trialExpiresAt: string;
  teamMembersList?: TeamMember[];
  encryptedSecurity?: EncryptedModuleSettings;
  lastActiveAt?: string;
  lastLoginAt?: string;
  activityCount?: number;
  activityLogs?: { id: string; action: string; timestamp: string; details?: string }[];
}

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface Memory {
  id: string;
  title: string;
  category: string;
  riskLevel: RiskLevel;
  tags: string[];
  description: string;
  decision: string;
  causalFactors: string;
  outcomes: string;
  lessonsLearned: string;
  createdAt: string;
  userId: string;
  authorEmail: string;
  authorRole: UserRole;
  authorName?: string;
  isEncrypted?: boolean;
}

export interface RiskAlert {
  id: string;
  title: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string;
  status: "Active" | "Resolved";
  createdAt: string;
}

export interface PerformanceMetric {
  id: string;
  userId: string;
  actionType: string;
  metricValue: number;
  description: string;
  createdAt: string;
}

export interface SubscriptionInfo {
  plan: "Starter" | "Professional" | "Enterprise";
  status: "Active" | "Expired" | "Trial";
  trialTimeLeftMs: number;
  billingMethod: string;
  verified: boolean;
}

export interface SmartEvolutionData {
  error?: string;
  analyzedMemories: number;
  identifiedRisks: number;
  opportunities: number;
  recommendations: number;
  risksList: Array<{ title: string; severity: string; probability: string; details: string }>;
  forecastsList: Array<{ title: string; timeframe: string; impact: string; details: string }>;
  opportunitiesList: Array<{ title: string; feasibility: string; benefit: string; details: string }>;
  recommendationsList: Array<{ title: string; priority: string; actionable: string; details: string }>;
}

export interface MarketIntelligenceData {
  error?: string;
  topic: string;
  industry: string;
  context?: string;
  summary: string;
  trends: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
}

export interface SQLQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  createdAt: string;
}

export interface UserFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  userId: string;
  category: string;
  description: string;
  storagePath?: string;
  isEncrypted?: boolean;
}


