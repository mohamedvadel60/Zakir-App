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
  uid?: string;
  name: string;
  email: string;
  role: string;
  powers: ModulePermissions;
  addedAt: string;
  status?: string;
  joinedAt?: string;
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

export type SubscriptionStatus = "Free Tier" | "Inactive" | "Active" | "Paused" | "Premium" | "Pending Selection" | "Trial" | "Expired" | "Canceled";

export type AccountStatus = 
  | "PENDING_EMAIL_VERIFICATION" 
  | "PENDING_DOCUMENT_VERIFICATION"
  | "PENDING_INSTITUTIONAL_DATA" 
  | "PENDING_ADMIN_REVIEW" 
  | "VERIFICATION_REQUIRED"
  | "APPROVED" 
  | "ACTIVE" 
  | "REJECTED" 
  | "SUSPENDED";

export interface UploadedVerificationDoc {
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: "personal" | "company" | "other";
  docType?: "national_id" | "passport" | "driving_license" | "commercial_register" | "tax_card" | "other";
  uploadedAt: string;
  storageReference?: string;
  fileHash?: string;
}

export interface InstitutionalProfile {
  fullName: string;
  phone: string;
  jobTitle: string;
  companyName: string;
  sector: string;
  country: string;
  companySize: string;
  intendedUse: string;
  submittedAt: string;
  additionalNotes?: string;
}

export interface AdminEntitlementAuditLog {
  id: string;
  timestamp: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  action: "APPROVE_ACCOUNT" | "REJECT_ACCOUNT" | "EXTEND_TRIAL" | "CHANGE_PLAN" | "OVERRIDE_ENTITLEMENT" | "SYNC_SUBSCRIPTION";
  details: string;
  previousState?: any;
  newState?: any;
}

export type VerificationStatus = "unverified" | "under_review" | "pending" | "verified" | "rejected" | "action_required";

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
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  adminNote?: string;
  notes?: string;
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
  verifiedAt?: string | null;
  adminVerificationOverride?: boolean;
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
  accountStatus?: AccountStatus;
  kycStatus?: "VERIFIED" | "NOT_VERIFIED" | "UNDER_REVIEW" | "PENDING_REVIEW" | "REJECTED" | "UNVERIFIED";
  requiresDocumentVerification?: boolean;
  verificationFlowVersion?: number;
  documentVerificationStatus?: "NOT_SUBMITTED" | "PENDING_EMAIL_VERIFICATION" | "PENDING_UPLOAD" | "PENDING_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "UNVERIFIED";
  verificationDocuments?: UploadedVerificationDoc[];
  hasCompany?: boolean;
  institutionalProfile?: InstitutionalProfile;
  approvedAt?: string;
  approvedBy?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialDurationHours?: number;
  rejectionReason?: string;
  rejectionDate?: string;
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
  analysisId?: string;
  createdAt?: string;
  userId?: string;
  workspaceId?: string;
  error?: string;
  executiveSummary?: string;
  analyzedMemories: number;
  identifiedRisks: number;
  analyzedFilesCount?: number;
  opportunities: number;
  recommendations: number;
  keyInsights?: string[];
  detectedPatterns?: string[];
  risksList: Array<{
    title: string;
    severity: string;
    probability: string;
    details: string;
    evidence?: string;
    confidence?: string;
    uncertainty?: string;
  }>;
  forecastsList: Array<{
    title: string;
    timeframe: string;
    impact: string;
    details: string;
    evidence?: string;
  }>;
  opportunitiesList: Array<{
    title: string;
    feasibility: string;
    benefit: string;
    details: string;
    evidence?: string;
  }>;
  recommendationsList: Array<{
    title: string;
    priority: string;
    actionable: string;
    details: string;
    evidence?: string;
    confidence?: string;
  }>;
  strategicOptions?: Array<{
    title: string;
    timeframe: string;
    impact: string;
    details: string;
    evidence?: string;
    uncertainty?: string;
  }>;
  operationalActions?: Array<{
    title: string;
    priority: string;
    assignedRole?: string;
    timeframe: string;
    details: string;
  }>;
  priorities?: Array<{
    rank: number;
    title: string;
    rationale: string;
    expectedImpact: string;
  }>;
  expectedImpact?: string;
  supportingEvidence?: Array<{
    source: string;
    type: "memory" | "risk" | "file" | "org" | "external";
    snippet: string;
  }>;
  confidenceLevel?: "High" | "Medium" | "Low" | string;
  uncertaintyNotes?: string;
  administrativeAdvisorReview?: {
    governanceNotes: string;
    contradictionsDetected: string[];
    recommendedPolicyControls: string[];
    uncertaintyPoints: string[];
  };
  externalSearchUsed?: boolean;
  externalSearchStatus?: string;
  externalSources?: Array<{
    title: string;
    url: string;
    snippet?: string;
    accessedAt?: string;
  }>;
  fileExtractionStatus?: Array<{
    fileName: string;
    status: "read" | "unavailable" | "empty";
    summary?: string;
  }>;
}

