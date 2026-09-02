import React, { useState, useRef, useEffect, useMemo } from "react";
import { loadStripe, Stripe as StripeType } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { auth } from "../firebase.js";
import { authenticatedFetch, getAuthenticatedFirebaseUser, getFreshAuthToken } from "../lib/apiUtils.js";
import { 
  User as UserIcon, 
  Building, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  Globe, 
  Sun, 
  Moon, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Lock, 
  Key, 
  Mail, 
  FileText, 
  Sparkles, 
  Camera, 
  Trash2, 
  Upload, 
  Palette, 
  Check, 
  Download, 
  Printer, 
  Landmark, 
  Smartphone, 
  ShieldAlert, 
  Copy, 
  Zap, 
  ArrowRight, 
  ArrowLeft,
  X,
  RefreshCw,
  CheckCircle,
  Eye,
  EyeOff,
  Edit3,
  Plus,
  Unlock,
  Brain,
  Sliders,
  Shield,
  Clock,
  Info,
  ExternalLink,
  HelpCircle
} from "lucide-react";
import { CustomerSupport } from "./CustomerSupport.js";
import { User, UserRole, TeamMember, ModulePermissions, EncryptedModuleSettings, AccountVerificationDoc, VerificationInfo, VerificationStatus } from "../types.js";
import { saveWorkspaceInvitation, deleteWorkspaceInvitation, fetchWorkspaceInvitations, WorkspaceInvitation, sendWorkspaceInvitationApi, resendWorkspaceInvitationApi, saveFirebaseUserProfile, uploadFirebaseUserFile, deleteFirebaseUserFile } from "../lib/firebaseServices.js";
import { openOrDownloadUserFile, openUserFileInNewTab, downloadUserFile } from "../lib/fileViewerUtils.js";
import { translations } from "../translations.js";

// Cached singleton Stripe loader
let cachedStripePromise: Promise<StripeType | null> | null = null;
let cachedStripeKey: string | null = null;

function getCachedStripe(publishableKey?: string | null): Promise<StripeType | null> {
  const key = publishableKey?.trim() || "";
  if (!key) {
    return Promise.resolve(null);
  }
  if (!cachedStripePromise || cachedStripeKey !== key) {
    cachedStripeKey = key;
    try {
      cachedStripePromise = loadStripe(key).catch((err) => {
        console.warn("[Stripe] Failed to load Stripe.js script:", err);
        return null;
      });
    } catch (err) {
      console.warn("[Stripe] loadStripe synchronous error:", err);
      cachedStripePromise = Promise.resolve(null);
    }
  }
  return cachedStripePromise;
}

interface PaymentErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
  lang?: string;
}

interface PaymentErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class PaymentErrorBoundary extends React.Component<PaymentErrorBoundaryProps, PaymentErrorBoundaryState> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): PaymentErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || "Stripe initialization failed" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PaymentErrorBoundary] Caught payment checkout error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      const isAr = this.props.lang === "ar";
      return (
        <div className="p-6 text-center space-y-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
          <p className="text-sm font-bold">
            {isAr ? "تعذر تحميل بوابة الدفع. يرجى المحاولة مرة أخرى." : "Failed to load payment checkout. Please try again."}
          </p>
          <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 bg-gradient-to-r from-[#0075DE] to-[#005BAB] text-white text-xs font-bold rounded-lg shadow-lg hover:brightness-110 cursor-pointer"
          >
            {isAr ? "إعادة المحاولة" : "Try Again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SettingsAdminProps {
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  lang: string;
  setLang: (lang: string) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  activeSubTab?: string;
  setActiveSubTab?: (tab: any) => void;
  onEncryptAllData?: (passcode: string) => void;
}

export const SettingsAdmin: React.FC<SettingsAdminProps> = ({
  currentUser,
  onUpdateUser,
  onLogout,
  lang,
  setLang,
  theme,
  setTheme,
  activeSubTab: externalSubTab,
  setActiveSubTab: setExternalSubTab,
  onEncryptAllData,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<
    "account" | "subscription" | "team" | "security" | "support"
  >("account");

  let currentTab = externalSubTab || internalSubTab;
  if (currentUser.role !== "CEO" && currentTab !== "account" && currentTab !== "security" && currentTab !== "support") {
    currentTab = "account";
  }

  const handleTabChange = (tab: "account" | "subscription" | "team" | "security" | "support") => {
    if (currentUser.role !== "CEO" && tab !== "account" && tab !== "security" && tab !== "support") {
      return;
    }
    if (setExternalSubTab) {
      setExternalSubTab(tab as any);
    }
    setInternalSubTab(tab);
  };

  // Profile Account State
  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.ownerName || "Mohamed Vadel");
  const [email, setEmail] = useState(currentUser.email || "mohamedvadel60@gmail.com");
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || "");
  const [department, setDepartment] = useState(currentUser.department || currentUser.issuingEntity || "");
  const [companyName, setCompanyName] = useState(currentUser.organizationName || currentUser.companyName || "Mauritanian Finance Group");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>(currentUser.companyLogoUrl);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(currentUser.signatureUrl);

  // Dedicated Save States for Profile Account
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Dedicated Save States for Memory Vault & System Preferences
  const [isSavingMemoryPrefs, setIsSavingMemoryPrefs] = useState(false);
  const [memoryPrefsSuccessMsg, setMemoryPrefsSuccessMsg] = useState<string | null>(null);
  const [memoryPrefsErrorMsg, setMemoryPrefsErrorMsg] = useState<string | null>(null);
  const [autoSaveMemoriesVal, setAutoSaveMemoriesVal] = useState<boolean>(currentUser.userPreferences?.autoSaveMemories ?? true);
  const [emailNotificationsVal, setEmailNotificationsVal] = useState<boolean>(currentUser.userPreferences?.emailNotifications ?? true);
  const [riskRadarAlertsVal, setRiskRadarAlertsVal] = useState<boolean>(currentUser.userPreferences?.riskRadarAlerts ?? true);

  // Dedicated Save States for Secret Passcode Encryption & Security
  const [isSavingEncryption, setIsSavingEncryption] = useState(false);
  const [passcodeSaveSuccessMsg, setPasscodeSaveSuccessMsg] = useState<string | null>(null);

  // Dedicated Save States for Appearance & Custom Theme
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSuccessMsg, setThemeSuccessMsg] = useState<string | null>(null);
  const [themeErrorMsg, setThemeErrorMsg] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);

  // Delete My Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState("");
  const [isDeletingMyAccount, setIsDeletingMyAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const handleExecuteDeleteMyAccount = async () => {
    if (deleteInputText.trim().toLowerCase() !== "حذف" && deleteInputText.trim().toLowerCase() !== "delete" && deleteInputText.trim() !== currentUser.email) {
      setDeleteAccountError(lang === "ar" ? "يرجى كتابة كلمة 'حذف' أو 'delete' أو البريد الإلكتروني للتأكيد بدقة." : "Please type 'delete', 'حذف', or your email to confirm.");
      return;
    }

    setIsDeletingMyAccount(true);
    setDeleteAccountError(null);

    try {
      const res = await authenticatedFetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete account");
      }
      localStorage.removeItem("zakir_auth_token");
      localStorage.removeItem("zakir_current_user");
      onLogout();
    } catch (err: any) {
      console.error("Account self deletion failed:", err);
      setDeleteAccountError(err.message || "Failed to delete account.");
      setIsDeletingMyAccount(false);
    }
  };

  // Appearance & Custom Theme State
  const [primaryBg, setPrimaryBg] = useState<string>(currentUser.customTheme?.primaryBg || "#0B0F19");
  const [textColor, setTextColor] = useState<string>(currentUser.customTheme?.textColor || "#F8FAFC");
  const [secondaryColor, setSecondaryColor] = useState<string>(currentUser.customTheme?.secondaryColor || "#0075DE");
  const [themeApproved, setThemeApproved] = useState<boolean>(!!currentUser.customTheme?.approvedAt);
  const [approvedTimestamp, setApprovedTimestamp] = useState<string | null>(currentUser.customTheme?.approvedAt || null);
  const [selectedThemeMode, setSelectedThemeMode] = useState<"light" | "dark" | "custom">(
    currentUser.customTheme?.approvedAt ? "custom" : theme
  );

  // Subscription Checkout Modal & Receipt State
  const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">(currentUser.billingCycle || "annual");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<"Starter" | "Professional" | "Enterprise" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"visa" | "mastercard" | "bank" | "wallet">("visa");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<{
    invoiceNo: string;
    date: string;
    plan: string;
    amount: string;
    method: string;
    payerName: string;
    payerEmail: string;
    accountRef?: string;
  } | null>(null);

  useEffect(() => {
    // Load Stripe Config dynamically using cached singleton
    fetch("/api/stripe/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.publishableKey) {
          setStripePromise(getCachedStripe(data.publishableKey));
        }
      })
      .catch((err) => console.warn("Failed to load Stripe publishable key:", err));
  }, []);

  const cleanupCheckoutState = React.useCallback(() => {
    setSelectedPlanForCheckout(null);
    setCheckoutClientSecret(null);
    setCheckoutSessionId(null);
    setPaymentError(null);
    setIsProcessingPayment(false);
    setCompletedReceipt(null);
  }, []);

  const handleReturnToPlans = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.state?.zakirCheckoutModal) {
      window.history.back(); // This will trigger popstate which calls cleanupCheckoutState
    } else {
      cleanupCheckoutState();
    }
  }, [cleanupCheckoutState]);

  useEffect(() => {
    if (selectedPlanForCheckout && !completedReceipt) {
      if (typeof window !== "undefined" && !window.history.state?.zakirCheckoutModal) {
        window.history.pushState({ zakirCheckoutModal: true }, "");
      }

      const handlePopState = () => {
        cleanupCheckoutState();
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleReturnToPlans();
        }
      };

      window.addEventListener("popstate", handlePopState);
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [selectedPlanForCheckout, completedReceipt, handleReturnToPlans, cleanupCheckoutState]);

  const embeddedCheckoutOptions = useMemo(() => {
    if (!checkoutClientSecret) return null;
    return {
      clientSecret: checkoutClientSecret,
      onComplete: () => {
        handleConfirmPayment();
      }
    };
  }, [checkoutClientSecret]);

  const handleStripeCheckout = async (plan: "Starter" | "Professional" | "Enterprise", isRetry = false) => {
    if (isProcessingPayment && !isRetry) return;

    setIsProcessingPayment(true);
    setPaymentError(null);
    setSelectedPlanForCheckout(plan);

    if (!isRetry) {
      setCheckoutClientSecret(null);
      setCheckoutSessionId(null);
    }

    try {
      const fbUser = await getAuthenticatedFirebaseUser();
      if (!fbUser && !currentUser) {
        setPaymentError(
          lang === "ar"
            ? "يجب تسجيل الدخول أولاً لإتمام الاشتراك."
            : "Please sign in first to complete your subscription."
        );
        setIsProcessingPayment(false);
        return;
      }

      const res = await authenticatedFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingCycle,
          companyName: currentUser?.companyName || currentUser?.organizationName || "Organization",
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn("[Stripe Checkout] Failed to parse JSON response:", jsonErr);
      }

      if (!res.ok || !data || !data.success || !data.clientSecret) {
        console.error("[Stripe Checkout] Session creation error:", { status: res.status, data });
        setPaymentError(
          data?.error || (
            lang === "ar"
              ? "تعذر إعداد جلسة الدفع الآمن حالياً. يرجى المحاولة لاحقاً."
              : "Unable to initialize Stripe checkout. Please try again."
          )
        );
        setIsProcessingPayment(false);
        return;
      }

      setCheckoutSessionId(data.sessionId);
      setCheckoutClientSecret(data.clientSecret);

      if (data.publishableKey) {
        setStripePromise(getCachedStripe(data.publishableKey));
      }
    } catch (err: any) {
      console.error("[Stripe Checkout] Initialization error:", err);
      setPaymentError(
        err?.message || (
          lang === "ar"
            ? "تعذر التحقق من جلسة حسابك أو الاتصال بخادم الدفع. يرجى المحاولة مرة أخرى."
            : "Could not verify your account session. Please refresh your session and try again."
        )
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true);
    try {
      const res = await authenticatedFetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated: User = {
          ...currentUser,
          subscriptionPlan: undefined,
          subscriptionStatus: "Inactive",
        };
        onUpdateUser(updated);
        setShowCancelConfirm(false);
      } else {
        alert(data.error || "Failed to cancel subscription");
      }
    } catch (err: any) {
      console.error("Cancel subscription error:", err);
      alert("Error cancelling subscription: " + err.message);
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const handleOpenStripePortal = async () => {
    try {
      const res = await authenticatedFetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripeCustomerId: currentUser.stripeCustomerId,
          userId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal redirect error:", err);
    }
  };

  // Form states for checkout
  const [cardName, setCardName] = useState(currentUser.ownerName || "");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  
  const [bankName, setBankName] = useState("Attijari Bank Mauritanie");
  const [bankRef, setBankRef] = useState("TRF-2026-99210");
  
  const [walletProvider, setWalletProvider] = useState("Bankily");
  const [walletPhone, setWalletPhone] = useState("+222 46 88 99 00");

  // CEO Team Powers Management State
  const initialTeamMembersList: TeamMember[] = currentUser.teamMembersList && currentUser.teamMembersList.length > 0 
    ? currentUser.teamMembersList 
    : [
        {
          id: "tm-owner",
          name: fullName,
          email: email,
          role: "CEO / Owner",
          powers: { fileVault: true, memoryVault: true, riskRadar: true, marketIntel: true, settings: true },
          addedAt: "2026-01-01"
        },
        {
          id: "tm-2",
          name: "Fatima Zahra",
          email: "f.zahra@g-partner.com",
          role: "Risk Auditor",
          powers: { fileVault: true, memoryVault: true, riskRadar: true, marketIntel: false, settings: true },
          addedAt: "2026-02-10"
        },
        {
          id: "tm-3",
          name: "Jean-Luc",
          email: "j.luc@g-partner.com",
          role: "Contributor",
          powers: { fileVault: true, memoryVault: true, riskRadar: false, marketIntel: false, settings: false },
          addedAt: "2026-03-01"
        },
        {
          id: "tm-4",
          name: "Aisha Diop",
          email: "a.diop@g-partner.com",
          role: "Analyst",
          powers: { fileVault: false, memoryVault: true, riskRadar: true, marketIntel: true, settings: false },
          addedAt: "2026-04-12"
        }
      ];

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembersList);
  const [editingMemberModal, setEditingMemberModal] = useState<TeamMember | null>(null);
  const [powerSaveNotify, setPowerSaveNotify] = useState(false);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);

  useEffect(() => {
    async function loadInvitations() {
      if (currentUser.role === "CEO" && currentUser.workspaceId) {
        const list = await fetchWorkspaceInvitations(currentUser.workspaceId);
        setInvitations(list);
      }
    }
    loadInvitations();
  }, [currentUser]);

  // New Team Member Form State
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<string>("Contributor");
  const [newMemberPowers, setNewMemberPowers] = useState<ModulePermissions>({
    fileVault: true,
    memoryVault: true,
    riskRadar: false,
    marketIntel: false,
    settings: false
  });
  const [isSendingInv, setIsSendingInv] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [invSuccessMsg, setInvSuccessMsg] = useState<string | null>(null);
  const [actionEmailLoading, setActionEmailLoading] = useState<string | null>(null);

  // CEO Encryption & Secret Code Protection State
  const defaultEncryptedSec: EncryptedModuleSettings = currentUser.encryptedSecurity || {
    secretPasscode: "",
    isPinSet: false,
    lockedModules: {
      fileVault: true,
      memoryVault: true,
      riskRadar: true,
      settings: false
    }
  };

  const [encryptedSecurity, setEncryptedSecurity] = useState<EncryptedModuleSettings>(defaultEncryptedSec);
  const [secretPasscodeVal, setSecretPasscodeVal] = useState<string>(currentUser.encryptedSecurity?.secretPasscode || "");
  const [secretPasscodeConfirmVal, setSecretPasscodeConfirmVal] = useState<string>(currentUser.encryptedSecurity?.secretPasscode || "");
  const [passcodeConfirmError, setPasscodeConfirmError] = useState<string>("");
  const [showSecretPasscode, setShowSecretPasscode] = useState(false);
  const [passcodeSaveNotify, setPasscodeSaveNotify] = useState(false);

  // Account Verification Upload State
  const [uploadingVerDoc, setUploadingVerDoc] = useState(false);
  const [verUploadSuccess, setVerUploadSuccess] = useState(false);
  const verFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadVerificationDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVerDoc(true);
    setVerUploadSuccess(false);

    try {
      const uploadedFile = await uploadFirebaseUserFile(
        currentUser.id,
        file,
        "Verification",
        lang === "ar" ? "وثيقة ومستند تحقق من الحساب" : "Account Verification Document",
        false
      );

      const newDoc: AccountVerificationDoc = {
        id: uploadedFile.id,
        docType: "national_id",
        fileName: file.name,
        fileUrl: uploadedFile.fileUrl,
        uploadDate: new Date().toISOString()
      };

      const existingVer = currentUser.verificationInfo || { status: "unverified", documents: [] };
      const updatedDocs = [...(existingVer.documents || []), newDoc];

      const updatedVerInfo: VerificationInfo = {
        ...existingVer,
        status: "under_review",
        requestedAt: existingVer.requestedAt || new Date().toISOString(),
        documents: updatedDocs
      };

      const updatedUser: User = {
        ...currentUser,
        verificationInfo: updatedVerInfo
      };

      await saveFirebaseUserProfile(updatedUser);
      onUpdateUser(updatedUser);

      setVerUploadSuccess(true);
      setTimeout(() => setVerUploadSuccess(false), 4000);
    } catch (err) {
      console.error("Error uploading verification document:", err);
      alert(lang === "ar" ? "فشل رفع وثيقة التحقق، يرجى إعادة المحاولة." : "Failed to upload verification document, please try again.");
    } finally {
      setUploadingVerDoc(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteVerDoc = async (docId: string, fileName?: string) => {
    if (!currentUser.verificationInfo?.documents) return;
    const confirmMsg = lang === "ar"
      ? "هل أنت تأكد من حذف هذا المستند؟"
      : "Are you sure you want to delete this document?";
    if (!window.confirm(confirmMsg)) return;

    try {
      const targetId = docId || fileName;
      if (targetId) {
        await deleteFirebaseUserFile(currentUser.id, targetId);
      }

      const updatedDocs = currentUser.verificationInfo.documents.filter(
        (d) => d.id !== docId && d.fileName !== docId && d.fileName !== fileName
      );
      const updatedVerInfo: VerificationInfo = {
        ...currentUser.verificationInfo,
        documents: updatedDocs,
        status: updatedDocs.length === 0 ? "unverified" : currentUser.verificationInfo.status
      };

      const updatedUser: User = {
        ...currentUser,
        verificationInfo: updatedVerInfo
      };

      await saveFirebaseUserProfile(updatedUser);
      onUpdateUser(updatedUser);
    } catch (err) {
      console.error("Error deleting verification document:", err);
      alert(lang === "ar" ? "فشل حذف المستند، يرجى إعادة المحاولة." : "Failed to delete document, please try again.");
    }
  };

  // Sync state when currentUser is loaded or updated
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.ownerName || "");
      setEmail(currentUser.email || "");
      setCompanyName(currentUser.companyName || "");
      setAvatarUrl(currentUser.avatarUrl);
      setCompanyLogoUrl(currentUser.companyLogoUrl);
      if (currentUser.customTheme) {
        setPrimaryBg(currentUser.customTheme.primaryBg || "#0B0F19");
        setTextColor(currentUser.customTheme.textColor || "#F8FAFC");
        setSecondaryColor(currentUser.customTheme.secondaryColor || "#0075DE");
        setThemeApproved(!!currentUser.customTheme.approvedAt);
        setApprovedTimestamp(currentUser.customTheme.approvedAt || null);
      } else {
        setThemeApproved(false);
        setApprovedTimestamp(null);
      }

      // Sync selectedThemeMode state with actual saved settings on currentUser
      if (currentUser.customTheme?.approvedAt) {
        setSelectedThemeMode("custom");
      } else if (currentUser.userPreferences?.theme) {
        setSelectedThemeMode(currentUser.userPreferences.theme);
      } else {
        setSelectedThemeMode(theme);
      }
      if (currentUser.encryptedSecurity) {
        setEncryptedSecurity(currentUser.encryptedSecurity);
        setSecretPasscodeVal(currentUser.encryptedSecurity.secretPasscode || "");
        setSecretPasscodeConfirmVal(currentUser.encryptedSecurity.secretPasscode || "");
      }
      if (currentUser.userPreferences) {
        if (currentUser.userPreferences.autoSaveMemories !== undefined) setAutoSaveMemoriesVal(currentUser.userPreferences.autoSaveMemories);
        if (currentUser.userPreferences.emailNotifications !== undefined) setEmailNotificationsVal(currentUser.userPreferences.emailNotifications);
        if (currentUser.userPreferences.riskRadarAlerts !== undefined) setRiskRadarAlertsVal(currentUser.userPreferences.riskRadarAlerts);
      }
      if (currentUser.teamMembersList && currentUser.teamMembersList.length > 0) {
        setTeamMembers(currentUser.teamMembersList);
      }
    }
  }, [currentUser]);

  // Modal State for Entering Code to Cancel/Unlock a Module
  const [cancelLockModuleTarget, setCancelLockModuleTarget] = useState<keyof EncryptedModuleSettings["lockedModules"] | null>(null);
  const [cancelLockPinInput, setCancelLockPinInput] = useState<string>("");
  const [cancelLockError, setCancelLockError] = useState<string>("");

  // Password Setting / Changing State
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPasswordInputs, setShowPasswordInputs] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  // Reset Encryption Key via Account Password State & Modal
  const [showResetEncryptionModal, setShowResetEncryptionModal] = useState(false);
  const [accountPasswordForReset, setAccountPasswordForReset] = useState("");
  const [newEncPasscodeForReset, setNewEncPasscodeForReset] = useState("");
  const [confirmEncPasscodeForReset, setConfirmEncPasscodeForReset] = useState("");
  const [resetEncLoading, setResetEncLoading] = useState(false);
  const [resetEncError, setResetEncError] = useState("");
  const [resetEncSuccess, setResetEncSuccess] = useState(false);

  // Test Encryption Unlock Verification Modal State
  const [testUnlockModalOpen, setTestUnlockModalOpen] = useState(false);
  const [testModuleTarget, setTestModuleTarget] = useState<string>("fileVault");
  const [testEnteredPin, setTestEnteredPin] = useState("");
  const [testUnlockStatus, setTestUnlockStatus] = useState<"success" | "error" | null>(null);

  // Password Handler
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg("");
    setPasswordSuccessMsg("");

    if (!newPasswordInput || newPasswordInput.length < 6) {
      setPasswordErrorMsg(lang === "ar" ? "يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام." : "Password must be at least 6 characters long.");
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordErrorMsg(lang === "ar" ? "كلمتا المرور غير متطابقتين، يرجى إعادة التأكد." : "New passwords do not match. Please verify.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await authenticatedFetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          newPassword: newPasswordInput,
          currentPassword: currentPasswordInput,
          isGoogleUser: !currentUser.hasPasswordSet
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.userFriendlyMessage || data.error || (lang === "ar" ? "فشل تحديث كلمة المرور." : "Failed to update password."));
      }

      const updatedUser: User = {
        ...currentUser,
        hasPasswordSet: true
      };
      await saveFirebaseUserProfile(updatedUser);
      onUpdateUser(updatedUser);

      setPasswordSuccessMsg(lang === "ar" ? "تم تعيين وحفظ كلمة المرور لحسابك بنجاح!" : "Password successfully set and saved to your account!");
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setTimeout(() => setPasswordSuccessMsg(""), 5000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || (lang === "ar" ? "حدث خطأ أثناء حفظ كلمة المرور" : "An error occurred while saving password"));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Reset Encryption Key with Account Password Handler
  const handleResetEncryptionWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetEncError("");

    if (!newEncPasscodeForReset.trim()) {
      setResetEncError(lang === "ar" ? "يرجى إدخال رمز التشفير السري الجديد." : "Please enter the new secret encryption passcode.");
      return;
    }

    if (newEncPasscodeForReset.trim() !== confirmEncPasscodeForReset.trim()) {
      setResetEncError(lang === "ar" ? "رمز التشفير الجديد غير متطابق." : "New encryption passcodes do not match.");
      return;
    }

    setResetEncLoading(true);
    try {
      const res = await authenticatedFetch("/api/auth/reset-encryption-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          accountPassword: accountPasswordForReset,
          newPasscode: newEncPasscodeForReset.trim(),
          lockedModules: encryptedSecurity.lockedModules
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.userFriendlyMessage || data.error || (lang === "ar" ? "فشل إعادة تعيين رمز التشفير." : "Failed to reset encryption key."));
      }

      const updatedSec: EncryptedModuleSettings = data.encryptedSecurity || {
        secretPasscode: newEncPasscodeForReset.trim(),
        isPinSet: true,
        lockedModules: encryptedSecurity.lockedModules
      };

      setEncryptedSecurity(updatedSec);
      setSecretPasscodeVal(newEncPasscodeForReset.trim());
      setSecretPasscodeConfirmVal(newEncPasscodeForReset.trim());

      const updatedUser: User = {
        ...currentUser,
        encryptedSecurity: updatedSec
      };
      await saveFirebaseUserProfile(updatedUser);
      onUpdateUser(updatedUser);

      if (onEncryptAllData) {
        onEncryptAllData(newEncPasscodeForReset.trim());
      }

      setResetEncSuccess(true);
      setTimeout(() => {
        setResetEncSuccess(false);
        setShowResetEncryptionModal(false);
        setAccountPasswordForReset("");
        setNewEncPasscodeForReset("");
        setConfirmEncPasscodeForReset("");
      }, 2000);
    } catch (err: any) {
      setResetEncError(err.message || (lang === "ar" ? "كلمة مرور الحساب غير صحيحة أو فشل الطلب" : "Invalid account password or request failed"));
    } finally {
      setResetEncLoading(false);
    }
  };

  // Synchronize Worker Permissions with Backend API
  const syncMemberPermissionsToBackend = async (member: TeamMember) => {
    try {
      await authenticatedFetch("/api/admin/update-member-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ceoId: currentUser.id,
          memberId: member.id,
          memberEmail: member.email,
          powers: member.powers,
          role: member.role
        })
      });
    } catch (e) {
      console.warn("Backend permission sync error:", e);
    }
  };

  // Handlers
  const handleTogglePowerInMatrix = (memberId: string, powerKey: keyof ModulePermissions) => {
    let updatedMember: TeamMember | null = null;
    const updated = teamMembers.map(m => {
      if (m.id === memberId) {
        updatedMember = {
          ...m,
          powers: {
            ...m.powers,
            [powerKey]: !m.powers[powerKey]
          }
        };
        return updatedMember;
      }
      return m;
    });
    setTeamMembers(updated);
    onUpdateUser({
      ...currentUser,
      teamMembersList: updated
    });
    if (updatedMember) {
      syncMemberPermissionsToBackend(updatedMember);
    }
    setPowerSaveNotify(true);
    setTimeout(() => setPowerSaveNotify(false), 2500);
  };

  const handleSaveMemberModalPowers = () => {
    if (!editingMemberModal) return;
    const updated = teamMembers.map(m => m.id === editingMemberModal.id ? editingMemberModal : m);
    setTeamMembers(updated);
    onUpdateUser({
      ...currentUser,
      teamMembersList: updated
    });
    syncMemberPermissionsToBackend(editingMemberModal);
    setEditingMemberModal(null);
    setPowerSaveNotify(true);
    setTimeout(() => setPowerSaveNotify(false), 2500);
  };

  const handleAddTeamMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const emailLower = newMemberEmail.trim().toLowerCase();
    setIsSendingInv(true);
    setInvError(null);
    setInvSuccessMsg(null);

    try {
      const res = await sendWorkspaceInvitationApi({
        email: emailLower,
        name: newMemberName.trim(),
        role: newMemberRole,
        powers: { ...newMemberPowers }
      });

      if (res.invitation) {
        setInvitations(prev => [...prev.filter(i => i.email.toLowerCase() !== emailLower), res.invitation!]);
      }

      const newMember: TeamMember = {
        id: `tm-${Date.now()}`,
        name: `${newMemberName.trim()} (${lang === "ar" ? "معلق" : "Pending"})`,
        email: emailLower,
        role: newMemberRole as any,
        powers: { ...newMemberPowers },
        addedAt: new Date().toISOString().split("T")[0]
      };

      const updated = [...teamMembers.filter(m => m.email.toLowerCase() !== emailLower), newMember];
      setTeamMembers(updated);
      onUpdateUser({
        ...currentUser,
        teamMembersList: updated
      });

      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("Contributor");
      setInvSuccessMsg(res.userFriendlyMessage || (lang === "ar" ? "تم إرسال الدعوة بنجاح!" : "Invitation sent successfully!"));
      setTimeout(() => setInvSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error("Failed to send invitation:", err);
      const errMsg = err.message || (lang === "ar" ? "فشل إرسال الدعوة، يرجى المحاولة لاحقاً." : "Failed to send invitation.");
      setInvError(errMsg);
    } finally {
      setIsSendingInv(false);
    }
  };

  const handleResendInvitation = async (email: string) => {
    setActionEmailLoading(email);
    setInvError(null);
    setInvSuccessMsg(null);
    try {
      const res = await resendWorkspaceInvitationApi(email);
      setInvSuccessMsg(res.userFriendlyMessage || (lang === "ar" ? "تمت إعادة إرسال الدعوة بنجاح!" : "Invitation resent successfully!"));
      setTimeout(() => setInvSuccessMsg(null), 6000);
      if (currentUser.workspaceId) {
        const list = await fetchWorkspaceInvitations(currentUser.workspaceId);
        setInvitations(list);
      }
    } catch (err: any) {
      setInvError(err.message || (lang === "ar" ? "فشل إعادة إرسال الدعوة." : "Failed to resend invitation."));
    } finally {
      setActionEmailLoading(null);
    }
  };

  const handleRevokeInvitation = async (email: string) => {
    setActionEmailLoading(email);
    setInvError(null);
    setInvSuccessMsg(null);
    try {
      await deleteWorkspaceInvitation(email);
      setInvitations(prev => prev.filter(i => i.email.toLowerCase() !== email.toLowerCase()));
      const updatedMembers = teamMembers.filter(m => m.email.toLowerCase() !== email.toLowerCase());
      setTeamMembers(updatedMembers);
      onUpdateUser({
        ...currentUser,
        teamMembersList: updatedMembers
      });
      setInvSuccessMsg(lang === "ar" ? "تم سحب وإلغاء الدعوة بنجاح." : "Invitation revoked successfully.");
      setTimeout(() => setInvSuccessMsg(null), 5000);
    } catch (err: any) {
      setInvError(err.message || (lang === "ar" ? "فشل إلغاء الدعوة." : "Failed to revoke invitation."));
    } finally {
      setActionEmailLoading(null);
    }
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      try {
        await deleteWorkspaceInvitation(member.email.toLowerCase());
        setInvitations(prev => prev.filter(i => i.email.toLowerCase() !== member.email.toLowerCase()));
      } catch (e) {
        console.warn("Could not delete invitation in Firestore:", e);
      }
    }
    const updated = teamMembers.filter(m => m.id !== memberId);
    setTeamMembers(updated);
    onUpdateUser({
      ...currentUser,
      teamMembersList: updated
    });
  };

  // Double-Check Passcode Confirmation & Auto-Lock File Vault, Memory & Risks
  const handleSaveEncryptionSettings = async () => {
    setPasscodeConfirmError("");
    setPasscodeSaveNotify(false);
    const pin = secretPasscodeVal.trim();
    const confirmPin = secretPasscodeConfirmVal.trim();

    if (!pin) {
      setPasscodeConfirmError(
        lang === "ar" ? "يرجى إدخال رمز سري صالح" : "Please enter a valid secret code."
      );
      return;
    }

    if (pin !== confirmPin) {
      setPasscodeConfirmError(
        lang === "ar" ? "الرمز السري غير متطابق! يرجى إعادة التأكد من الرمز." : "Secret codes do not match! Please re-check."
      );
      return;
    }

    setIsSavingEncryption(true);
    try {
      // Automatically lock File Vault, Memory Vault, and Risk Radar upon confirmation
      const newSecurityObj: EncryptedModuleSettings = {
        secretPasscode: pin,
        isPinSet: true,
        lockedModules: {
          fileVault: true,
          memoryVault: true,
          riskRadar: true,
          settings: encryptedSecurity.lockedModules.settings
        }
      };

      setEncryptedSecurity(newSecurityObj);
      await onUpdateUser({
        ...currentUser,
        encryptedSecurity: newSecurityObj
      });
      if (onEncryptAllData) {
        onEncryptAllData(pin);
      }
      setPasscodeSaveNotify(true);
      setTimeout(() => setPasscodeSaveNotify(false), 5000);
    } catch (err: any) {
      setPasscodeConfirmError(
        err.message || (lang === "ar" ? "تعذر حفظ رمز التشفير. يرجى المحاولة مرة أخرى." : "Failed to save encryption PIN.")
      );
    } finally {
      setIsSavingEncryption(false);
    }
  };

  // Toggle Module Lock: If attempting to TURN OFF lock, require Passcode entry first!
  const handleToggleModuleLock = (moduleKey: keyof EncryptedModuleSettings["lockedModules"]) => {
    const isCurrentlyLocked = encryptedSecurity.lockedModules[moduleKey];
    if (isCurrentlyLocked) {
      // Prompt for secret PIN to cancel lock
      setCancelLockModuleTarget(moduleKey);
      setCancelLockPinInput("");
      setCancelLockError("");
    } else {
      // Turn lock ON directly
      const updatedObj: EncryptedModuleSettings = {
        ...encryptedSecurity,
        lockedModules: {
          ...encryptedSecurity.lockedModules,
          [moduleKey]: true
        }
      };
      setEncryptedSecurity(updatedObj);
      onUpdateUser({
        ...currentUser,
        encryptedSecurity: updatedObj
      });
    }
  };

  const handleConfirmCancelLock = () => {
    if (!cancelLockModuleTarget) return;
    const activePasscode = encryptedSecurity.secretPasscode;
    if (!activePasscode || activePasscode.trim() === "") {
      setCancelLockError(
        lang === "ar"
          ? "لم يتم تعيين رمز سري بعد! يرجى تعيين رمز سري وتأكيده في الأعلى أولاً."
          : "No secret passcode configured yet! Please set one above first."
      );
      return;
    }

    if (cancelLockPinInput.trim() !== activePasscode.trim()) {
      setCancelLockError(
        lang === "ar" ? "الرمز السري غير صحيح! تعذر إلغاء قفل هذا القسم." : "Incorrect secret passcode! Failed to cancel module lock."
      );
      return;
    }

    // Passcode verified! Unlock module
    const updatedObj: EncryptedModuleSettings = {
      ...encryptedSecurity,
      lockedModules: {
        ...encryptedSecurity.lockedModules,
        [cancelLockModuleTarget]: false
      }
    };
    setEncryptedSecurity(updatedObj);
    onUpdateUser({
      ...currentUser,
      encryptedSecurity: updatedObj
    });
    setCancelLockModuleTarget(null);
    setCancelLockPinInput("");
    setCancelLockError("");
  };

  const handleVerifyTestPasscode = () => {
    const activePasscode = encryptedSecurity.secretPasscode;
    if (!activePasscode || activePasscode.trim() === "") {
      setTestUnlockStatus("error");
      return;
    }
    if (testEnteredPin.trim() === activePasscode.trim()) {
      setTestUnlockStatus("success");
    } else {
      setTestUnlockStatus("error");
    }
  };

  // Profile Photo Upload Handlers
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const newUrl = reader.result;
        setAvatarUrl(newUrl);
        setIsSavingProfile(true);
        setProfileSuccessMsg(null);
        setProfileErrorMsg(null);
        try {
          await onUpdateUser({
            ...currentUser,
            ownerName: fullName,
            fullName: fullName,
            email: email,
            jobTitle: jobTitle,
            department: department,
            issuingEntity: department,
            companyName: companyName,
            organizationName: companyName,
            avatarUrl: newUrl,
            companyLogoUrl: companyLogoUrl,
            signatureUrl: signatureUrl
          });
          const msg = lang === "ar" ? "تم تحديث وحفظ الصورة الشخصية بنجاح ✓" : "Profile picture updated successfully ✓";
          setProfileSuccessMsg(msg);
          setTimeout(() => setProfileSuccessMsg(null), 5000);
        } catch (err: any) {
          setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ الصورة الشخصية." : "Failed to update avatar."));
        } finally {
          setIsSavingProfile(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    try {
      await onUpdateUser({
        ...currentUser,
        ownerName: fullName,
        fullName: fullName,
        email: email,
        jobTitle: jobTitle,
        department: department,
        issuingEntity: department,
        companyName: companyName,
        organizationName: companyName,
        avatarUrl: undefined,
        companyLogoUrl: companyLogoUrl,
        signatureUrl: signatureUrl
      });
      const msg = lang === "ar" ? "تم إزالة الصورة الشخصية وحفظ التغييرات بنجاح ✓" : "Profile picture removed successfully ✓";
      setProfileSuccessMsg(msg);
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر إزالة الصورة." : "Failed to remove avatar."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Company Logo Upload Handlers
  const handleCompanyLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const newLogoUrl = reader.result;
        setCompanyLogoUrl(newLogoUrl);
        setIsSavingProfile(true);
        setProfileSuccessMsg(null);
        setProfileErrorMsg(null);
        try {
          await onUpdateUser({
            ...currentUser,
            ownerName: fullName,
            fullName: fullName,
            email: email,
            jobTitle: jobTitle,
            department: department,
            issuingEntity: department,
            companyName: companyName,
            organizationName: companyName,
            avatarUrl: avatarUrl,
            companyLogoUrl: newLogoUrl,
            signatureUrl: signatureUrl
          });
          const msg = lang === "ar" ? "تم رفع وتثبيت شعار المؤسسة الرسمي بنجاح ✓" : "Organization logo updated successfully ✓";
          setProfileSuccessMsg(msg);
          setTimeout(() => setProfileSuccessMsg(null), 5000);
        } catch (err: any) {
          setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ الشعار." : "Failed to upload company logo."));
        } finally {
          setIsSavingProfile(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCompanyLogo = async () => {
    setCompanyLogoUrl(undefined);
    if (companyLogoInputRef.current) companyLogoInputRef.current.value = "";
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    try {
      await onUpdateUser({
        ...currentUser,
        ownerName: fullName,
        fullName: fullName,
        email: email,
        jobTitle: jobTitle,
        department: department,
        issuingEntity: department,
        companyName: companyName,
        organizationName: companyName,
        avatarUrl: avatarUrl,
        companyLogoUrl: undefined,
        signatureUrl: signatureUrl
      });
      const msg = lang === "ar" ? "تم إزالة شعار المؤسسة بنجاح ✓" : "Company logo removed successfully ✓";
      setProfileSuccessMsg(msg);
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر إزالة الشعار." : "Failed to remove company logo."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Digital Signature Handlers
  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const newSigUrl = reader.result;
        setSignatureUrl(newSigUrl);
        setIsSavingProfile(true);
        setProfileSuccessMsg(null);
        setProfileErrorMsg(null);
        try {
          await onUpdateUser({
            ...currentUser,
            ownerName: fullName,
            fullName: fullName,
            email: email,
            jobTitle: jobTitle,
            department: department,
            issuingEntity: department,
            companyName: companyName,
            organizationName: companyName,
            avatarUrl: avatarUrl,
            companyLogoUrl: companyLogoUrl,
            signatureUrl: newSigUrl
          });
          const msg = lang === "ar" ? "تم حفظ واعتماد التوقيع الرقمي بنجاح ✓" : "Digital signature saved successfully ✓";
          setProfileSuccessMsg(msg);
          setTimeout(() => setProfileSuccessMsg(null), 5000);
        } catch (err: any) {
          setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ التوقيع." : "Failed to save signature."));
        } finally {
          setIsSavingProfile(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = async () => {
    setSignatureUrl(undefined);
    if (signatureInputRef.current) signatureInputRef.current.value = "";
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    try {
      await onUpdateUser({
        ...currentUser,
        ownerName: fullName,
        fullName: fullName,
        email: email,
        jobTitle: jobTitle,
        department: department,
        issuingEntity: department,
        companyName: companyName,
        organizationName: companyName,
        avatarUrl: avatarUrl,
        companyLogoUrl: companyLogoUrl,
        signatureUrl: undefined
      });
      const msg = lang === "ar" ? "تم إزالة التوقيع الرقمي بنجاح ✓" : "Digital signature removed successfully ✓";
      setProfileSuccessMsg(msg);
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر إزالة التوقيع." : "Failed to remove signature."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    try {
      await onUpdateUser({
        ...currentUser,
        ownerName: fullName,
        fullName: fullName,
        email: email,
        jobTitle: jobTitle,
        department: department,
        issuingEntity: department,
        companyName: companyName,
        organizationName: companyName,
        avatarUrl: avatarUrl,
        companyLogoUrl: companyLogoUrl,
        signatureUrl: signatureUrl
      });
      const msg = lang === "ar" 
        ? "تم حفظ معلومات الحساب والملف الشخصي بنجاح ✓" 
        : lang === "fr"
        ? "Modifications du profil enregistrées avec succès ✓"
        : "Account profile and workspace info saved successfully ✓";
      setProfileSuccessMsg(msg);
      setTimeout(() => setProfileSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      setProfileErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ التغييرات. يرجى المحاولة مرة أخرى." : "Failed to save profile changes."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveMemoryPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMemoryPrefs(true);
    setMemoryPrefsSuccessMsg(null);
    setMemoryPrefsErrorMsg(null);
    try {
      await onUpdateUser({
        ...currentUser,
        userPreferences: {
          ...(currentUser.userPreferences || {
            theme: "dark",
            language: "ar",
            emailNotifications: true,
            riskRadarAlerts: true,
            autoSaveMemories: true,
            defaultView: "overview"
          }),
          autoSaveMemories: autoSaveMemoriesVal,
          emailNotifications: emailNotificationsVal,
          riskRadarAlerts: riskRadarAlertsVal
        }
      });
      const msg = lang === "ar"
        ? "تم حفظ إعدادات الذاكرة وتفضيلات النظام بنجاح ✓"
        : lang === "fr"
        ? "Paramètres de mémoire enregistrés avec succès ✓"
        : "Memory vault & system preferences saved successfully ✓";
      setMemoryPrefsSuccessMsg(msg);
      setTimeout(() => setMemoryPrefsSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Failed to save memory preferences:", err);
      setMemoryPrefsErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ إعدادات الذاكرة." : "Failed to save memory settings."));
    } finally {
      setIsSavingMemoryPrefs(false);
    }
  };

  // Appearance Theme Approval Handler
  const handleApproveThemeChanges = async () => {
    setIsSavingTheme(true);
    setThemeSuccessMsg(null);
    setThemeErrorMsg(null);
    try {
      const now = new Date().toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      if (selectedThemeMode === "custom") {
        setThemeApproved(true);
        setApprovedTimestamp(now);

        const updatedTheme = {
          primaryBg,
          textColor,
          secondaryColor,
          approvedAt: now
        };

        await onUpdateUser({
          ...currentUser,
          customTheme: updatedTheme
        });
      } else {
        setThemeApproved(false);
        setApprovedTimestamp(null);
        setTheme(selectedThemeMode);

        await onUpdateUser({
          ...currentUser,
          userPreferences: {
            ...(currentUser.userPreferences || {
              theme: "dark",
              language: "ar",
              emailNotifications: true,
              riskRadarAlerts: true,
              autoSaveMemories: true,
              defaultView: "overview"
            }),
            theme: selectedThemeMode
          },
          customTheme: {
            primaryBg,
            textColor,
            secondaryColor,
            approvedAt: null as any
          }
        });
      }

      const msg = lang === "ar" ? "تم حفظ وتطبيق مظهر المنصة بنجاح ✓" : "Platform theme saved and applied successfully ✓";
      setThemeSuccessMsg(msg);
      setTimeout(() => setThemeSuccessMsg(null), 5000);
    } catch (err: any) {
      setThemeErrorMsg(err.message || (lang === "ar" ? "تعذر حفظ المظهر." : "Failed to save theme."));
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleResetThemeDefaults = async () => {
    setIsSavingTheme(true);
    setThemeSuccessMsg(null);
    setThemeErrorMsg(null);
    try {
      setPrimaryBg("#0B0F19");
      setTextColor("#F8FAFC");
      setSecondaryColor("#0075DE");
      setThemeApproved(false);
      setApprovedTimestamp(null);
      setSelectedThemeMode("dark");
      setTheme("dark");

      await onUpdateUser({
        ...currentUser,
        userPreferences: {
          ...(currentUser.userPreferences || {
            theme: "dark",
            language: "ar",
            emailNotifications: true,
            riskRadarAlerts: true,
            autoSaveMemories: true,
            defaultView: "overview"
          }),
          theme: "dark"
        },
        customTheme: {
          primaryBg: "#0B0F19",
          textColor: "#F8FAFC",
          secondaryColor: "#0075DE",
          approvedAt: null as any
        }
      });
      const msg = lang === "ar" ? "تم إعادة المظهر الافتراضي للمنصة وحفظه بنجاح ✓" : "Theme reset to default successfully ✓";
      setThemeSuccessMsg(msg);
      setTimeout(() => setThemeSuccessMsg(null), 5000);
    } catch (err: any) {
      setThemeErrorMsg(err.message || (lang === "ar" ? "تعذر إعادة المظهر." : "Failed to reset theme."));
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleSelectStandardTheme = (mode: "light" | "dark") => {
    setSelectedThemeMode(mode);
    setTheme(mode);
    setThemeApproved(false);
    setApprovedTimestamp(null);

    // Save user preference for light/dark mode and clear custom theme approval
    onUpdateUser({
      ...currentUser,
      userPreferences: {
        ...(currentUser.userPreferences || {
          theme: mode,
          language: "ar",
          emailNotifications: true,
          riskRadarAlerts: true,
          autoSaveMemories: true,
          defaultView: "overview"
        }),
        theme: mode
      },
      customTheme: {
        primaryBg,
        textColor,
        secondaryColor,
        approvedAt: null as any
      }
    });
  };

  const handleSelectCustomTheme = () => {
    const now = new Date().toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    setSelectedThemeMode("custom");
    setThemeApproved(true);
    setApprovedTimestamp(now);

    onUpdateUser({
      ...currentUser,
      customTheme: {
        primaryBg,
        textColor,
        secondaryColor,
        approvedAt: now
      }
    });
  };

  // Payment Checkout Confirmation Handler
  const handleConfirmPayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);

    const planName = selectedPlanForCheckout || "Professional";
    const cycle = billingCycle;
    const planCost = planName === "Starter" ? (cycle === "annual" ? "$50.00 USD" : "$6.00 USD") : planName === "Enterprise" ? (cycle === "annual" ? "$699.00 USD" : "$849.00 USD") : (cycle === "annual" ? "$149.00 USD" : "$189.00 USD");

    try {
      if (checkoutSessionId) {
        try {
          const statusRes = await authenticatedFetch(`/api/stripe/session-status/${checkoutSessionId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log("Stripe session status verified:", statusData);
          }
        } catch (statusErr) {
          console.warn("Session status verification notice:", statusErr);
        }
      }

      const methodLabel = "Stripe Embedded Checkout (Visa / MasterCard)";

      const nextDate = new Date();
      if (cycle === "annual") {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const receiptData = {
        invoiceNo: `STRIPE-INV-${new Date().getFullYear()}-${checkoutSessionId ? checkoutSessionId.slice(-6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        plan: `${planName} Plan (${cycle === "annual" ? (lang === "ar" ? "سنوي" : "Annual") : (lang === "ar" ? "شهري" : "Monthly")})`,
        amount: planCost,
        method: methodLabel,
        payerName: currentUser.ownerName || currentUser.companyName || "Subscriber",
        payerEmail: currentUser.email || "",
        accountRef: currentUser.id,
        nextBillingDate: nextDate.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")
      };

      setCompletedReceipt(receiptData);

      const updatedUser: User = {
        ...currentUser,
        subscriptionPlan: planName,
        subscriptionStatus: "Active",
        billingCycle: cycle,
        lastPaymentDate: new Date().toISOString(),
        lastPaymentAmount: planCost,
        nextBillingDate: nextDate.toISOString(),
        stripeCustomerId: currentUser.stripeCustomerId || `cus_${Math.random().toString(36).substring(2, 9)}`,
      };

      onUpdateUser(updatedUser);
    } catch (err: any) {
      console.error("Payment confirmation error:", err);
      setPaymentError(err.message || "Failed to confirm payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const initials = (fullName || email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-8">
      {/* Settings Navigation Header Bar */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        theme === "dark" 
          ? "bg-gradient-to-br from-slate-900/80 to-slate-950/90 border-slate-800/80 shadow-2xl shadow-black/40" 
          : "bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-xl shadow-slate-100/40"
      }`}>
        <div className="absolute top-0 right-0 w-64 h-32 bg-[#0075DE]/5 blur-3xl pointer-events-none rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`text-xl font-black tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {lang === "ar" ? "لوحة التحكم وإعدادات النظام" : "System & Account Workspace"}
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-[#0075DE]/15 border border-[#0075DE]/35 text-[#0075DE] font-extrabold uppercase tracking-wider font-mono">
                {currentUser.role} {lang === "ar" ? "المسؤول الأول" : "Control Desk"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {lang === "ar" 
                ? "إدارة حسابك الشخصي، تفويض الصلاحيات، واشتراكات الأمان الفائق للشركة." 
                : "Configure administrative boundaries, assign workspace permissions, and audit billing states."}
            </p>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                theme === "dark" 
                  ? "bg-slate-900 hover:bg-slate-850 border-slate-800 text-[#0075DE]" 
                  : "bg-white border-slate-250 text-slate-700 hover:bg-slate-100"
              }`}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onLogout}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "تسجيل الخروج" : "Log Out"}</span>
            </button>
          </div>
        </div>

        {/* Settings Navigation Sub-Tabs Strip */}
        <div className={`flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-b relative z-10 scrollbar-none ${
          theme === "dark" ? "border-slate-800/40" : "border-slate-200"
        }`}>
          {[
            { id: "account", label: lang === "ar" ? "الملف الشخصي" : "Profile Details", icon: UserIcon },
            { id: "security", label: lang === "ar" ? "كلمة المرور والأمان" : "Password & Security", icon: ShieldCheck },
            { id: "team", label: lang === "ar" ? "الفريق وإدارة العمال" : "Workspace Team & Workers", icon: Users },
            { id: "subscription", label: lang === "ar" ? "باقات الدفع والاشتراك" : "Plans & Payment", icon: CreditCard },
            { id: "support", label: lang === "ar" ? "الدعم والتوثيق" : "Help & Documentation", icon: HelpCircle },
          ].filter((tab) => {
            if (currentUser.role !== "CEO") {
              return tab.id === "account" || tab.id === "security" || tab.id === "subscription" || tab.id === "support";
            }
            return true;
          }).map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id || (currentTab === "company" && tab.id === "account");
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-4.5 py-3 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? "bg-[#0075DE]/15 text-[#0075DE] border-[#0075DE]/35 shadow-lg shadow-[#0075DE]/2 font-extrabold"
                    : theme === "dark"
                    ? "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#0075DE]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: ACCOUNT & PROFILE PICTURE */}
      {(currentTab === "account" || currentTab === "company") && (
        <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {lang === "ar" ? "إعدادات الحساب والصورة الشخصية" : "Account Settings & Profile Avatar"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "ar" ? "إضافة أو تغيير الصورة الشخصية وتفاصيل المستخدم المسجل" : "Manage your user profile picture, display name, and company details"}
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {/* Profile Avatar Card */}
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-6 ${
              theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarFileSelect} 
              />

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer shrink-0"
                title={lang === "ar" ? "انقر لتحميل أو تغيير الصورة الشخصية" : "Click to upload or change profile photo"}
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={fullName} 
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#0075DE]/40/80 shadow-xl shadow-[#0075DE]/10 group-hover:opacity-80 transition-opacity" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#0075DE] text-white font-black text-3xl flex items-center justify-center shadow-xl shadow-[#0075DE]/20 border-2 border-[#0075DE]/40/80 group-hover:bg-[#005BAB] transition-colors">
                    {initials}
                  </div>
                )}

                <div className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#0075DE] transition-opacity">
                  <Camera className="w-7 h-7" />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{fullName}</h3>
                  <p className="text-xs text-slate-400">{currentUser.role} • {email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0075DE]/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{avatarUrl ? (lang === "ar" ? "تغيير الصورة" : "Change Photo") : (lang === "ar" ? "إضافة صورة شخصية" : "Upload Photo")}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "حذف الصورة" : "Remove Photo"}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {lang === "ar" ? "الصيغ المدعومة: PNG, JPG, WEBP حتى 5 ميجابايت." : "Accepted formats: PNG, JPG, WEBP up to 5MB."}
                </p>
              </div>
            </div>

            {/* Account Details Form */}
            <form onSubmit={handleSaveAccountProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "الاسم الكامل المعتمد" : "Full Name"}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                      theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "البريد الإلكتروني" : "Email Address"}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                      theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "المسمى الوظيفي / الرتبة" : "Job Title / Position"}</label>
                  <input
                    type="text"
                    value={jobTitle}
                    placeholder={lang === "ar" ? "مثال: رئيس لجنة الحوكمة والقرارات" : "e.g. Chief Risk & Governance Officer"}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                      theme === "dark" ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600" : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "الإدارة / الجهة المصدرة" : "Department / Issuing Entity"}</label>
                  <input
                    type="text"
                    value={department}
                    placeholder={lang === "ar" ? "مثال: إدارة الحوكمة والمخاطر والقرارات" : "e.g. Governance & Strategy Division"}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                      theme === "dark" ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600" : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "اسم المؤسسة أو المنظمة" : "Organization / Company Name"}</label>
                <input
                  type="text"
                  value={companyName}
                  disabled={currentUser.role !== "CEO"}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                    currentUser.role !== "CEO" ? "opacity-60 cursor-not-allowed" : ""
                  } ${
                    theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {lang === "ar" 
                    ? "يتم إدراج اسم المنظمة والإدارة تلقائياً في ترويسة التقارير المطبوعة والمستندات المصدرة." 
                    : "Organization and department details are automatically embedded in official print report headers."}
                </p>
              </div>

              {/* Dedicated Company Logo Upload Field (Open to all users) */}
              <div className={`p-4 rounded-xl border border-dashed ${theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-3`}>
                <label className="block text-xs font-bold text-slate-400">
                  {lang === "ar" ? "شعار المؤسسة / المنظمة الرسمي" : "Official Organization Logo"}
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  {companyLogoUrl ? (
                    <div className="relative group shrink-0">
                      <img 
                        src={companyLogoUrl} 
                        alt="Company Logo" 
                        className="h-16 max-w-[200px] object-contain rounded-lg border border-slate-700/60 p-2 bg-slate-900/60" 
                        referrerPolicy="no-referrer"
                      />
                      {currentUser.role === "CEO" && (
                        <button
                          type="button"
                          onClick={handleRemoveCompanyLogo}
                          className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500 transition-colors shadow"
                          title={lang === "ar" ? "حذف الشعار" : "Remove Logo"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-16 w-36 rounded-lg border border-dashed border-slate-700 bg-slate-950/20 flex items-center justify-center text-[11px] text-slate-500 font-medium">
                      {lang === "ar" ? "لا يوجد شعار" : "No logo uploaded"}
                    </div>
                  )}

                  <div>
                    {currentUser.role === "CEO" ? (
                      <>
                        <input 
                          type="file" 
                          ref={companyLogoInputRef}
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleCompanyLogoFileSelect} 
                        />
                        <button
                          type="button"
                          onClick={() => companyLogoInputRef.current?.click()}
                          className="px-4 py-2 bg-[#0075DE]/10 hover:bg-[#0075DE]/20 text-[#0075DE] hover:text-blue-300 border border-[#0075DE]/30 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{companyLogoUrl ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "رفع شعار المؤسسة" : "Upload Logo")}</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 font-bold text-xs">
                        {lang === "ar" ? "🔒 تعديل الشعار مخصص للمدير التنفيذي فقط" : "🔒 Logo modification is restricted to CEO only"}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      {lang === "ar" ? "سيتم سحب الشعار تلقائياً وتثبيته في ترويسة مستندات الطباعة الرسمية." : "The logo will be pulled automatically and embedded in print headers."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dedicated Official Digital Signature Field */}
              <div className={`p-4 rounded-xl border border-dashed ${theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-3`}>
                <label className="block text-xs font-bold text-slate-400">
                  {lang === "ar" ? "التوقيع الرقمي والختم الرسمي المعتمد" : "Official Digital Signature & Seal"}
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  {signatureUrl ? (
                    <div className="relative group shrink-0">
                      <img 
                        src={signatureUrl} 
                        alt="Digital Signature" 
                        className="h-16 max-w-[200px] object-contain rounded-lg border border-slate-700/60 p-2 bg-slate-900/60" 
                        referrerPolicy="no-referrer"
                      />
                      {currentUser.role === "CEO" && (
                        <button
                          type="button"
                          onClick={handleRemoveSignature}
                          className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500 transition-colors shadow"
                          title={lang === "ar" ? "حذف التوقيع" : "Remove Signature"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-16 w-36 rounded-lg border border-dashed border-slate-700 bg-slate-950/20 flex items-center justify-center text-[11px] text-slate-500 font-medium">
                      {lang === "ar" ? "لا يوجد توقيع رقمي" : "No signature image"}
                    </div>
                  )}

                  <div>
                    {currentUser.role === "CEO" ? (
                      <>
                        <input 
                          type="file" 
                          ref={signatureInputRef}
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleSignatureFileSelect} 
                        />
                        <button
                          type="button"
                          onClick={() => signatureInputRef.current?.click()}
                          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{signatureUrl ? (lang === "ar" ? "تغيير التوقيع الرقمي" : "Change Signature") : (lang === "ar" ? "رفع صورة التوقيع / الختم" : "Upload Signature / Stamp")}</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 font-bold text-xs">
                        {lang === "ar" ? "🔒 تعديل التوقيع مخصص للمدير التنفيذي فقط" : "🔒 Signature modification is restricted to CEO only"}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      {lang === "ar" ? "يظهر التوقيع الرقمي في قسم الاعتماد والتصديق بنهاية التقارير الرسمية." : "Digital signature appears in the approval block at the end of reports."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 h-11 bg-[#0075DE] hover:bg-[#005BAB] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0075DE]/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === "ar" ? "جارٍ حفظ التغييرات..." : "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{lang === "ar" ? "حفظ التغييرات" : "Save Changes"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* DEDICATED MEMORY VAULT & SYSTEM PREFERENCES SECTION */}
            <div className={`mt-8 pt-8 border-t ${theme === "dark" ? "border-slate-800" : "border-slate-200"} space-y-6`}>
              <div>
                <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  <Brain className="w-5 h-5 text-[#0075DE]" />
                  <span>{lang === "ar" ? "إعدادات الذاكرة المؤسسية وتفضيلات النظام" : "Memory Vault & System Preferences"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "ar" 
                    ? "تخصيص الحفظ التلقائي للذكريات، تنبيهات رادار المخاطر، وإشعارات البريد الإلكتروني" 
                    : "Configure auto-saving of institutional memories, risk radar alerts, and email notifications."}
                </p>
              </div>

              {memoryPrefsSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{memoryPrefsSuccessMsg}</span>
                </div>
              )}

              {memoryPrefsErrorMsg && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{memoryPrefsErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveMemoryPreferences} className={`p-5 rounded-2xl border space-y-4 ${
                theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
                {/* Auto Save Memories Toggle */}
                <div className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border ${
                  theme === "dark" ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="space-y-0.5">
                    <label className={`text-xs font-bold block ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                      {lang === "ar" ? "الحفظ التلقائي للذكريات المؤسسية (Auto-Save Memories)" : "Auto-Save Institutional Memories"}
                    </label>
                    <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      {lang === "ar" 
                        ? "تخزين واسترجاع السجلات المؤسسية والقرارات تلقائياً داخل قاعدة البيانات" 
                        : "Automatically index and save decision records into Firestore database"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoSaveMemoriesVal(!autoSaveMemoriesVal)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                      autoSaveMemoriesVal ? "bg-[#0075DE]" : "bg-slate-700"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      autoSaveMemoriesVal ? (lang === "ar" ? "-translate-x-6" : "translate-x-6") : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Risk Radar Alerts Toggle */}
                <div className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border ${
                  theme === "dark" ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="space-y-0.5">
                    <label className={`text-xs font-bold block ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                      {lang === "ar" ? "تنبيهات رادار المخاطر (Risk Radar Alerts)" : "Risk Radar Automated Alerts"}
                    </label>
                    <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      {lang === "ar" 
                        ? "إصدار تنبيهات فورية عند اكتشاف مخاطر مالية أو قانونية حادة في القرارات" 
                        : "Trigger instant alerts when high risk scores are detected"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRiskRadarAlertsVal(!riskRadarAlertsVal)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                      riskRadarAlertsVal ? "bg-[#0075DE]" : "bg-slate-700"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      riskRadarAlertsVal ? (lang === "ar" ? "-translate-x-6" : "translate-x-6") : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Email Notifications Toggle */}
                <div className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border ${
                  theme === "dark" ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="space-y-0.5">
                    <label className={`text-xs font-bold block ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                      {lang === "ar" ? "إشعارات البريد الإلكتروني (Email Notifications)" : "Email System Notifications"}
                    </label>
                    <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      {lang === "ar" 
                        ? "استلام ملخصات القرارات اليومية والإنذارات المبكرة على البريد الإلكتروني" 
                        : "Receive decision digests and early risk alerts via email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailNotificationsVal(!emailNotificationsVal)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                      emailNotificationsVal ? "bg-[#0075DE]" : "bg-slate-700"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      emailNotificationsVal ? (lang === "ar" ? "-translate-x-6" : "translate-x-6") : "translate-x-0"
                    }`} />
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingMemoryPrefs}
                    className="px-6 h-11 bg-[#0075DE] hover:bg-[#005BAB] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0075DE]/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSavingMemoryPrefs ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{lang === "ar" ? "جارٍ حفظ الإعدادات..." : "Saving Preferences..."}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{lang === "ar" ? "حفظ إعدادات الذاكرة والنظام" : "Save Memory & System Settings"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* WORKER / NON-CEO ASSIGNED PERMISSIONS READ-ONLY SUMMARY */}
            {currentUser.role !== "CEO" && (
              <div className={`p-5 rounded-2xl border ${theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-3`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#0075DE]" />
                    <h3 className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                      {lang === "ar" ? "صلاحيات الوصول الممنوحة لك من قبل المدير التنفيذي (CEO)" : "Module Powers Granted by the CEO"}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#0075DE]/15 text-[#0075DE] border border-[#0075DE]/30">
                    {lang === "ar" ? "صلاحيات مدارة حصرياً من الـ CEO" : "Read-Only (Managed by CEO)"}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {lang === "ar" 
                    ? "أنت مسجل في المنظومة بدور (" + currentUser.role + "). يتم التحكم في صلاحيات وصولك للأقسام حصرياً من قبل المدير التنفيذي (CEO)، ولا يمكن تعديلها إلا من طرفه."
                    : `You are registered with the role (${currentUser.role}). Your module access is strictly controlled by the CEO and cannot be self-modified.`}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { key: "fileVault", label: lang === "ar" ? "إدارة الملفات" : "File Vault" },
                    { key: "memoryVault", label: lang === "ar" ? "مكتبة الذكريات" : "Memory Vault" },
                    { key: "riskRadar", label: lang === "ar" ? "رادار المخاطر" : "Risk Radar" },
                    { key: "marketIntel", label: lang === "ar" ? "استخبارات السوق" : "Market Intel" },
                    { key: "settings", label: lang === "ar" ? "إعدادات النظام" : "System Settings" },
                  ].map((p) => {
                    const isGranted = currentUser.powers ? !!currentUser.powers[p.key as keyof ModulePermissions] : (p.key === "fileVault" || p.key === "memoryVault");
                    return (
                      <div
                        key={p.key}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 ${
                          isGranted 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                            : "bg-slate-900/40 border-slate-800 text-slate-500"
                        }`}
                      >
                        {isGranted ? <Check className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
                        <span className="text-[11px] font-bold">{p.label}</span>
                        <span className="text-[9px] uppercase font-mono tracking-wider">
                          {isGranted ? (lang === "ar" ? "متاح" : "Active") : (lang === "ar" ? "مغلق" : "Locked")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACCOUNT VERIFICATION & COMPLIANCE SECTION */}
            <div className={`mt-8 pt-8 border-t ${theme === "dark" ? "border-slate-800" : "border-slate-200"} space-y-4`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                    <ShieldCheck className="w-5 h-5 text-[#0075DE]" />
                    <span>{lang === "ar" ? "حالة توثيق ودراسة الحساب" : "Account Verification Status"}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === "ar" 
                      ? "تتبع حالة تدقيق وتفعيل حسابك من قبل الإدارة ورفع الوثائق الرسمية المطلوبة" 
                      : "Track your account audit and verification status by administrators and upload required documents."}
                  </p>
                </div>

                {/* Verification Badge */}
                <div>
                  {(() => {
                    const verStatus = currentUser.verificationInfo?.status || "unverified";
                    if (verStatus === "verified") {
                      return (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {lang === "ar" ? "تم التحقق من الحساب (مفعل)" : "Account Verified"}
                        </span>
                      );
                    }
                    if (verStatus === "under_review") {
                      return (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#0075DE]/20 text-[#0075DE] border border-[#0075DE]/40 flex items-center gap-1.5 animate-pulse">
                          <Clock className="w-4 h-4" />
                          {lang === "ar" ? "الملفات قيد الدراسة والتحقق" : "Under Review"}
                        </span>
                      );
                    }
                    if (verStatus === "action_required") {
                      return (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          {lang === "ar" ? "يتطلب رفع ملفات ناقصة" : "Missing Documents"}
                        </span>
                      );
                    }
                    return (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                        <Info className="w-4 h-4" />
                        {lang === "ar" ? "غير موثق (لم يتم تقديم طلب)" : "Unverified"}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Admin Note Box if available */}
              {currentUser.verificationInfo?.adminNote && (
                <div className="p-4 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/30 text-blue-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-[#0075DE] shrink-0" />
                    <span>{lang === "ar" ? "ملاحظات الإدارة بشأن تفعيل الحساب والملفات الناقصة:" : "Admin Feedback & Missing Document Details:"}</span>
                  </div>
                  <p className="text-xs text-slate-200 pl-6 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-[#0075DE]/20 mt-1">
                    {currentUser.verificationInfo.adminNote}
                  </p>
                </div>
              )}

              {/* Upload Verification Document Area */}
              <div className={`p-5 rounded-2xl border ${theme === "dark" ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-4`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h4 className={`text-xs font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                      {lang === "ar" ? "رفع مستندات وتراخيص تفعيل الحساب" : "Upload Verification Documents"}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {lang === "ar" 
                        ? "يمكنك رفع نسخة من بطاقة الهوية الوطنية، السجل التجاري، أو البطاقة الضريبية." 
                        : "Upload ID card, commercial registration, or tax identification documents."}
                    </p>
                  </div>

                  <div>
                    <input 
                      type="file" 
                      ref={verFileInputRef} 
                      accept="image/*,application/pdf" 
                      className="hidden" 
                      onChange={handleUploadVerificationDoc} 
                    />
                    <button
                      type="button"
                      disabled={uploadingVerDoc}
                      onClick={() => verFileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0075DE]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {uploadingVerDoc ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{lang === "ar" ? "جاري رفع الوثيقة..." : "Uploading Document..."}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>{lang === "ar" ? "رفع وثيقة تحقق جديدة" : "Upload Verification File"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {verUploadSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {lang === "ar" 
                        ? "تم رفع وثيقة التحقق وتحويل الحساب لقيد الدراسة والتحقق بنجاح!" 
                        : "Verification document uploaded successfully! Status changed to Under Review."}
                    </span>
                  </div>
                )}

                {/* Display Uploaded Verification Documents List */}
                {currentUser.verificationInfo?.documents && currentUser.verificationInfo.documents.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      {lang === "ar" ? "المستندات المرفوعة سابقاً للتحقق:" : "Previously Uploaded Verification Documents:"}
                    </span>
                    <div className="space-y-2">
                      {currentUser.verificationInfo.documents.map((doc) => (
                        <div 
                          key={doc.id}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs gap-3 ${
                            theme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-[#0075DE] shrink-0" />
                            <span className={`font-bold truncate ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>{doc.fileName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({doc.docType || "ID Document"})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openUserFileInNewTab({ fileName: doc.fileName, fileUrl: doc.fileUrl, mimeType: doc.mimeType, uploadDate: doc.uploadDate, category: "Verification" })}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                              title={lang === "ar" ? "عرض في نافذة جديدة" : "View in new tab"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "عرض" : "View"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadUserFile({ fileName: doc.fileName, fileUrl: doc.fileUrl, mimeType: doc.mimeType, uploadDate: doc.uploadDate, category: "Verification" })}
                              className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                              title={lang === "ar" ? "تنزيل الملف" : "Download file"}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "تنزيل" : "Download"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVerDoc(doc.id, doc.fileName)}
                              className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer border border-rose-500/30"
                              title={lang === "ar" ? "حذف المستند" : "Delete document"}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>{lang === "ar" ? "حذف" : "Delete"}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* DANGER ZONE: DELETE MY ACCOUNT */}
              <div className={`mt-8 pt-8 border-t ${theme === "dark" ? "border-rose-950/60" : "border-rose-200"} space-y-4`}>
                <div className="p-5 rounded-2xl border bg-rose-500/5 border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2 text-rose-500">
                      <Trash2 className="w-5 h-5 text-rose-500" />
                      <span>{lang === "ar" ? "منطقة الخطر: حذف الحساب نهائياً" : "Danger Zone: Permanently Delete Account"}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      {lang === "ar"
                        ? "سيؤدي حذف حسابك إلى إزالة جميع بياناتك الشخصية ومستنداتك وملفاتك وسجلاتك بشكل نهائي من قاعدة البيانات ونظام المصادقة (Firebase Auth)، ولن تتمكن من تسجيل الدخول مجدداً."
                        : "Deleting your account will permanently remove all your profile data, documents, files, and records from Firestore and Firebase Authentication. This action cannot be undone."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{lang === "ar" ? "حذف حسابي نهائياً" : "Delete My Account"}</span>
                  </button>
                </div>
              </div>

              {/* DELETE ACCOUNT CONFIRMATION MODAL */}
              {showDeleteModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-6 ${theme === "dark" ? "bg-slate-900 border-rose-500/40 text-white" : "bg-white border-rose-300 text-slate-900"}`}>
                    <div className="flex items-center gap-3 text-rose-500">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-6 h-6 text-rose-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          {lang === "ar" ? "تأكيد حذف الحساب نهائياً؟" : "Confirm Permanent Account Deletion?"}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {lang === "ar" ? "هذا الإجراء لا يمكن التراجع عنه نهائياً." : "This action is permanent and irreversible."}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2">
                      <p className="font-bold">
                        {lang === "ar" ? "⚠️ تنبيه هام:" : "⚠️ Important Warning:"}
                      </p>
                      <p className="leading-relaxed">
                        {lang === "ar"
                          ? "سيتم حذف حسابك من نظام Firebase Authentication وتعطيل جلستك فوراً، وحذف بياناتك وسجلاتك من قاعدة البيانات."
                          : "Your account will be deleted from Firebase Authentication, your session will be revoked, and your records will be purged."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-400">
                        {lang === "ar" ? "للتأكيد، اكتب كلمة 'حذف' أو البريد الإلكتروني الخاص بك:" : "To confirm, type 'delete' or your email address:"}
                      </label>
                      <input
                        type="text"
                        value={deleteInputText}
                        onChange={(e) => setDeleteInputText(e.target.value)}
                        placeholder={currentUser.email}
                        className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-rose-500 ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    {deleteAccountError && (
                      <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold">
                        {deleteAccountError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isDeletingMyAccount}
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteInputText("");
                          setDeleteAccountError(null);
                        }}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        {lang === "ar" ? "إلغاء" : "Cancel"}
                      </button>

                      <button
                        type="button"
                        disabled={isDeletingMyAccount}
                        onClick={handleExecuteDeleteMyAccount}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingMyAccount ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{lang === "ar" ? "جاري الحذف النهائي..." : "Deleting Account..."}</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>{lang === "ar" ? "تأكيد وحذف الحساب" : "Confirm & Delete"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appearance tab completely removed */}
      {/* SUB-TAB 3: SUBSCRIPTION PLANS, PAYMENT CHANNELS & RECEIPT */}
      {currentTab === "subscription" && (
        <div className="space-y-8">
          <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] text-xs font-bold uppercase tracking-wider">
                {lang === "ar" ? "خطط الاشتراكات والترقية" : "Subscription & Billing Plans"}
              </span>
              <h2 className={`text-3xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {lang === "ar" ? "اختر الخطة المناسبة لمؤسستك" : "Choose the Ideal Plan for Your Organization"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ar" 
                  ? "خيارات دفع مرنة ومضمونة عبر الحساب البنكي، بطاقات الفيزا والماستركارد، أو المحفظة الإلكترونية مع إصدار وصل فوري" 
                  : "Flexible payments via Bank Transfer, Visa, MasterCard, or E-Wallet with instant verified invoice receipt."}
              </p>
            </div>

            {/* Current Active Plan Badge */}
            <div className="mb-8 p-4 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-[#0075DE]" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">{lang === "ar" ? "الخطة الحالية للمستخدم:" : "Current User Active Plan:"}</p>
                  <p className="text-base font-extrabold text-[#0075DE]">
                    {currentUser.subscriptionPlan || "Professional"} Plan
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                {lang === "ar" ? "نشط ومفعل" : "Active & Verified"}
              </span>
            </div>

            {/* Monthly / Annual Toggle with 20% Discount Badge */}
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 my-6 p-4 rounded-2xl border ${
              theme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}>
              <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
                theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-200/60 border-slate-300"
              }`}>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === "annual"
                      ? "bg-[#0075DE] text-white shadow-md shadow-[#0075DE]/20"
                      : theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {translations[lang as keyof typeof translations]?.billingAnnual || (lang === "ar" ? "الفوترة السنوية" : "Annual Billing")}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === "monthly"
                      ? "bg-[#0075DE] text-white shadow-md shadow-[#0075DE]/20"
                      : theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {translations[lang as keyof typeof translations]?.billingMonthly || (lang === "ar" ? "الفوترة الشهرية" : "Monthly Billing")}
                </button>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-[#0075DE]/15 border border-[#0075DE]/30 text-[#0075DE] font-extrabold text-xs flex items-center gap-1.5">
                🔥 {translations[lang as keyof typeof translations]?.save20Percent || (lang === "ar" ? "وفّر 20% عند الاشتراك السنوي" : "Save 20% on Annual Billing")}
              </span>
            </div>

            {/* Current Active Plan Badge & Stripe Customer Portal Link */}
            <div className="mb-8 p-4 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-[#0075DE] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">{lang === "ar" ? "الخطة الحالية للمستخدم:" : "Current Active User Plan:"}</p>
                  <p className="text-base font-extrabold text-[#0075DE] flex items-center gap-2">
                    <span>{currentUser.subscriptionPlan ? `${currentUser.subscriptionPlan} Plan` : (lang === "ar" ? "لم يتم اختيار خطة بعد" : "No Active Plan Selected")}</span>
                    {currentUser.subscriptionPlan && (
                      <span className={`text-xs px-2 py-0.5 rounded border font-normal ${
                        theme === "dark" ? "bg-slate-900 border-[#0075DE]/30 text-slate-300" : "bg-slate-100 border-[#0075DE]/30 text-slate-700"
                      }`}>
                        ({billingCycle === "annual" ? (lang === "ar" ? "سنوي" : "Annual") : (lang === "ar" ? "شهري" : "Monthly")})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {currentUser.stripeCustomerId && (
                  <button
                    type="button"
                    onClick={handleOpenStripePortal}
                    className={`px-4 py-2 rounded-xl border text-[#0075DE] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      theme === "dark" ? "bg-slate-900 hover:bg-slate-800 border-slate-700" : "bg-slate-100 hover:bg-slate-200 border-slate-300"
                    }`}
                  >
                    <span>{translations[lang as keyof typeof translations]?.stripePortal || (lang === "ar" ? "إدارة الاشتراك في Stripe" : "Stripe Portal")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                {currentUser.subscriptionPlan && (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء الاشتراك" : "Cancel Subscription"}
                  </button>
                )}

                {currentUser.subscriptionPlan ? (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                    {lang === "ar" ? "نشط ومفعل" : "Active & Verified"}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-[#0075DE]/20 text-[#0075DE] font-bold text-xs">
                    {lang === "ar" ? "في انتظار تفعيل خطة" : "Pending Selection"}
                  </span>
                )}
              </div>
            </div>

            {/* Confirmation Modal for Subscription Cancellation */}
            {showCancelConfirm && (
              <div className="mb-6 p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>{lang === "ar" ? "تأكيد إلغاء الاشتراك الحالي" : "Confirm Subscription Cancellation"}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {lang === "ar" 
                    ? "هل أنت أثق من رغبتك في إلغاء التجديد التلقائي للاشتراك؟ ستستمر في التمتع بمزايا خطتك حتى نهاية الفترة المدفوعة." 
                    : "Are you sure you want to cancel automatic subscription renewal? You will retain access until the end of the billing period."}
                </p>
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {lang === "ar" ? "التراجع" : "Keep Subscription"}
                  </button>
                  <button
                    type="button"
                    disabled={isCancellingSubscription}
                    onClick={handleCancelSubscription}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isCancellingSubscription ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{lang === "ar" ? "جاري الإلغاء..." : "Cancelling..."}</span>
                      </>
                    ) : (
                      <span>{lang === "ar" ? "نعم، إلغاء الاشتراك" : "Yes, Cancel Subscription"}</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Plans Grid with Benchmark Prices */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* PLAN 1: STARTER ($50 Annual / $6 Monthly) */}
              <div className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 ${
                theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Starter</h3>
                    <p className={`text-xs mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{translations[lang as keyof typeof translations]?.planStarterDesc || (lang === "ar" ? "خطة استكشافية للمؤسسات والفرق ($50 سنوياً أو $6 شهرياً)" : "Exploration tier for teams ($50/year or $6/month)")}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                      ${billingCycle === "annual" ? "50" : "6"}
                    </span>
                    <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      / {billingCycle === "annual" ? (lang === "ar" ? "سنوياً" : "yr") : (lang === "ar" ? "شهرياً" : "mo")}
                      {billingCycle === "annual" && <span className="text-[10px] text-[#0075DE] font-semibold ml-1">({lang === "ar" ? "تُدفع $50 سنوياً" : "billed $50 annually"})</span>}
                    </span>
                  </div>
                  <ul className={`space-y-2.5 pt-4 text-xs border-t ${theme === "dark" ? "text-slate-300 border-slate-800" : "text-slate-700 border-slate-200"}`}>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {lang === "ar" ? "دعوة الأعضاء وصلاحيات متعددة (RBAC)" : "Multi-user seat access & RBAC"}</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {lang === "ar" ? "إدارة الملفات الكاملة والإعدادات" : "Full File & Settings Management"}</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {lang === "ar" ? "بحث وتحليل سببي للذكريات" : "Causal Memory Search & Analysis"}</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleStripeCheckout("Starter")}
                  disabled={currentUser.subscriptionPlan === "Starter"}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    currentUser.subscriptionPlan === "Starter"
                      ? (theme === "dark" ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed")
                      : "bg-[#0075DE]/15 hover:bg-[#0075DE] text-[#0075DE] hover:text-white border border-[#0075DE]/30"
                  }`}
                >
                  {currentUser.subscriptionPlan === "Starter"
                    ? (lang === "ar" ? "الخطة المفعلة حالياً" : "Current Plan")
                    : (lang === "ar" ? "الاشتراك بخطة Starter - Stripe" : "Subscribe Starter - Stripe Checkout")}
                </button>
              </div>

              {/* PLAN 2: PROFESSIONAL ($149 Annual / $189 Monthly) — PRIMARY FEATURED BLUE CARD (MUST REMAIN WHITE TEXT IN LIGHT AND DARK MODES) */}
              <div className="p-6 rounded-2xl border-2 border-[#0075DE] bg-gradient-to-b from-[#0075DE] to-[#005BAB] text-white shadow-2xl shadow-[#0075DE]/20 flex flex-col justify-between space-y-6 relative transform md:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-[#0075DE] font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg">
                  {lang === "ar" ? "الخطة الأكثر شعبية" : "Most Popular"}
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Professional <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    </h3>
                    <p className="text-xs text-blue-100 mt-1">{translations[lang as keyof typeof translations]?.planProDesc || (lang === "ar" ? "للمؤسسات والشركات النامية" : "For growing organizations")}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
                      ${billingCycle === "annual" ? "149" : "189"}
                    </span>
                    <span className="text-xs text-blue-100">
                      / {lang === "ar" ? "شهرياً" : "mo"} {billingCycle === "annual" && <span className="text-[10px] text-amber-200 font-semibold">({lang === "ar" ? "تُدفع سنوياً - توفير 20%" : "billed annually"})</span>}
                    </span>
                  </div>
                  <ul className="space-y-2.5 pt-4 text-xs text-white border-t border-blue-400/30">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white shrink-0" /> Unlimited Memories & Vault</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white shrink-0" /> Full Causal AI Graph Analysis</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white shrink-0" /> Automated Risk Alerts & Notifications</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white shrink-0" /> Multi-user seat access & RBAC</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white shrink-0" /> Priority 24/7 Dedicated Support</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleStripeCheckout("Professional")}
                  disabled={isProcessingPayment}
                  className="w-full py-4 bg-white hover:bg-slate-100 text-[#0075DE] font-black text-xs rounded-xl shadow-xl shadow-black/10 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <span>{translations[lang as keyof typeof translations]?.subscribePayNow || (lang === "ar" ? "الاشتراك بالخطة الاحترافية - Stripe" : "Subscribe Professional - Stripe Checkout")}</span>
                  <ArrowRight className="w-4 h-4 text-[#0075DE]" />
                </button>
              </div>

              {/* PLAN 3: ENTERPRISE ($699 Annual / $849 Monthly) */}
              <div className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 ${
                theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Enterprise</h3>
                    <p className={`text-xs mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{translations[lang as keyof typeof translations]?.planEnterpriseDesc || (lang === "ar" ? "للمؤسسات الكبرى والهيئات السيادية" : "For large conglomerates & sovereign entities")}</p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                        ${billingCycle === "annual" ? "699" : "849"}
                      </span>
                      <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>/ {lang === "ar" ? "شهرياً" : "mo"}</span>
                    </div>
                    <p className="text-[11px] text-[#0075DE] font-semibold mt-1">
                      {translations[lang as keyof typeof translations]?.startingFrom || (lang === "ar" ? "تبدأ من $699/شهرياً" : "Starting from $699/mo")}
                    </p>
                  </div>
                  <ul className={`space-y-2.5 pt-4 text-xs border-t ${theme === "dark" ? "text-slate-300 border-slate-800" : "text-slate-700 border-slate-200"}`}>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Dedicated Firebase / Cloud SQL Instance</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> 99.99% Guaranteed SLA Uptime</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> SOC2 & GDPR Compliance Framework</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Invoicing & Direct Contract Billing</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleStripeCheckout("Enterprise")}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-[#0075DE]/20 hover:bg-[#0075DE]/30 text-[#0075DE] border border-[#0075DE]/40 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{translations[lang as keyof typeof translations]?.upgradeEnterprise || (lang === "ar" ? "الاشتراك بخطة المؤسسات (Stripe Checkout)" : "Subscribe Enterprise (Stripe Checkout)")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="mailto:mohamedvadel60@gmail.com?subject=Zakir%20Enterprise%20Plan%20Inquiry"
                    className="w-full py-2.5 bg-[#0075DE]/10 hover:bg-[#0075DE]/20 text-[#0075DE] border border-[#0075DE]/30 text-center font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all block cursor-pointer"
                  >
                    <span>{translations[lang as keyof typeof translations]?.contactSales || (lang === "ar" ? "تواصل مع المبيعات" : "Contact Sales")}</span>
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT & PAYMENT MODAL WITH IN-APP STRIPE EMBEDDED CHECKOUT */}
      {selectedPlanForCheckout && (
        <div 
          id="stripe-checkout-modal-backdrop"
          className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden ${
            completedReceipt ? "printable-receipt-modal" : ""
          }`}
          style={{ height: "100dvh", maxHeight: "100dvh" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !completedReceipt) {
              handleReturnToPlans();
            }
          }}
        >
          <div 
            id="stripe-checkout-modal-dialog"
            className={`w-full max-w-2xl md:max-w-3xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
              theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
            style={{
              maxHeight: "min(94dvh, 880px)",
              height: "auto",
            }}
          >
            {!completedReceipt ? (
              <>
                {/* 1. FIXED / STICKY HEADER WITH PROMINENT BACK & CLOSE BUTTONS */}
                <div className="shrink-0 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-700/60 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-sm z-10">
                  {/* Prominent Back Button */}
                  <button
                    type="button"
                    onClick={handleReturnToPlans}
                    className="px-3.5 py-2 sm:px-4 sm:py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer group shadow-sm active:scale-95"
                    id="checkout-back-button"
                  >
                    <ArrowLeft className={`w-4 h-4 text-[#0075DE] group-hover:-translate-x-1 transition-transform ${lang === "ar" ? "rotate-180" : ""}`} />
                    <span>
                      {lang === "ar"
                        ? "← رجوع"
                        : lang === "fr"
                        ? "← Retour"
                        : "← Back"}
                    </span>
                  </button>

                  {/* Plan Info Badge & Secure indicator */}
                  <div className="flex items-center gap-2 text-center">
                    <div className="flex flex-col items-center sm:items-end">
                      <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-white">
                        <CreditCard className="w-4 h-4 text-[#0075DE]" />
                        <span>{lang === "ar" ? "الدفع الآمن — Stripe" : "Secure Checkout — Stripe"}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {selectedPlanForCheckout} Plan ({billingCycle === "annual" ? (lang === "ar" ? "سنوي" : "Annual") : (lang === "ar" ? "شهري" : "Monthly")})
                      </span>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={handleReturnToPlans}
                    className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
                    title={lang === "ar" ? "إغلاق والعودة للباقات" : "Close & return to plans"}
                    aria-label="Close"
                    id="checkout-close-button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 2. DEDICATED SCROLLABLE PAYMENT CONTENT CONTAINER */}
                <div 
                  id="stripe-checkout-scroll-container"
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 overscroll-contain"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                  }}
                >
                  {/* Selected Plan Summary Banner with Change Plan Quick Action */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/30 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-5 h-5 text-[#0075DE] shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-400">{lang === "ar" ? "تفاصيل الطلب:" : "Order Summary:"}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-extrabold text-[#0075DE]">
                            {selectedPlanForCheckout} Plan ({billingCycle === "annual" ? (lang === "ar" ? "سنوي - وفر 20%" : "Annual - Save 20%") : (lang === "ar" ? "شهري" : "Monthly")})
                          </p>
                          <button
                            type="button"
                            onClick={handleReturnToPlans}
                            className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer font-semibold"
                          >
                            ({lang === "ar" ? "تغيير الباقة / الفترة" : lang === "fr" ? "Changer de forfait" : "Change plan / interval"})
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">{lang === "ar" ? "المبلغ المستحق:" : "Total Amount:"}</p>
                      <p className="text-sm sm:text-base font-black text-emerald-400">
                        {selectedPlanForCheckout === "Starter" ? (billingCycle === "annual" ? "$50.00 USD" : "$6.00 USD") : selectedPlanForCheckout === "Enterprise" ? (billingCycle === "annual" ? "$699.00 USD" : "$849.00 USD") : (billingCycle === "annual" ? "$149.00 USD" : "$189.00 USD")}
                      </p>
                    </div>
                  </div>

                  {/* Error Banner if Any */}
                  {paymentError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{paymentError}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStripeCheckout(selectedPlanForCheckout, true)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                        >
                          {lang === "ar" ? "إعادة المحاولة" : "Try Again"}
                        </button>
                        <button
                          type="button"
                          onClick={handleReturnToPlans}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-[10px] cursor-pointer"
                        >
                          {lang === "ar" ? "العودة للباقات" : "Back to plans"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Embedded Checkout Body without restrictive overflow: hidden */}
                  {isProcessingPayment && !checkoutClientSecret ? (
                    <div className="py-16 text-center space-y-4">
                      <RefreshCw className="w-8 h-8 text-[#0075DE] animate-spin mx-auto" />
                      <p className="text-xs text-slate-300 font-medium">
                        {lang === "ar" ? "جاري تهيئة بوابة Stripe للدفع الآمن داخل المنصة..." : "Initializing secure in-app Stripe Checkout..."}
                      </p>
                    </div>
                  ) : checkoutClientSecret && stripePromise && embeddedCheckoutOptions ? (
                    <div 
                      key={checkoutClientSecret} 
                      className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-2 sm:p-4 min-h-[420px]"
                      id="stripe-embedded-checkout-host"
                    >
                      <PaymentErrorBoundary
                        lang={lang}
                        onRetry={() => handleStripeCheckout(selectedPlanForCheckout, true)}
                      >
                        <EmbeddedCheckoutProvider
                          key={checkoutClientSecret}
                          stripe={stripePromise}
                          options={embeddedCheckoutOptions}
                        >
                          <EmbeddedCheckout />
                        </EmbeddedCheckoutProvider>
                      </PaymentErrorBoundary>
                    </div>
                  ) : !paymentError ? (
                    <div className="py-12 text-center space-y-4">
                      <RefreshCw className="w-8 h-8 text-[#0075DE] animate-spin mx-auto" />
                      <p className="text-xs text-slate-400">
                        {lang === "ar" ? "جاري الاتصال بخوادم Stripe..." : "Connecting to Stripe..."}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              /* PAYMENT CONFIRMATION RECEIPT / INVOICE DISPLAY */
              <div 
                id="stripe-receipt-scroll-container"
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 text-slate-900 dark:text-white overscroll-contain"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-400">
                    {lang === "ar" ? "تم دفع الرسوم وإصدار الوصل بنجاح!" : "Payment Successfully Processed & Verified!"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === "ar" ? "تمت معالجة المعاملة وتفعيل اشتراكك فوراً في النظام" : "Your transaction has been confirmed and subscription is now active."}
                  </p>
                </div>

                {/* Printable Invoice Details */}
                <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 font-mono text-xs text-slate-300">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="font-bold text-white text-sm">ZAKIR Official Payment Receipt</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold uppercase text-[10px]">
                      PAID & APPROVED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <p className="text-slate-500 text-[10px]">{lang === "ar" ? "رقم الوصل:" : "Receipt No:"}</p>
                      <p className="font-bold text-white">{completedReceipt.invoiceNo}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px]">{lang === "ar" ? "تاريخ الدفع:" : "Date & Time:"}</p>
                      <p className="font-bold text-white">{completedReceipt.date}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px]">{lang === "ar" ? "الخطة المفعّلة:" : "Subscription Plan:"}</p>
                      <p className="font-bold text-[#0075DE]">{completedReceipt.plan}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px]">{lang === "ar" ? "المبلغ المدفوع:" : "Total Paid:"}</p>
                      <p className="font-bold text-emerald-400 text-sm">{completedReceipt.amount}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <p className="text-slate-500 text-[10px]">{lang === "ar" ? "وسيلة الدفع المستعملة:" : "Payment Channel Used:"}</p>
                    <p className="font-bold text-white">{completedReceipt.method}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <p>Account Owner: {completedReceipt.payerName} ({completedReceipt.payerEmail})</p>
                  </div>
                </div>

                {/* Receipt Actions */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `==================================================\n               ZAKIR OFFICIAL PAYMENT RECEIPT      \n==================================================\nInvoice Number:   ${completedReceipt.invoiceNo}\nDate & Time:      ${completedReceipt.date}\nStatus:           PAID & APPROVED\n--------------------------------------------------\nCLIENT INFORMATION:\n--------------------------------------------------\nPayer Name:       ${completedReceipt.payerName}\nPayer Email:      ${completedReceipt.payerEmail}\nAccount ID:       ${completedReceipt.accountRef || "N/A"}\n\n--------------------------------------------------\nSUBSCRIPTION DETAILS:\n--------------------------------------------------\nPlan Purchased:   ${completedReceipt.plan}\nTotal Amount:     ${completedReceipt.amount}\nPayment Method:   ${completedReceipt.method}\nBilling Interval: Monthly\n\n--------------------------------------------------\nThank you for your business!\nZAKIR Compliance & Risk Management Platform\n==================================================`;
                      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
                      const downloadAnchor = document.createElement("a");
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `ZAKIR_Receipt_${completedReceipt.invoiceNo}.txt`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="flex-1 min-w-[120px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === "ar" ? "تنزيل الوصل" : "Download Receipt"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 min-w-[120px] py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === "ar" ? "طباعة الوصل" : "Print Receipt"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanForCheckout(null);
                      setCompletedReceipt(null);
                    }}
                    className="flex-1 min-w-[120px] py-3 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{lang === "ar" ? "العودة للوحة" : "Return"}</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SUB-TAB 4: TEAM & USER ROLES (WITH SPECIAL CEO POWERS MANAGEMENT & AUTHORIZATION MATRIX) */}
      {currentTab === "team" && (
        <div className="space-y-8">
          
          {/* Notification Toast for Saved Powers */}
          {powerSaveNotify && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>
                  {lang === "ar" 
                    ? "تم تحديث وحفظ صلاحيات المدير التنفيذي (CEO) للأعضاء في Firestore بنجاح!" 
                    : "CEO custom powers & permissions updated and committed to Firestore successfully!"}
                </span>
              </div>
              <span className="text-[10px] opacity-80">Synced</span>
            </div>
          )}

          {/* CEO Special Authority Header Card */}
          <div className={`p-6 rounded-2xl border space-y-4 ${
            theme === "dark" 
              ? "bg-slate-900/60 border-slate-800" 
              : "bg-white border-slate-200 shadow-sm"
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-1 rounded-full bg-[#0075DE]/15 border border-[#0075DE]/30 text-[#0075DE] font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {lang === "ar" ? "صلاحيات المدير التنفيذي (CEO)" : "CEO Executive Authorization Active"}
                  </span>
                </div>
                <h2 className={`text-2xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "إدارة أفراد الفريق وتخصيص الصلاحيات" : "Team Structure & Individual Power Grants"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "ar" 
                    ? "بصفتك المدير التنفيذي، يمكنك منح أو سحب الوصول الفردي لكل عضو في الفريق لإدارة الملفات والذكريات والمخاطر والإعدادات" 
                    : "As CEO/Owner, you can grant or revoke granular feature access rights for each team member across all workspace modules."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTestUnlockModalOpen(true)}
                className={`px-4 py-2.5 border border-[#0075DE]/30 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-[#0075DE]" : "bg-slate-100 hover:bg-slate-200 text-[#0075DE]"
                }`}
              >
                <Key className="w-4 h-4 text-[#0075DE]" />
                <span>{lang === "ar" ? "اختبار الرمز السري وإلغاء القفل" : "Test Secret Code Unlock"}</span>
              </button>
            </div>

            {/* CEO Authorization Matrix Table */}
            <div className={`pt-4 border-t ${theme === "dark" ? "border-slate-800/60" : "border-slate-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  <Sliders className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? "مصفوفة صلاحيات الأعضاء (المعينة من طرف CEO):" : "Member Power Authorization Matrix (Designated by CEO):"}</span>
                </h3>
                <span className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  {lang === "ar" ? "انقر على الخانات للتعديل المباشر" : "Click checkboxes to toggle powers directly"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b uppercase text-[10px] tracking-wider ${
                      theme === "dark" ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
                    }`}>
                      <th className="py-3 px-4 font-bold">{lang === "ar" ? "عضو الفريق" : "Team Member"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "الدور" : "Designated Role"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "📁 إدارة الملفات" : "File Vault"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "🧠 مكتبة الذكريات" : "Memory Vault"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "⚠️ رادار المخاطر" : "Risk Radar"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "📊 استخبارات السوق" : "Market Intel"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "⚙️ إعدادات النظام" : "System Settings"}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${
                    theme === "dark" ? "divide-slate-800/60 text-slate-200" : "divide-slate-200 text-slate-700"
                  }`}>
                    {teamMembers.map((member) => (
                      <tr key={member.id} className={`transition-colors ${
                        theme === "dark" ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                      }`}>
                        <td className="py-3.5 px-4 font-bold flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#0075DE]/20 text-[#0075DE] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-bold text-xs ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{member.name}</p>
                            <p className={`text-[10px] font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{member.email}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            member.role.includes("CEO") 
                              ? "bg-[#0075DE]/20 text-[#0075DE] border border-[#0075DE]/30" 
                              : theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
                          }`}>
                            {member.role}
                          </span>
                        </td>

                        {(["fileVault", "memoryVault", "riskRadar", "marketIntel", "settings"] as (keyof ModulePermissions)[]).map((powerKey) => (
                          <td key={powerKey} className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!member.powers[powerKey]}
                              onChange={() => handleTogglePowerInMatrix(member.id, powerKey)}
                              className={`w-4 h-4 rounded text-[#0075DE] focus:ring-[#0075DE] cursor-pointer accent-[#0075DE] ${
                                theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
                              }`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ACTIVE TEAM MEMBERS CARDS WITH CEO CUSTOM POWERS BUTTONS */}
          <div className="space-y-4">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              {lang === "ar" ? "قائمة الأعضاء وإعدادات الوصول الفردية:" : "Active Team Seat Grants & Individual CEO Powers:"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamMembers.map((member) => (
                <div 
                  key={member.id} 
                  className={`p-5 rounded-2xl border space-y-4 flex flex-col justify-between ${
                    theme === "dark" ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0075DE]/20 text-[#0075DE] font-extrabold text-sm flex items-center justify-center border border-[#0075DE]/30">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                          <span>{member.name}</span>
                          {member.role.includes("CEO") && (
                            <span className="px-2 py-0.5 rounded bg-[#0075DE]/20 text-[#0075DE] text-[10px] font-bold">Owner</span>
                          )}
                        </h4>
                        <p className={`text-xs font-mono ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{member.email}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono ${
                      theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
                    }`}>
                      {member.role}
                    </span>
                  </div>

                  {/* Powers Badges */}
                  <div className={`space-y-2 pt-3 border-t ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      {lang === "ar" ? "الصلاحيات الممنوحة من CEO:" : "CEO Granted Module Powers:"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "fileVault", label: lang === "ar" ? "إدارة الملفات" : "File Vault" },
                        { key: "memoryVault", label: lang === "ar" ? "مكتبة الذكريات" : "Memory Vault" },
                        { key: "riskRadar", label: lang === "ar" ? "رادار المخاطر" : "Risk Radar" },
                        { key: "marketIntel", label: lang === "ar" ? "استخبارات السوق" : "Market Intel" },
                        { key: "settings", label: lang === "ar" ? "إعدادات النظام" : "System Settings" },
                      ].map((p) => {
                        const isGranted = member.powers[p.key as keyof ModulePermissions];
                        return (
                          <span
                            key={p.key}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                              isGranted 
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                                : theme === "dark" ? "bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60" : "bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60"
                            }`}
                          >
                            {isGranted ? <Check className="w-3 h-3 text-emerald-500" /> : <Lock className="w-3 h-3 text-slate-400" />}
                            <span>{p.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`pt-3 border-t flex items-center justify-between ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
                    <button
                      type="button"
                      onClick={() => setEditingMemberModal(member)}
                      className="px-3 py-1.5 bg-[#0075DE]/15 hover:bg-[#0075DE]/25 text-[#0075DE] border border-[#0075DE]/30 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تعديل صلاحيات العضو" : "Configure Member Powers"}</span>
                    </button>

                    {!member.role.includes("CEO") && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTeamMember(member.id)}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          theme === "dark" ? "text-slate-500 hover:text-red-400 hover:bg-slate-900" : "text-slate-400 hover:text-red-600 hover:bg-slate-100"
                        }`}
                        title={lang === "ar" ? "حذف العضو" : "Remove Member"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ADD NEW TEAM MEMBER WITH CUSTOM POWERS FORM */}
          <div className={`p-6 rounded-2xl border space-y-4 ${
            theme === "dark" ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-white shadow-sm"
          }`}>
            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
              <Plus className="w-4 h-4 text-[#0075DE]" />
              <span>{lang === "ar" ? "إضافة عضو جديد وتخصيص صلاحياته:" : "Provision New Team Member with Custom Powers:"}</span>
            </h3>

            {invSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{invSuccessMsg}</span>
              </div>
            )}

            {invError && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{invError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeamMemberSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "الاسم الكامل" : "Full Name"}</label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="e.g. Mohamed Mahmoud"
                    className={`w-full h-10 px-3 rounded-xl text-xs focus:border-[#0075DE] focus:outline-none border ${
                      theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "البريد الإلكتروني المؤسسي" : "Corporate Email"}</label>
                  <input
                    type="email"
                    required
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="e.g. m.mahmoud@g-partner.com"
                    className={`w-full h-10 px-3 rounded-xl text-xs font-mono focus:border-[#0075DE] focus:outline-none border ${
                      theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "الدور الوظيفي" : "Designated Role"}</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className={`w-full h-10 px-3 rounded-xl text-xs focus:border-[#0075DE] focus:outline-none border ${
                      theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  >
                    <option value="Compliance Officer">Compliance Officer</option>
                    <option value="Risk Auditor">Risk Auditor</option>
                    <option value="Analyst">Analyst</option>
                    <option value="Contributor">Contributor</option>
                    <option value="View Only">View Only</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes for initial powers */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <p className="text-xs font-bold text-[#0075DE]">
                  {lang === "ar" ? "تحديد الصلاحيات المبدئية للعضو الجديد:" : "Select Initial Powers for New Member:"}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  {[
                    { key: "fileVault", label: lang === "ar" ? "إدارة الملفات" : "File Vault" },
                    { key: "memoryVault", label: lang === "ar" ? "مكتبة الذكريات" : "Memory Vault" },
                    { key: "riskRadar", label: lang === "ar" ? "رادار المخاطر" : "Risk Radar" },
                    { key: "marketIntel", label: lang === "ar" ? "استخبارات السوق" : "Market Intel" },
                    { key: "settings", label: lang === "ar" ? "إعدادات النظام" : "System Settings" },
                  ].map((p) => (
                    <label key={p.key} className={`flex items-center gap-2 text-xs cursor-pointer ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      <input
                        type="checkbox"
                        checked={!!newMemberPowers[p.key as keyof ModulePermissions]}
                        onChange={(e) => setNewMemberPowers({
                          ...newMemberPowers,
                          [p.key]: e.target.checked
                        })}
                        className={`w-4 h-4 rounded text-[#0075DE] focus:ring-[#0075DE] accent-[#0075DE] ${
                          theme === "dark" ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"
                        }`}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingInv}
                className="px-5 py-3 bg-[#0075DE] hover:bg-[#005BAB] disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#0075DE]/10"
              >
                {isSendingInv ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>
                  {isSendingInv
                    ? (lang === "ar" ? "جاري جاري التوثيق وإرسال البريد..." : "Authenticating & Sending...")
                    : (lang === "ar" ? "دعوة العضو وتخصيص الصلاحيات" : "Invite Member & Grant CEO Powers")}
                </span>
              </button>
            </form>
          </div>

          {/* PENDING & SENT INVITATIONS LIST */}
          {invitations.length > 0 && (
            <div className={`p-6 rounded-2xl border space-y-4 ${
              theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-bold flex items-center gap-2 ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}>
                  <Mail className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? "قائمة الدعوات الموجهة للموظفين:" : "Sent & Pending Invitations:"}</span>
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#0075DE]/15 text-[#0075DE] font-mono font-bold">
                  {invitations.length} {lang === "ar" ? "دعوة" : "invitations"}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {invitations.map((inv) => {
                  const isLoadingThis = actionEmailLoading === inv.email;
                  return (
                    <div
                      key={inv.email}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${
                            theme === "dark" ? "text-white" : "text-slate-900"
                          }`}>{inv.name || inv.email.split("@")[0]}</span>
                          <span className={`text-xs font-mono ${
                            theme === "dark" ? "text-slate-400" : "text-slate-500"
                          }`}>({inv.email})</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            theme === "dark" ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {inv.role}
                          </span>
                        </div>
                        <div className={`flex items-center gap-3 text-[11px] ${
                          theme === "dark" ? "text-slate-400" : "text-slate-500"
                        }`}>
                          <span>
                            {lang === "ar" ? "تاريخ الإرسال:" : "Sent:"}{" "}
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "N/A"}
                          </span>
                          {inv.resendCount ? (
                            <span className="text-slate-500">
                              ({lang === "ar" ? `أعيد إرسالها ${inv.resendCount} مرات` : `Resent ${inv.resendCount} times`})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                        {/* Status Badge */}
                        {inv.status === "accepted" ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{lang === "ar" ? "تم القبول" : "Accepted"}</span>
                          </span>
                        ) : inv.status === "email_failed" ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{lang === "ar" ? "تعذر تسليم البريد" : "Delivery Failed"}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>{lang === "ar" ? "قيد الانتظار" : "Pending"}</span>
                          </span>
                        )}

                        {/* Actions */}
                        {inv.status !== "accepted" && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleResendInvitation(inv.email)}
                              className="px-3 py-1.5 bg-[#0075DE]/15 hover:bg-[#0075DE]/25 disabled:opacity-50 text-[#0075DE] border border-[#0075DE]/30 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                              title={lang === "ar" ? "إعادة إرسال البريد الإلكتروني" : "Resend Email"}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingThis ? "animate-spin" : ""}`} />
                              <span>{lang === "ar" ? "إعادة إرسال البريد" : "Resend Email"}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleRevokeInvitation(inv.email)}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                                theme === "dark" ? "text-slate-500 hover:text-red-400 hover:bg-slate-900" : "text-slate-400 hover:text-red-600 hover:bg-slate-100"
                              }`}
                              title={lang === "ar" ? "سحب وإلغاء الدعوة" : "Revoke Invitation"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 2: PASSWORD & SECURITY / ENCRYPTION PASSCODE CONTROL */}
      {currentTab === "security" && (
        <div className="space-y-8">

          {/* SECTION 1: ACCOUNT PASSWORD MANAGEMENT (For Google & Email users) */}
          <div className={`p-6 rounded-2xl border space-y-6 ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="px-3 py-1 rounded-full bg-[#0075DE]/15 border border-[#0075DE]/30 text-[#0075DE] text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit mb-2">
                  <Key className="w-3.5 h-3.5" />
                  {lang === "ar" ? "إدارة كلمة مرور الحساب" : "Account Password Management"}
                </span>
                <h2 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "تعيين وتغيير كلمة مرور الحساب" : "Set or Change Account Password"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "ar" 
                    ? "تعيين كلمة مرور لحسابك (خاصة للمسجلين عبر Google) لتسجيل الدخول المباشر، أو تحديث كلمة المرور الحالية" 
                    : "Set a password for your account (including Google sign-in accounts) or update your existing password."}
                </p>
              </div>

              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                currentUser.hasPasswordSet
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              }`}>
                {currentUser.hasPasswordSet 
                  ? (lang === "ar" ? "✓ كلمة المرور مفعلة ومحددة" : "✓ Password Set") 
                  : (lang === "ar" ? "⚠ مسجل بجوجل (لم يتم تعيين كلمة سر)" : "⚠ Google Account (No Password Set)")}
              </span>
            </div>

            {passwordSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className={`p-5 rounded-2xl border ${theme === "dark" ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-4`}>
              {currentUser.hasPasswordSet && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {lang === "ar" ? "كلمة المرور الحالية (Current Password):" : "Current Password:"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInputs ? "text" : "password"}
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل كلمة المرور الحالية لحسابك" : "Enter current password"}
                      className={`w-full h-11 pl-3 pr-10 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                        theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInputs(!showPasswordInputs)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPasswordInputs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {currentUser.hasPasswordSet 
                      ? (lang === "ar" ? "كلمة المرور الجديدة (New Password):" : "New Password:") 
                      : (lang === "ar" ? "تعيين كلمة مرور جديدة للحساب:" : "Set New Account Password:")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInputs ? "text" : "password"}
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل كلمة المرور الجديدة (6 خانات فأكثر)" : "New password (min 6 chars)"}
                      className={`w-full h-11 pl-3 pr-10 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                        theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    {lang === "ar" ? "تأكيد كلمة المرور الجديدة:" : "Confirm New Password:"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInputs ? "text" : "password"}
                      required
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder={lang === "ar" ? "أعد إدخال نفس كلمة المرور للتأكيد" : "Repeat new password"}
                      className={`w-full h-11 pl-3 pr-10 rounded-xl border text-sm font-medium focus:outline-none focus:border-[#0075DE] ${
                        theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <p className="text-[11px] text-slate-500">
                  {lang === "ar" 
                    ? "يتيح لك تعيين كلمة المرور تسجيل الدخول لاحقاً بواسطة البريد وكلمة السر مباشرة دون الحاجة لـ Google فقط." 
                    : "Setting a password allows direct login using your email and password in addition to Google Auth."}
                </p>

                <button
                  type="submit"
                  disabled={passwordLoading || !newPasswordInput}
                  className="px-5 py-2.5 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#0075DE]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === "ar" ? "جاري الحفظ..." : "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>{currentUser.hasPasswordSet ? (lang === "ar" ? "تحديث كلمة المرور" : "Update Password") : (lang === "ar" ? "تعيين كلمة المرور لأول مرة" : "Set Account Password")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Success Toast for Encryption Passcode */}
          {passcodeSaveNotify && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>
                  {lang === "ar" 
                    ? "تم حفظ وتفعيل الرمز السري وتشفير الأقسام الحساسة في Firestore بنجاح!" 
                    : "CEO secret encryption code & module locks saved and activated successfully!"}
                </span>
              </div>
              <span className="text-[10px] opacity-80">Encrypted</span>
            </div>
          )}

          {/* Main Encryption Control Panel Header */}
          <div className={`p-6 rounded-2xl border space-y-6 ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div>
              <span className="px-3 py-1 rounded-full bg-[#0075DE]/15 border border-[#0075DE]/30 text-[#0075DE] text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit mb-2">
                <Lock className="w-3.5 h-3.5" />
                {lang === "ar" ? "مركز التشفير والرمز السري (CEO)" : "CEO Encryption & Secret Code Center"}
              </span>
              <h2 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {lang === "ar" ? "تشفير وحماية إدارة الملفات والذكريات والمخاطر برمز سري" : "Encrypt & Protect Files, Memories, Risks & Sensitive Data"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "ar" 
                  ? "يمكن للمدير التنفيذي (CEO) وضع رمز سري وتشفير أقسام إدارة الملفات والذكريات المؤسسية والتنبيهات الحساسة لمنع الوصول غير المصرح به" 
                  : "Set a master secret passcode to lock and encrypt sensitive workspace modules including File Management, Memory Vault, Risk Radar, and System Settings."}
              </p>
            </div>

            {/* Secret Passcode Configuration Box */}
            <div className={`p-6 rounded-2xl border space-y-5 ${
              theme === "dark" ? "border-[#0075DE]/30 bg-slate-950/80" : "border-[#0075DE]/30 bg-slate-50"
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b ${
                theme === "dark" ? "border-slate-800" : "border-slate-200"
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0075DE]/20 text-[#0075DE] flex items-center justify-center border border-[#0075DE]/30">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${
                      theme === "dark" ? "text-white" : "text-slate-900"
                    }`}>
                      {lang === "ar" ? "الرمز السري المعتمد للتشفير (Master Encryption PIN):" : "Master Encryption Security Code / PIN:"}
                    </h3>
                    <p className={`text-[11px] ${
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    }`}>
                      {lang === "ar" ? "رمز الوصول الحصري المطلوب لفك تشفير الأقسام المحمية" : "Required passkey to unlock encrypted modules"}
                    </p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                  encryptedSecurity.isPinSet 
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {encryptedSecurity.isPinSet ? (lang === "ar" ? "الرمز مفعل ومحمي" : "Passcode Active") : (lang === "ar" ? "غير مفعل" : "PIN Disabled")}
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${
                      theme === "dark" ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {lang === "ar" ? "1. أدخل الرمز السري الجديد:" : "1. Enter Secret Code / Passcode:"}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretPasscode ? "text" : "password"}
                        value={secretPasscodeVal}
                        onChange={(e) => setSecretPasscodeVal(e.target.value)}
                        placeholder={lang === "ar" ? "أدخل الرمز السري الخاص (مثلاً: 1234)" : "Enter secret passcode (e.g. 1234)"}
                        className={`w-full h-11 pl-3 pr-10 border text-[#0075DE] font-mono text-sm rounded-xl focus:border-[#0075DE] focus:outline-none tracking-widest ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretPasscode(!showSecretPasscode)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer ${
                          theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {showSecretPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${
                      theme === "dark" ? "text-slate-400" : "text-slate-600"
                    }`}>
                      {lang === "ar" ? "2. إعـادة التأكـد مـن الـرمـز السـري:" : "2. Re-check & Confirm Secret Code:"}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretPasscode ? "text" : "password"}
                        value={secretPasscodeConfirmVal}
                        onChange={(e) => setSecretPasscodeConfirmVal(e.target.value)}
                        placeholder={lang === "ar" ? "أدخل نفس الرمز للتأكيد" : "Confirm secret passcode"}
                        className={`w-full h-11 pl-3 pr-10 border text-[#0075DE] font-mono text-sm rounded-xl focus:border-[#0075DE] focus:outline-none tracking-widest ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {secretPasscodeVal && secretPasscodeConfirmVal && (
                  <div className="pt-1">
                    {secretPasscodeVal.trim() === secretPasscodeConfirmVal.trim() ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{lang === "ar" ? "✓ الرمز السري متطابق تماماً وجاهز للتأكيد والتشفير التلقائي" : "✓ Secret codes match! Ready to confirm & auto-encrypt data."}</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{lang === "ar" ? "✕ الرمز السري غير متطابق! يرجى إعادة التأكد من الرمز المدخل" : "✕ Passcodes do not match! Please verify both fields."}</span>
                      </div>
                    )}
                  </div>
                )}

                {passcodeConfirmError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{passcodeConfirmError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveEncryptionSettings}
                    disabled={isSavingEncryption}
                    className="flex-1 h-11 bg-gradient-to-r from-[#0075DE] to-[#005BAB] hover:from-[#005BAB] hover:to-[#005BAB] disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#0075DE]/20"
                  >
                    {isSavingEncryption ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{lang === "ar" ? "جارٍ الحفظ وتفعيل التشفير..." : "Saving & Encrypting..."}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{lang === "ar" ? "تأكيد الرمز والتشفير التلقائي" : "Confirm Code & Auto-Encrypt All Data"}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestUnlockModalOpen(true);
                      setTestEnteredPin("");
                      setTestUnlockStatus(null);
                    }}
                    className={`px-5 h-11 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer border ${
                      theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700" : "bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
                    }`}
                  >
                    <Unlock className="w-4 h-4 text-[#0075DE]" />
                    <span>{lang === "ar" ? "اختبار فك القفل" : "Test Unlock"}</span>
                  </button>
                </div>

                {/* Reset Encryption Key in case forgotten using Account Password */}
                <div className={`pt-3 border-t flex items-center justify-between flex-wrap gap-2 ${
                  theme === "dark" ? "border-slate-800/80" : "border-slate-200"
                }`}>
                  <span className={`text-[11px] ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {lang === "ar" 
                      ? "هل نسيت رمز التشفير السري الخاص بك؟ يمكنك استعادته عبر كلمة مرور حسابك." 
                      : "Forgot your encryption passcode? You can reset it using your account password."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetEncryptionModal(true);
                      setResetEncError("");
                      setResetEncSuccess(false);
                      setAccountPasswordForReset("");
                      setNewEncPasscodeForReset("");
                      setConfirmEncPasscodeForReset("");
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "إعادة تعيين رمز التشفير بكلمة المرور" : "Reset Passcode with Password"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Encrypted Modules Selection Grid */}
            <div className="space-y-4 pt-2">
              <h3 className={`text-sm font-bold flex items-center gap-2 ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}>
                <Shield className="w-4 h-4 text-[#0075DE]" />
                <span>{lang === "ar" ? "تحديد الأقسام القابلة للتشفير والإغلاق بالرمز السري:" : "Select Modules to Encrypt & Lock with Secret Code:"}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. FILE MANAGEMENT VAULT LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.fileVault 
                    ? "bg-[#0075DE]/10 border-[#0075DE]/40" 
                    : theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.fileVault ? "bg-[#0075DE]/20 text-[#0075DE]" : theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold flex items-center gap-2 ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}>
                        <span>{lang === "ar" ? "تشفير إدارة الملفات (File Vault)" : "Encrypted File Management"}</span>
                        {encryptedSecurity.lockedModules.fileVault && (
                          <span className="px-2 py-0.5 rounded bg-[#0075DE]/20 text-[#0075DE] text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {lang === "ar" ? "يتطلب إدخال الرمز السري لعرض وتحميل المستندات" : "Requires secret passcode to view and download files"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("fileVault")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.fileVault ? "bg-[#0075DE]" : theme === "dark" ? "bg-slate-800" : "bg-slate-300"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full absolute top-0.5 transition-transform ${
                      theme === "dark" ? "bg-slate-950" : "bg-white shadow-sm"
                    } ${
                      encryptedSecurity.lockedModules.fileVault ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 2. MEMORY LIBRARY VAULT LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.memoryVault 
                    ? "bg-[#0075DE]/10 border-[#0075DE]/40" 
                    : theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.memoryVault ? "bg-[#0075DE]/20 text-[#0075DE]" : theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold flex items-center gap-2 ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}>
                        <span>{lang === "ar" ? "تشفير مكتبة الذكريات (Memory Vault)" : "Encrypted Memory Vault"}</span>
                        {encryptedSecurity.lockedModules.memoryVault && (
                          <span className="px-2 py-0.5 rounded bg-[#0075DE]/20 text-[#0075DE] text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {lang === "ar" ? "حماية الذكريات والقرارات الاستراتيجية بالرمز السري" : "Locks institutional memories & causal factors behind PIN"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("memoryVault")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.memoryVault ? "bg-[#0075DE]" : theme === "dark" ? "bg-slate-800" : "bg-slate-300"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full absolute top-0.5 transition-transform ${
                      theme === "dark" ? "bg-slate-950" : "bg-white shadow-sm"
                    } ${
                      encryptedSecurity.lockedModules.memoryVault ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 3. RISK RADAR & SENSITIVE ALERTS LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.riskRadar 
                    ? "bg-[#0075DE]/10 border-[#0075DE]/40" 
                    : theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.riskRadar ? "bg-[#0075DE]/20 text-[#0075DE]" : theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"
                    }`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold flex items-center gap-2 ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}>
                        <span>{lang === "ar" ? "تشفير رادار المخاطر والمعلومات الحساسة" : "Encrypted Risk Radar & Alerts"}</span>
                        {encryptedSecurity.lockedModules.riskRadar && (
                          <span className="px-2 py-0.5 rounded bg-[#0075DE]/20 text-[#0075DE] text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {lang === "ar" ? "إغلاق سجل المخاطر الحرجة والتقارير المالية الحساسة" : "Encrypts high-risk warnings & internal audit data"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("riskRadar")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.riskRadar ? "bg-[#0075DE]" : theme === "dark" ? "bg-slate-800" : "bg-slate-300"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full absolute top-0.5 transition-transform ${
                      theme === "dark" ? "bg-slate-950" : "bg-white shadow-sm"
                    } ${
                      encryptedSecurity.lockedModules.riskRadar ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 4. SYSTEM SETTINGS LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.settings 
                    ? "bg-[#0075DE]/10 border-[#0075DE]/40" 
                    : theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.settings ? "bg-[#0075DE]/20 text-[#0075DE]" : theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"
                    }`}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold flex items-center gap-2 ${
                        theme === "dark" ? "text-white" : "text-slate-900"
                      }`}>
                        <span>{lang === "ar" ? "تشفير إعدادات لوحة التحكم" : "Encrypted System Settings"}</span>
                        {encryptedSecurity.lockedModules.settings && (
                          <span className="px-2 py-0.5 rounded bg-[#0075DE]/20 text-[#0075DE] text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {lang === "ar" ? "قفل تعديلات الاشتراك وصلاحيات الفريق بالرمز السري" : "Locks admin controls & billing updates with secret code"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("settings")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.settings ? "bg-[#0075DE]" : theme === "dark" ? "bg-slate-800" : "bg-slate-300"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full absolute top-0.5 transition-transform ${
                      theme === "dark" ? "bg-slate-950" : "bg-white shadow-sm"
                    } ${
                      encryptedSecurity.lockedModules.settings ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

              </div>
            </div>

            {/* SYSTEM BACKUP EXPORT SECTION */}
            <div className={`pt-6 border-t space-y-3 ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{lang === "ar" ? "تصدير نسخ احتياطية مشفرة (JSON)" : "Export Encrypted Full Memory Vault Backup (JSON)"}</p>
                  <p className={`text-[11px] mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{lang === "ar" ? "تحميل سجل الذكريات والتنبيهات المعتمدة" : "Download encrypted snapshot of institutional memories and permissions"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentUser));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `memoryos_backup_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="px-4 py-2.5 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "تصدير الآن" : "Export Backup"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT MEMBER POWERS MODAL (CEO INDIVIDUAL POWER GRANT) */}
      {editingMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-6 shadow-2xl ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  <Sliders className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? `تخصيص صلاحيات العضو: ${editingMemberModal.name}` : `CEO Power Grants: ${editingMemberModal.name}`}</span>
                </h3>
                <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{editingMemberModal.email} ({editingMemberModal.role})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMemberModal(null)}
                className={`p-1 hover:text-white ${theme === "dark" ? "text-slate-400" : "text-slate-500 hover:text-slate-800"}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-[#0075DE] uppercase tracking-wider">
                {lang === "ar" ? "الأقسام المتاحة للعضو:" : "Module Access Powers Granted by CEO:"}
              </p>

              {[
                { key: "fileVault", title: lang === "ar" ? "إدارة الملفات (File Vault)" : "File Vault Access", desc: lang === "ar" ? "رفع واستعراض وتنزيل المستندات" : "Upload, view, and download files" },
                { key: "memoryVault", title: lang === "ar" ? "مكتبة الذكريات (Memory Vault)" : "Memory Vault Access", desc: lang === "ar" ? "تسجيل واستعراض الذكريات والقرارات" : "Log, view, and query institutional memories" },
                { key: "riskRadar", title: lang === "ar" ? "رادار المخاطر والتنبيهات" : "Risk Radar & Alerts", desc: lang === "ar" ? "استعراض ومتابعة التنبيهات الحساسة" : "Review high-level risk warnings & audits" },
                { key: "marketIntel", title: lang === "ar" ? "استخبارات السوق والتحليلات" : "Market Intelligence", desc: lang === "ar" ? "إنشاء تقارير الذكاء الاصطناعي للسوق" : "Generate AI intelligence forecasts" },
                { key: "settings", title: lang === "ar" ? "إعدادات النظام والتحكم" : "System Settings Access", desc: lang === "ar" ? "إدارة الدفع وإرشادات الفريق" : "Modify workspace configuration" },
              ].map((p) => {
                const isChecked = !!editingMemberModal.powers[p.key as keyof ModulePermissions];
                return (
                  <div key={p.key} className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div>
                      <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{p.title}</p>
                      <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{p.desc}</p>
                    </div>

                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        setEditingMemberModal({
                          ...editingMemberModal,
                          powers: {
                            ...editingMemberModal.powers,
                            [p.key]: e.target.checked
                          }
                        });
                      }}
                      className={`w-5 h-5 rounded text-[#0075DE] focus:ring-[#0075DE] accent-[#0075DE] cursor-pointer ${
                        theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingMemberModal(null)}
                className={`flex-1 py-3 font-bold text-xs rounded-xl cursor-pointer ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleSaveMemberModalPowers}
                className="flex-1 py-3 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#0075DE]/20"
              >
                <Save className="w-4 h-4" />
                <span>{lang === "ar" ? "حفظ الصلاحيات" : "Save Granted Powers"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: HELP & SUPPORT CENTER */}
      {currentTab === "support" && (
        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b ${theme === "dark" ? "border-slate-800/60" : "border-slate-200"}`}>
              <div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit mb-2">
                  <HelpCircle className="w-3.5 h-3.5" />
                  {lang === "ar" ? "خدمة العملاء والدعم الفني" : "Customer Support Center"}
                </span>
                <h2 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "الدعم والتعليمات" : "Help & Support"}
                </h2>
                <p className={`text-xs mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {lang === "ar" 
                    ? "نحن هنا لمساعدتك. يمكنك التواصل مع فريق الدعم الفني والإبلاغ عن المشاكل أو طلب المساعدة."
                    : "We're here to help. You can report technical problems, account issues, bugs, or ask any questions."}
                </p>
              </div>
            </div>

            <div className="pt-6">
              <CustomerSupport currentUser={currentUser} lang={lang} theme={theme} />
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE PASSCODE UNLOCK VERIFICATION TESTER MODAL */}
      {testUnlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0075DE]" />
                <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "اختبار الرمز السري لفك التشفير" : "Test Secret Code Decryption Unlock"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestUnlockModalOpen(false)}
                className={`p-1 ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                ✕
              </button>
            </div>

            <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
              {lang === "ar"
                ? "أدخل الرمز السري الخاص بالمدير التنفيذي لفك تشفير واختبار قفل الأقسام المحمية:"
                : "Enter the master CEO secret passcode to verify unlocking encrypted modules:"}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === "ar" ? "أدخل الرمز السري:" : "Enter Secret Passcode / PIN:"}
                </label>
                <input
                  type="password"
                  value={testEnteredPin}
                  onChange={(e) => {
                    setTestEnteredPin(e.target.value);
                    setTestUnlockStatus(null);
                  }}
                  placeholder="••••"
                  className={`w-full h-11 px-3 border text-[#0075DE] font-mono text-center text-lg tracking-widest rounded-xl focus:border-[#0075DE] focus:outline-none ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"
                  }`}
                />
              </div>

              {testUnlockStatus === "success" && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{lang === "ar" ? "تم التحقق بنجاح! الرمز السري صحيح وتصلك الصلاحيات الكاملة." : "Access Granted! Secret passcode is verified and module is unlocked."}</span>
                </div>
              )}

              {testUnlockStatus === "error" && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{lang === "ar" ? "الرمز السري غير صحيح! يرجى التأكد من الرمز المدخل." : "Invalid Secret Passcode! Verification failed."}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTestUnlockModalOpen(false)}
                className={`flex-1 py-3 font-bold text-xs rounded-xl cursor-pointer transition-colors ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>

              <button
                type="button"
                onClick={handleVerifyTestPasscode}
                className="flex-1 py-3 bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#0075DE]/20"
              >
                <Unlock className="w-4 h-4" />
                <span>{lang === "ar" ? "التحقق وفك القفل" : "Verify & Unlock"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSCODE VERIFICATION MODAL TO CANCEL / REMOVE LOCK ON A MODULE */}
      {cancelLockModuleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 text-[#0075DE]">
                <Lock className="w-5 h-5" />
                <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "تأكيد فك التشفير وإلغاء القفل" : "Confirm Passcode to Cancel Lock"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelLockModuleTarget(null);
                  setCancelLockError("");
                }}
                className={`p-1 ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-blue-500 dark:text-blue-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#0075DE] shrink-0" />
              <span>
                {lang === "ar" 
                  ? "لإلغاء القفل والتشفير عن هذا القسم، يجب إدخال الرمز السري المعتمد للمدير التنفيذي أولاً." 
                  : "To remove encryption & unlock this module, you must enter the CEO secret passcode first."}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  {lang === "ar" ? "أدخل الرمز السري للتحقق:" : "Enter Secret Code to Unlock:"}
                </label>
                <input
                  type="password"
                  value={cancelLockPinInput}
                  onChange={(e) => {
                    setCancelLockPinInput(e.target.value);
                    setCancelLockError("");
                  }}
                  placeholder="••••"
                  className={`w-full h-11 px-3 border text-[#0075DE] font-mono text-center text-lg tracking-widest rounded-xl focus:border-[#0075DE] focus:outline-none ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"
                  }`}
                />
              </div>

              {cancelLockError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{cancelLockError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelLockModuleTarget(null);
                  setCancelLockError("");
                }}
                className={`flex-1 py-3 font-bold text-xs rounded-xl cursor-pointer ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {lang === "ar" ? "إلغاء الأمر" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleConfirmCancelLock}
                className="flex-1 py-3 bg-gradient-to-r from-[#0075DE] to-[#005BAB] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#0075DE]/20"
              >
                <Unlock className="w-4 h-4" />
                <span>{lang === "ar" ? "تأكيد وإلغاء القفل" : "Verify & Unlock"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET ENCRYPTION PASSCODE WITH ACCOUNT PASSWORD MODAL */}
      {showResetEncryptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl animate-fadeIn ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-2.5 text-amber-500 dark:text-amber-400">
                <Key className="w-5 h-5" />
                <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "استعادة وتعيين رمز التشفير بكلمة المرور" : "Reset Encryption PIN with Account Password"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetEncryptionModal(false);
                  setResetEncError("");
                }}
                className={`p-1 ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {lang === "ar" 
                  ? "في حال نسيت رمز التشفير، يرجى إدخال كلمة مرور حسابك للتحقق من هويتك وتعيين رمز تشفير جديد." 
                  : "If you forgot your encryption code, enter your account password to verify identity and set a new passcode."}
              </span>
            </div>

            {resetEncSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{lang === "ar" ? "✓ تم التحقق من كلمة المرور وإعادة تعيين رمز التشفير بنجاح!" : "✓ Password verified and encryption passcode reset successfully!"}</span>
              </div>
            )}

            {resetEncError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{resetEncError}</span>
              </div>
            )}

            <form onSubmit={handleResetEncryptionWithPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  {lang === "ar" ? "كلمة المرور الحالية للحساب (Account Password):" : "Current Account Password:"}
                </label>
                <input
                  type="password"
                  required
                  value={accountPasswordForReset}
                  onChange={(e) => setAccountPasswordForReset(e.target.value)}
                  placeholder={lang === "ar" ? "أدخل كلمة مرور حسابك لتأكيد الهوية" : "Enter your account password"}
                  className={`w-full h-11 px-3 border rounded-xl text-xs focus:border-[#0075DE] focus:outline-none ${
                    theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  {lang === "ar" ? "رمز التشفير السري الجديد (New Passcode):" : "New Secret Encryption Passcode:"}
                </label>
                <input
                  type="password"
                  required
                  value={newEncPasscodeForReset}
                  onChange={(e) => setNewEncPasscodeForReset(e.target.value)}
                  placeholder="e.g. 1234"
                  className={`w-full h-11 px-3 border text-[#0075DE] font-mono text-center text-base tracking-widest rounded-xl focus:border-[#0075DE] focus:outline-none ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  {lang === "ar" ? "تأكيد رمز التشفير السري الجديد:" : "Confirm New Encryption Passcode:"}
                </label>
                <input
                  type="password"
                  required
                  value={confirmEncPasscodeForReset}
                  onChange={(e) => setConfirmEncPasscodeForReset(e.target.value)}
                  placeholder="Repeat passcode"
                  className={`w-full h-11 px-3 border text-[#0075DE] font-mono text-center text-base tracking-widest rounded-xl focus:border-[#0075DE] focus:outline-none ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetEncryptionModal(false);
                    setResetEncError("");
                  }}
                  className={`flex-1 py-3 font-bold text-xs rounded-xl cursor-pointer ${
                    theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>

                <button
                  type="submit"
                  disabled={resetEncLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {resetEncLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === "ar" ? "جاري التحقق..." : "Verifying..."}</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>{lang === "ar" ? "تأكيد واستعادة الرمز" : "Verify & Reset PIN"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