export type MarketQueryIntent =
  | "INTERNAL"
  | "EXTERNAL"
  | "MIXED"
  | "EXPLORATORY"
  | "COMPARATIVE"
  | "OPPORTUNITY"
  | "RISK"
  | "STRATEGY";

export interface MarketEvidenceItem {
  sourceType: "internal_memory" | "internal_risk" | "internal_file" | "external_search" | "official_indicator";
  title: string;
  detail: string;
  url?: string;
  confidence?: "High" | "Medium" | "Low";
}

export interface MarketCompetitorProfile {
  name: string;
  positioning?: string;
  marketPresence?: string;
  strengths?: string[];
  weaknesses?: string[];
  pricingSignal?: string;
  sourceType: "internal_data" | "external_source" | "unverified";
}

export interface CountryComparisonDimension {
  country: string;
  marketSizeGrowth?: string;
  competitionLevel?: string;
  regulatoryEase?: string;
  logisticsInfrastructure?: string;
  keyRisks?: string[];
  keyOpportunities?: string[];
  attractivenessScore?: number; // 1 to 10
}

export interface MarketStrategicAction {
  title: string;
  description: string;
  priority: "Critical" | "High" | "Medium";
  expectedImpact: "High" | "Moderate" | "Transformative";
  timeframe?: string;
  governanceLink?: string;
}

export interface MarketDiagnosableItem {
  id: string;
  title: string;
  category?: string;
  type?: "market_axis" | "scenario" | "risk_chart" | "competitive_gap" | "opportunity_corridor";
  summary: string;
  severityOrImpact?: "Critical" | "High" | "Moderate" | "Strategic";
  keyMetrics?: Array<{ label: string; value: string }>;
  diagnosisResult?: {
    diagnosedAt: string;
    itemTitle?: string;
    detailedAnalysis: string;
    causalFactors?: string[];
    strategicImplications?: string[];
    actionableMitigations?: string[];
    confidenceScore?: number;
  };
}

export interface MarketIntelligenceData {
  analysisId?: string;
  workspaceId?: string;
  userId?: string;
  createdAt?: string;
  error?: string;
  topic: string;
  industry: string;
  context?: string;
  countries?: string[];
  classification?: {
    intent: MarketQueryIntent;
    scope: string;
    needsExternalSearch: boolean;
    reasoning?: string;
  };
  summary: string;
  marketOverview?: string;
  marketDynamics?: string[];
  trends: string[];
  demandAnalysis?: string;
  customerSegments?: string[];
  competitors?: MarketCompetitorProfile[];
  competitiveGaps?: string[];
  risks: string[];
  threats?: string[];
  opportunities: string[];
  entryBarriers?: string[];
  regulatoryEnvironment?: string[];
  macroeconomicFactors?: string[];
  pricingIntelligence?: string[];
  tradeAndSupplyChain?: string[];
  marketAttractiveness?: {
    score: number; // 1 to 10
    rating: "High" | "Moderate" | "Low" | "Challenging";
    justification: string;
  };
  countryComparisons?: CountryComparisonDimension[];
  strategicOptions?: string[];
  recommendations: string[];
  recommendedActions?: MarketStrategicAction[];
  diagnosableItems?: MarketDiagnosableItem[];
  internalEvidence?: MarketEvidenceItem[];
  externalEvidence?: MarketEvidenceItem[];
  externalSources?: Array<{ title: string; url: string; snippet?: string }>;
  externalSearchStatus?: "COMPLETED" | "NOT_NEEDED" | "BLOCKED_BY_QUOTA" | "UNAVAILABLE";
  externalSearchNotice?: string;
  confidenceScore?: number; // 0 to 100
  uncertaintyNotes?: string[];
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
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  searchDecision?: {
    type: "INTERNAL_ONLY" | "EXTERNAL_ONLY" | "MIXED";
    needsSearch: boolean;
    reason: string;
  };
  advisorType?: "cognitive" | "administrative" | "unified";
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

export type RecoveryRequestStatus = "pending" | "under_review" | "approved" | "rejected" | "restored";

export interface RecoveryDocument {
  id: string;
  name: string;
  type: "passport" | "national_id" | "drivers_license" | "other" | string;
  mimeType: string;
  uploadedAt: string;
  dataUrl?: string; // Encrypted or base64 preview, securely restricted to authorized admin view
}

export interface AccountRecoveryRequest {
  requestId: string;
  userId?: string;
  email: string;
  fullName: string;
  phone: string;
  phoneVerified?: boolean;
  organization?: string;
  previousWorkspaceInfo?: string;
  reason: string;
  termsAccepted: boolean;
  termsAcceptedAt: string;
  identityVerificationStatus: "submitted" | "verified" | "rejected";
  documents: RecoveryDocument[];
  status: RecoveryRequestStatus;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  notes?: string;
  role?: string;
  workspaceId?: string;
  workspaceName?: string;
}


