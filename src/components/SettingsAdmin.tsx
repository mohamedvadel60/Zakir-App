import React, { useState, useRef, useEffect } from "react";
import { auth } from "../firebase.js";
import { authenticatedFetch } from "../lib/apiUtils.js";
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
  RefreshCw,
  CheckCircle,
  Eye,
  EyeOff,
  Edit3,
  Plus,
  Unlock,
  Sliders,
  Shield,
  Clock,
  Info,
  ExternalLink,
  HelpCircle
} from "lucide-react";
import { CustomerSupport } from "./CustomerSupport.js";
import { User, UserRole, TeamMember, ModulePermissions, EncryptedModuleSettings, AccountVerificationDoc, VerificationInfo, VerificationStatus } from "../types.js";
import { saveWorkspaceInvitation, deleteWorkspaceInvitation, fetchWorkspaceInvitations, WorkspaceInvitation, saveFirebaseUserProfile, uploadFirebaseUserFile, deleteFirebaseUserFile } from "../lib/firebaseServices.js";
import { openOrDownloadUserFile, openUserFileInNewTab, downloadUserFile } from "../lib/fileViewerUtils.js";
import { translations } from "../translations.js";

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
    "account" | "appearance" | "subscription" | "team" | "security"
  >("account");

  let currentTab = externalSubTab || internalSubTab;
  if (currentUser.role !== "CEO" && currentTab !== "account" && currentTab !== "appearance") {
    currentTab = "account";
  }

  const handleTabChange = (tab: "account" | "appearance" | "subscription" | "team" | "security") => {
    if (currentUser.role !== "CEO" && tab !== "account" && tab !== "appearance") {
      return;
    }
    if (setExternalSubTab) {
      setExternalSubTab(tab);
    }
    setInternalSubTab(tab);
  };

  // Profile Account State
  const [fullName, setFullName] = useState(currentUser.ownerName || "Mohamed Vadel");
  const [email, setEmail] = useState(currentUser.email || "mohamedvadel60@gmail.com");
  const [companyName, setCompanyName] = useState(currentUser.companyName || "Mauritanian Finance Group");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>(currentUser.companyLogoUrl);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);

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
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "visa" | "mastercard" | "wallet">("visa");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const handleStripeCheckout = async (plan: "Starter" | "Professional" | "Enterprise") => {
    setIsProcessingPayment(true);
    try {
      const res = await authenticatedFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingCycle,
          userId: currentUser.id,
          userEmail: currentUser.email,
          companyName: currentUser.companyName,
        }),
      });
      const data = await res.json();
      if (data.url) {
        if (data.url.includes("checkout.stripe.com")) {
          const newTab = window.open(data.url, "_blank");
          if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
            window.location.href = data.url;
          }
        } else if (data.url.includes("checkout=success")) {
          const updated: User = {
            ...currentUser,
            subscriptionPlan: plan,
            subscriptionStatus: "Active",
            billingCycle,
            lastPaymentDate: new Date().toISOString(),
            lastPaymentAmount: plan === "Starter" ? (billingCycle === "annual" ? "$50.00 USD" : "$6.00 USD") : plan === "Enterprise" ? (billingCycle === "annual" ? "$699.00 USD" : "$849.00 USD") : (billingCycle === "annual" ? "$149.00 USD" : "$189.00 USD"),
            stripeCustomerId: currentUser.stripeCustomerId || `cus_${Math.random().toString(36).substring(2, 9)}`,
          };
          onUpdateUser(updated);

          const urlObj = new URL(data.url, window.location.origin);
          const sessionId = urlObj.searchParams.get("session_id") || `cs_${Date.now()}`;
          try {
            const rcRes = await authenticatedFetch(`/api/stripe/receipt/${sessionId}?plan=${plan}&cycle=${billingCycle}`);
            const rcData = await rcRes.json();
            if (rcData.receipt) {
              setCompletedReceipt(rcData.receipt);
            }
          } catch (e) {
            console.error("Receipt fetch error:", e);
          }
        } else {
          window.location.href = data.url;
        }
      } else {
        const updated: User = {
          ...currentUser,
          subscriptionPlan: plan,
          subscriptionStatus: "Active",
          billingCycle,
          lastPaymentDate: new Date().toISOString(),
          lastPaymentAmount: plan === "Starter" ? (billingCycle === "annual" ? "$50.00 USD" : "$6.00 USD") : plan === "Enterprise" ? (billingCycle === "annual" ? "$699.00 USD" : "$849.00 USD") : (billingCycle === "annual" ? "$149.00 USD" : "$189.00 USD"),
        };
        onUpdateUser(updated);
        setSelectedPlanForCheckout(plan);
      }
    } catch (err) {
      console.error("Stripe Checkout error:", err);
    } finally {
      setIsProcessingPayment(false);
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
        if (data.url.includes("stripe.com")) {
          const newTab = window.open(data.url, "_blank");
          if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
            window.location.href = data.url;
          }
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Portal redirect error:", err);
    }
  };
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

  // Form states for checkout
  const [cardName, setCardName] = useState(currentUser.ownerName || "Mohamed Vadel");
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8892");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("889");
  
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
      if (currentUser.teamMembersList && currentUser.teamMembersList.length > 0) {
        setTeamMembers(currentUser.teamMembersList);
      }
    }
  }, [currentUser]);

  // Modal State for Entering Code to Cancel/Unlock a Module
  const [cancelLockModuleTarget, setCancelLockModuleTarget] = useState<keyof EncryptedModuleSettings["lockedModules"] | null>(null);
  const [cancelLockPinInput, setCancelLockPinInput] = useState<string>("");
  const [cancelLockError, setCancelLockError] = useState<string>("");

  // Test Encryption Unlock Verification Modal State
  const [testUnlockModalOpen, setTestUnlockModalOpen] = useState(false);
  const [testModuleTarget, setTestModuleTarget] = useState<string>("fileVault");
  const [testEnteredPin, setTestEnteredPin] = useState("");
  const [testUnlockStatus, setTestUnlockStatus] = useState<"success" | "error" | null>(null);

  // Handlers
  const handleTogglePowerInMatrix = (memberId: string, powerKey: keyof ModulePermissions) => {
    const updated = teamMembers.map(m => {
      if (m.id === memberId) {
        return {
          ...m,
          powers: {
            ...m.powers,
            [powerKey]: !m.powers[powerKey]
          }
        };
      }
      return m;
    });
    setTeamMembers(updated);
    onUpdateUser({
      ...currentUser,
      teamMembersList: updated
    });
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
    setEditingMemberModal(null);
    setPowerSaveNotify(true);
    setTimeout(() => setPowerSaveNotify(false), 2500);
  };

  const handleAddTeamMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const emailLower = newMemberEmail.trim().toLowerCase();

    const newInv: WorkspaceInvitation = {
      email: emailLower,
      name: newMemberName.trim(),
      role: newMemberRole as any,
      powers: { ...newMemberPowers },
      workspaceId: currentUser.workspaceId || "",
      companyName: currentUser.companyName || "",
      senderId: currentUser.id,
      senderEmail: currentUser.email,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    try {
      await saveWorkspaceInvitation(newInv);
      setInvitations(prev => [...prev.filter(i => i.email !== emailLower), newInv]);

      const newMember: TeamMember = {
        id: `tm-${Date.now()}`,
        name: `${newMemberName.trim()} (${lang === "ar" ? "معلق" : "Pending"})`,
        email: emailLower,
        role: newMemberRole,
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
      setPowerSaveNotify(true);
      setTimeout(() => setPowerSaveNotify(false), 2500);
    } catch (err) {
      console.error("Failed to save invitation:", err);
      alert(lang === "ar" ? "فشل إرسال الدعوة، يرجى المحاولة لاحقاً." : "Failed to send invitation, please try again.");
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
  const handleSaveEncryptionSettings = () => {
    setPasscodeConfirmError("");
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
    onUpdateUser({
      ...currentUser,
      encryptedSecurity: newSecurityObj
    });
    if (onEncryptAllData) {
      onEncryptAllData(pin);
    }
    setPasscodeSaveNotify(true);
    setTimeout(() => setPasscodeSaveNotify(false), 5000);
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
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const newUrl = reader.result;
        setAvatarUrl(newUrl);
        onUpdateUser({
          ...currentUser,
          ownerName: fullName,
          email: email,
          companyName: currentUser.role === "CEO" ? companyName : (currentUser.companyName || ""),
          avatarUrl: newUrl,
          companyLogoUrl: companyLogoUrl
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUpdateUser({
      ...currentUser,
      ownerName: fullName,
      email: email,
      companyName: currentUser.role === "CEO" ? companyName : (currentUser.companyName || ""),
      avatarUrl: undefined,
      companyLogoUrl: companyLogoUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Company Logo Upload Handlers
  const handleCompanyLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const newLogoUrl = reader.result;
        setCompanyLogoUrl(newLogoUrl);
        onUpdateUser({
          ...currentUser,
          ownerName: fullName,
          email: email,
          companyName: currentUser.role === "CEO" ? companyName : (currentUser.companyName || ""),
          avatarUrl: avatarUrl,
          companyLogoUrl: newLogoUrl
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCompanyLogo = () => {
    setCompanyLogoUrl(undefined);
    if (companyLogoInputRef.current) companyLogoInputRef.current.value = "";
    onUpdateUser({
      ...currentUser,
      ownerName: fullName,
      email: email,
      companyName: currentUser.role === "CEO" ? companyName : (currentUser.companyName || ""),
      avatarUrl: avatarUrl,
      companyLogoUrl: undefined
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveAccountProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...currentUser,
      ownerName: fullName,
      email: email,
      companyName: currentUser.role === "CEO" ? companyName : (currentUser.companyName || ""),
      avatarUrl: avatarUrl,
      companyLogoUrl: companyLogoUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Appearance Theme Approval Handler
  const handleApproveThemeChanges = () => {
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

      onUpdateUser({
        ...currentUser,
        customTheme: updatedTheme
      });
    } else {
      // User explicitly selected Standard Light or Dark mode
      setThemeApproved(false);
      setApprovedTimestamp(null);
      setTheme(selectedThemeMode);

      onUpdateUser({
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

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleResetThemeDefaults = () => {
    setPrimaryBg("#0B0F19");
    setTextColor("#F8FAFC");
    setSecondaryColor("#0075DE");
    setThemeApproved(false);
    setApprovedTimestamp(null);
    setSelectedThemeMode("dark");
    setTheme("dark");

    onUpdateUser({
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
  const handleConfirmPayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      const planName = selectedPlanForCheckout || "Professional";
      const planCost = planName === "Enterprise" ? "$899.00 USD" : (planName === "Professional" ? "$299.00 USD" : "$0.00 USD");
      
      let methodLabel = "Visa Card (•••• 8892)";
      if (paymentMethod === "mastercard") methodLabel = "MasterCard (•••• 4321)";
      if (paymentMethod === "bank") methodLabel = `Bank Transfer (${bankName} - ${bankRef})`;
      if (paymentMethod === "wallet") methodLabel = `E-Wallet (${walletProvider} - ${walletPhone})`;

      const receiptData = {
        invoiceNo: `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        plan: `${planName} Plan`,
        amount: planCost,
        method: methodLabel,
        payerName: cardName || fullName,
        payerEmail: email,
        accountRef: currentUser.id
      };

      setCompletedReceipt(receiptData);
      
      // Update user plan in system
      onUpdateUser({
        ...currentUser,
        subscriptionPlan: planName
      });
    }, 1200);
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
                ? "إدارة حسابك الشخصي، تفويض الصلاحيات، تخصيص الهوية البصرية، واشتراكات الأمان الفائق." 
                : "Configure administrative boundaries, assign workspace permissions, adjust themes, and audit billing states."}
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
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-b border-slate-800/40 relative z-10 scrollbar-none">
          {[
            { id: "account", label: lang === "ar" ? "الملف الشخصي" : "Profile Details", icon: UserIcon },
            { id: "appearance", label: lang === "ar" ? "الهوية البصرية والمظهر" : "Visual Theme", icon: Palette },
            { id: "subscription", label: lang === "ar" ? "باقات الدفع والاشتراك" : "Plans & Payment", icon: CreditCard },
            { id: "team", label: lang === "ar" ? "الفريق وإدارة الصلاحيات" : "Workspace Team", icon: Users },
            { id: "security", label: lang === "ar" ? "التشفير والأمان الذاتي" : "Vault Encryption", icon: ShieldCheck },
            { id: "support", label: lang === "ar" ? "الدعم والتوثيق" : "Help & Documentation", icon: HelpCircle },
          ].filter((tab) => {
            if (currentUser.role !== "CEO") {
              return tab.id === "account" || tab.id === "appearance" || tab.id === "support";
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

            {saveSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{lang === "ar" ? "تم تحديث بيانات الحساب والصورة الشخصية بنجاح!" : "Account details and profile photo updated successfully!"}</span>
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
                    className="w-24 h-24 rounded-full object-cover border-2 border-amber-400/80 shadow-xl shadow-amber-500/10 group-hover:opacity-80 transition-opacity" 
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center shadow-xl shadow-amber-500/20 border-2 border-amber-400/80 group-hover:bg-amber-400 transition-colors">
                    {initials}
                  </div>
                )}

                <div className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-amber-400 transition-opacity">
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
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
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
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "الاسم الكامل" : "Full Name"}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-amber-500 ${
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
                  className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-amber-500 ${
                    theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{lang === "ar" ? "اسم الشركة أو المؤسسة" : "Company / Organization Name"}</label>
                <input
                  type="text"
                  value={companyName}
                  disabled={currentUser.role !== "CEO"}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full h-11 px-4 rounded-xl border text-sm font-medium focus:outline-none focus:border-amber-500 ${
                    currentUser.role !== "CEO" ? "opacity-75 cursor-not-allowed select-none bg-slate-200/50 dark:bg-slate-900/50" : ""
                  } ${
                    theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                />
                {currentUser.role !== "CEO" && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    {lang === "ar" 
                      ? "اسم الشركة مدار بالكامل بواسطة الرئيس التنفيذي (CEO) للمؤسسة ولا يمكن تعديله." 
                      : "The company name is managed fully by the CEO and cannot be modified."}
                  </p>
                )}
              </div>

              {/* Dedicated Company Logo Upload Field */}
              <div className={`p-4 rounded-xl border border-dashed ${theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-3`}>
                <label className="block text-xs font-bold text-slate-400">
                  {lang === "ar" ? "شعار الشركة الرسمي" : "Official Company Logo"}
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

                  {currentUser.role === "CEO" && (
                    <div>
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
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{companyLogoUrl ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "رفع شعار الشركة" : "Upload Logo")}</span>
                      </button>
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        {lang === "ar" ? "سيتم سحب الشعار تلقائياً وتثبيته في مستندات الطباعة الرسمية." : "The logo will be pulled automatically and locked in official print records."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === "ar" ? "حفظ التغييرات" : "Save Changes"}</span>
                </button>
              </div>
            </form>

            {/* ACCOUNT VERIFICATION & COMPLIANCE SECTION */}
            <div className={`mt-8 pt-8 border-t ${theme === "dark" ? "border-slate-800" : "border-slate-200"} space-y-4`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
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
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
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
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{lang === "ar" ? "ملاحظات الإدارة بشأن تفعيل الحساب والملفات الناقصة:" : "Admin Feedback & Missing Document Details:"}</span>
                  </div>
                  <p className="text-xs text-slate-200 pl-6 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-amber-500/20 mt-1">
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
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
                          className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="font-bold text-slate-200 truncate">{doc.fileName}</span>
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

      {/* SUB-TAB 2: APPEARANCE & CUSTOM COLOR THEME */}
      {currentTab === "appearance" && (
        <div className={`p-6 rounded-2xl border space-y-8 ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className={`text-xl font-bold flex items-center gap-2.5 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                <Palette className="w-5 h-5 text-amber-500" />
                <span>{lang === "ar" ? "تخصيص المظهر وتغيير الألوان" : "Visual Theme & Custom Color Palette"}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "ar" 
                  ? "اختر الوضع المناسب لمظهرك أو صمم لوحة الألوان الخاصة بهوية علامتك التجارية لتطبيقها تلقائياً على كامل النظام" 
                  : "Choose standard visual modes or customize background, typography, and accent colors for your brand."}
              </p>
            </div>

            {/* CRUCIAL APPROVE CHANGES BUTTON */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetThemeDefaults}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {lang === "ar" ? "إعادة الضبط الافتراضي" : "Reset Defaults"}
              </button>

              <button
                type="button"
                onClick={handleApproveThemeChanges}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-xl shadow-amber-500/20 flex items-center gap-2.5 transition-all transform hover:scale-105 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{lang === "ar" ? "تأكيد وتطبيق التغييرات" : "Approve & Apply Changes"}</span>
              </button>
            </div>
          </div>

          {/* 1. SELECT PRIMARY SYSTEM THEME MODE (Sun/Moon/Palette Cards) */}
          <div className="space-y-3.5">
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>{lang === "ar" ? "اختر نمط المظهر العام للواجهة" : "Select Global Appearance Mode"}</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card A: Default Light Mode */}
              <button
                type="button"
                onClick={() => handleSelectStandardTheme("light")}
                className={`p-4.5 rounded-2xl border text-right sm:text-left flex items-start gap-4 transition-all cursor-pointer ${
                  selectedThemeMode === "light"
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5 scale-[1.01]"
                    : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700"
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedThemeMode === "light" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm font-extrabold text-slate-200">
                      {lang === "ar" ? "الوضع الفاتح الافتراضي" : "Default Light Mode"}
                    </span>
                    {selectedThemeMode === "light" && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] uppercase font-bold rounded">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {lang === "ar" 
                      ? "واجهة بيضاء مريحة وعالية التباين للعمل المكتبي والنهاري" 
                      : "Clean, high-contrast light interface optimized for daytime productivity."}
                  </p>
                </div>
              </button>

              {/* Card B: Default Dark Mode */}
              <button
                type="button"
                onClick={() => handleSelectStandardTheme("dark")}
                className={`p-4.5 rounded-2xl border text-right sm:text-left flex items-start gap-4 transition-all cursor-pointer ${
                  selectedThemeMode === "dark"
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5 scale-[1.01]"
                    : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700"
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedThemeMode === "dark" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Moon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm font-extrabold text-slate-200">
                      {lang === "ar" ? "الوضع الداكن الافتراضي" : "Default Dark Mode"}
                    </span>
                    {selectedThemeMode === "dark" && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] uppercase font-bold rounded">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {lang === "ar" 
                      ? "واجهة مظلمة بريميوم مريحة للعين في البيئات منخفضة الإضاءة" 
                      : "Premium eye-safe dark interface designed for low-light environments."}
                  </p>
                </div>
              </button>

              {/* Card C: Custom Corporate Theme */}
              <button
                type="button"
                onClick={handleSelectCustomTheme}
                className={`p-4.5 rounded-2xl border text-right sm:text-left flex items-start gap-4 transition-all cursor-pointer ${
                  selectedThemeMode === "custom"
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5 scale-[1.01]"
                    : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700"
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedThemeMode === "custom" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  <Palette className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm font-extrabold text-slate-200">
                      {lang === "ar" ? "مظهر مخصص بألوان الهوية" : "Custom Corporate Theme"}
                    </span>
                    {selectedThemeMode === "custom" && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] uppercase font-bold rounded animate-bounce">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {lang === "ar" 
                      ? "قم بتفعيل لوحة الألوان المخصصة الخاصة بك تلقائياً على كامل النظام" 
                      : "Activate your custom tailored corporate colors seamlessly across all views."}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {themeApproved && approvedTimestamp && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  {lang === "ar" 
                    ? `تم اعتماد وتطبيق تغييرات الألوان بنجاح على النظام بتاريخ: ${approvedTimestamp}`
                    : `Theme modifications approved & applied to full application on: ${approvedTimestamp}`}
                </span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] uppercase font-mono tracking-wider">
                Approved & Active
              </span>
            </div>
          )}

          {/* 2. CHOOSE THEME PRESET PALETTES */}
          <div className="space-y-3 pb-2 border-t border-slate-800/40 pt-6">
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{lang === "ar" ? "قوالب ألوان جاهزة منسقة احترافياً" : "Professionally Curated Theme Presets"}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {lang === "ar"
                ? "انقر فوق أي قالب لتجربته ومعاينته في بطاقة المعاينة التفاعلية، ثم انقر تطبيق الألوان"
                : "Click any template to try and preview it in the interactive card, then click apply to save."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                {
                  id: "zakir-gold",
                  nameAr: "ذهبي Zakir الفاخر",
                  nameEn: "Zakir Premium Gold",
                  primaryBg: "#0B0F19",
                  textColor: "#F8FAFC",
                  secondaryColor: "#0075DE"
                },
                {
                  id: "minimal-business",
                  nameAr: "الأعمال الهادئ",
                  nameEn: "Minimalist Light",
                  primaryBg: "#F8FAFC",
                  textColor: "#0F172A",
                  secondaryColor: "#3B82F6"
                },
                {
                  id: "emerald-obsidian",
                  nameAr: "الزمرد الليلي",
                  nameEn: "Emerald Midnight",
                  primaryBg: "#022C22",
                  textColor: "#ECFDF5",
                  secondaryColor: "#10B981"
                },
                {
                  id: "royal-cyan",
                  nameAr: "الأزرق السياني",
                  nameEn: "Cyber Royal Cyan",
                  primaryBg: "#030712",
                  textColor: "#F3F4F6",
                  secondaryColor: "#06B6D4"
                },
                {
                  id: "soft-lavender",
                  nameAr: "اللافندر الدافئ",
                  nameEn: "Soft Lavender Light",
                  primaryBg: "#FAF5FF",
                  textColor: "#3B0764",
                  secondaryColor: "#A855F7"
                },
                {
                  id: "rose-velvet",
                  nameAr: "المخمل العنابي",
                  nameEn: "Luxury Rose Velvet",
                  primaryBg: "#1A0505",
                  textColor: "#FFF5F5",
                  secondaryColor: "#F43F5E"
                }
              ].map((preset) => {
                const isSelected = primaryBg === preset.primaryBg && textColor === preset.textColor && secondaryColor === preset.secondaryColor;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setPrimaryBg(preset.primaryBg);
                      setTextColor(preset.textColor);
                      setSecondaryColor(preset.secondaryColor);
                    }}
                    className={`p-3 rounded-xl border text-right sm:text-left transition-all cursor-pointer relative group flex flex-col gap-2 ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/5 scale-[1.02]"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-black truncate max-w-[90px] text-slate-300 leading-tight">
                        {lang === "ar" ? preset.nameAr : preset.nameEn}
                      </span>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-md shadow-amber-500" />
                      )}
                    </div>
                    {/* Visual bar previewing colors */}
                    <div className="flex gap-1 h-3 w-full rounded overflow-hidden mt-1 border border-slate-800">
                      <div className="w-1/2" style={{ backgroundColor: preset.primaryBg }} title="Background" />
                      <div className="w-1/4" style={{ backgroundColor: preset.textColor }} title="Text" />
                      <div className="w-1/4" style={{ backgroundColor: preset.secondaryColor }} title="Accent" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Customizer Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-800/40">
            
            {/* 1. BASIC / PRIMARY COLOR (Background) */}
            <div className={`p-5 rounded-2xl border space-y-4 ${theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: primaryBg }} />
                  <span>{lang === "ar" ? "اللون الأساسي (الخلفية)" : "Basic Color (Background)"}</span>
                </label>
                <span className="text-xs font-mono text-slate-400">{primaryBg}</span>
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={primaryBg} 
                  onChange={(e) => setPrimaryBg(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input 
                  type="text" 
                  value={primaryBg} 
                  onChange={(e) => setPrimaryBg(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-mono ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              {/* Presets for Primary Color */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-bold">{lang === "ar" ? "نماذج سريعة للخلفية:" : "Background Presets:"}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Deep Navy", hex: "#0B0F19" },
                    { name: "Slate Obsidian", hex: "#020617" },
                    { name: "Emerald Midnight", hex: "#042F2E" },
                    { name: "Crimson Velvet", hex: "#450A0A" },
                    { name: "Amethyst Dark", hex: "#2E1065" },
                    { name: "Soft Light", hex: "#F8FAFC" },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setPrimaryBg(preset.hex)}
                      className="w-7 h-7 rounded-lg border border-white/20 hover:scale-110 transition-transform relative cursor-pointer"
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                    >
                      {primaryBg === preset.hex && <Check className="w-3 h-3 text-white absolute inset-0 m-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. FONT COLOR (Text) */}
            <div className={`p-5 rounded-2xl border space-y-4 ${theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: textColor }} />
                  <span>{lang === "ar" ? "لون الخط والترويسات" : "Font Color (Typography)"}</span>
                </label>
                <span className="text-xs font-mono text-slate-400">{textColor}</span>
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={textColor} 
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input 
                  type="text" 
                  value={textColor} 
                  onChange={(e) => setTextColor(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-mono ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              {/* Presets for Font Color */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-bold">{lang === "ar" ? "نماذج ألوان الخط:" : "Font Color Presets:"}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Crisp White", hex: "#FFFFFF" },
                    { name: "Platinum Slate", hex: "#F8FAFC" },
                    { name: "Amber Cream", hex: "#FEF3C7" },
                    { name: "Golden Light", hex: "#FDE047" },
                    { name: "Onyx Dark", hex: "#0F172A" },
                    { name: "Charcoal", hex: "#1E293B" },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setTextColor(preset.hex)}
                      className="w-7 h-7 rounded-lg border border-white/20 hover:scale-110 transition-transform relative cursor-pointer"
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                    >
                      {textColor === preset.hex && <Check className="w-3 h-3 text-slate-950 absolute inset-0 m-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. SECONDARY COLOR (Shapes, Icons, Accents, Buttons) */}
            <div className={`p-5 rounded-2xl border space-y-4 ${theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: secondaryColor }} />
                  <span>{lang === "ar" ? "اللون الثانوي (الأزرار، الأشكال والأيقونات)" : "Secondary Color (Icons & Shapes)"}</span>
                </label>
                <span className="text-xs font-mono text-slate-400">{secondaryColor}</span>
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={secondaryColor} 
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input 
                  type="text" 
                  value={secondaryColor} 
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-mono ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              {/* Presets for Secondary Accent Color */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-bold">{lang === "ar" ? "نماذج الأزرار والأيقونات:" : "Secondary Presets:"}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Royal Gold", hex: "#0075DE" },
                    { name: "Emerald Green", hex: "#10B981" },
                    { name: "Neon Cyan", hex: "#06B6D4" },
                    { name: "Electric Indigo", hex: "#6366F1" },
                    { name: "Sunset Amber", hex: "#F59E0B" },
                    { name: "Crimson Rose", hex: "#F43F5E" },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setSecondaryColor(preset.hex)}
                      className="w-7 h-7 rounded-lg border border-white/20 hover:scale-110 transition-transform relative cursor-pointer"
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                    >
                      {secondaryColor === preset.hex && <Check className="w-3 h-3 text-slate-950 absolute inset-0 m-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Real-time Visual Theme Preview Card */}
          <div className="p-6 rounded-2xl border space-y-4 transition-all" style={{ backgroundColor: primaryBg, color: textColor, borderColor: secondaryColor + "40" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border text-xs" style={{ backgroundColor: secondaryColor + "20", borderColor: secondaryColor, color: secondaryColor }}>
                {lang === "ar" ? "معاينة حية للمظهر" : "Live Visual Preview"}
              </span>
              <span className="text-xs opacity-70">
                {lang === "ar" ? "هكذا سيبدو نظامك عند الموافقة والتطبيق" : "Sample preview of selected custom theme palette"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: secondaryColor + "30" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950" style={{ backgroundColor: secondaryColor }}>
                    <Sparkles className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm" style={{ color: textColor }}>ZAKIR Dashboard</h4>
                    <p className="text-xs opacity-60">Institutional Knowledge Core</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed opacity-80">
                  {lang === "ar" 
                    ? "تتغير خلفيات التطبيق والنصوص والأزرار والأيقونات فور نقرك على زر تأكيد وتطبيق التغييرات." 
                    : "Primary background, font typography, and secondary shapes & buttons adapt instantly across the workspace."}
                </p>
              </div>

              <div className="p-4 rounded-xl border space-y-3 flex flex-col justify-between" style={{ borderColor: secondaryColor + "30" }}>
                <span className="text-xs font-bold" style={{ color: secondaryColor }}>
                  {lang === "ar" ? "نموذج الأزرار والأشكال:" : "Button & Shape Styling:"}
                </span>
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 shadow-md" 
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Primary Action
                  </button>
                  <button 
                    type="button" 
                    className="px-4 py-2 rounded-xl text-xs font-bold border" 
                    style={{ borderColor: secondaryColor, color: secondaryColor }}
                  >
                    Secondary Action
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 3: SUBSCRIPTION PLANS, PAYMENT CHANNELS & RECEIPT */}
      {currentTab === "subscription" && (
        <div className="space-y-8">
          <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
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
            <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">{lang === "ar" ? "الخطة الحالية للمستخدم:" : "Current User Active Plan:"}</p>
                  <p className="text-base font-extrabold text-amber-400">
                    {currentUser.subscriptionPlan || "Professional"} Plan
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                {lang === "ar" ? "نشط ومفعل" : "Active & Verified"}
              </span>
            </div>

            {/* Monthly / Annual Toggle with 20% Discount Badge */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === "annual"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {translations[lang as keyof typeof translations]?.billingAnnual || (lang === "ar" ? "الفوترة السنوية" : "Annual Billing")}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === "monthly"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {translations[lang as keyof typeof translations]?.billingMonthly || (lang === "ar" ? "الفوترة الشهرية" : "Monthly Billing")}
                </button>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold text-xs flex items-center gap-1.5">
                🔥 {translations[lang as keyof typeof translations]?.save20Percent || (lang === "ar" ? "وفّر 20% عند الاشتراك السنوي" : "Save 20% on Annual Billing")}
              </span>
            </div>

            {/* Current Active Plan Badge & Stripe Customer Portal Link */}
            <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">{lang === "ar" ? "الخطة الحالية للمستخدم:" : "Current Active User Plan:"}</p>
                  <p className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                    <span>{currentUser.subscriptionPlan ? `${currentUser.subscriptionPlan} Plan` : (lang === "ar" ? "لم يتم اختيار خطة بعد" : "No Active Plan Selected")}</span>
                    {currentUser.subscriptionPlan && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-amber-500/30 text-slate-300 font-normal">
                        ({billingCycle === "annual" ? (lang === "ar" ? "سنوي" : "Annual") : (lang === "ar" ? "شهري" : "Monthly")})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {currentUser.stripeCustomerId && (
                  <button
                    type="button"
                    onClick={handleOpenStripePortal}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>{translations[lang as keyof typeof translations]?.stripePortal || (lang === "ar" ? "إدارة الاشتراك في Stripe" : "Stripe Portal")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {currentUser.subscriptionPlan ? (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                    {lang === "ar" ? "نشط ومفعل" : "Active & Verified"}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                    {lang === "ar" ? "في انتظار تفعيل خطة" : "Pending Selection"}
                  </span>
                )}
              </div>
            </div>

            {/* Plans Grid with Benchmark Prices */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* PLAN 1: STARTER ($50 Annual / $6 Monthly) */}
              <div className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 ${
                theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Starter</h3>
                    <p className="text-xs text-slate-400 mt-1">{translations[lang as keyof typeof translations]?.planStarterDesc || (lang === "ar" ? "خطة استكشافية للمؤسسات والفرق ($50 سنوياً أو $6 شهرياً)" : "Exploration tier for teams ($50/year or $6/month)")}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                      ${billingCycle === "annual" ? "50" : "6"}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {billingCycle === "annual" ? (lang === "ar" ? "سنوياً" : "yr") : (lang === "ar" ? "شهرياً" : "mo")}
                      {billingCycle === "annual" && <span className="text-[10px] text-amber-400 font-semibold ml-1">({lang === "ar" ? "تُدفع $50 سنوياً" : "billed $50 annually"})</span>}
                    </span>
                  </div>
                  <ul className="space-y-2.5 pt-4 text-xs text-slate-300 border-t border-slate-800">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {lang === "ar" ? "دعوة الأعضاء وصلاحيات متعددة (RBAC)" : "Multi-user seat access & RBAC"}</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {lang === "ar" ? "إدارة الملفات الكاملة والإعدادات" : "Full File & Settings Management"}</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {lang === "ar" ? "بحث وتحليل سببي للذكريات" : "Causal Memory Search & Analysis"}</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleStripeCheckout("Starter")}
                  disabled={currentUser.subscriptionPlan === "Starter"}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    currentUser.subscriptionPlan === "Starter"
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  }`}
                >
                  {currentUser.subscriptionPlan === "Starter"
                    ? (lang === "ar" ? "الخطة المفعلة حالياً" : "Current Plan")
                    : (lang === "ar" ? "الاشتراك بخطة Starter - Stripe" : "Subscribe Starter - Stripe Checkout")}
                </button>
              </div>

              {/* PLAN 2: PROFESSIONAL ($149 Annual / $189 Monthly) */}
              <div className="p-6 rounded-2xl border-2 border-amber-500 bg-slate-950 shadow-2xl shadow-amber-500/10 flex flex-col justify-between space-y-6 relative transform md:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg">
                  {lang === "ar" ? "الخطة الأكثر شعبية" : "Most Popular"}
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Professional <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{translations[lang as keyof typeof translations]?.planProDesc || (lang === "ar" ? "للمؤسسات والشركات النامية" : "For growing organizations")}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-amber-400">
                      ${billingCycle === "annual" ? "149" : "189"}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {lang === "ar" ? "شهرياً" : "mo"} {billingCycle === "annual" && <span className="text-[10px] text-amber-400 font-semibold">({lang === "ar" ? "تُدفع سنوياً - توفير 20%" : "billed annually"})</span>}
                    </span>
                  </div>
                  <ul className="space-y-2.5 pt-4 text-xs text-slate-200 border-t border-slate-800">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Unlimited Memories & Vault</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Full Causal AI Graph Analysis</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Automated Risk Alerts & Notifications</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Multi-user seat access & RBAC</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Priority 24/7 Dedicated Support</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleStripeCheckout("Professional")}
                  disabled={isProcessingPayment}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <span>{translations[lang as keyof typeof translations]?.subscribePayNow || (lang === "ar" ? "الاشتراك بالخطة الاحترافية - Stripe" : "Subscribe Professional - Stripe Checkout")}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* PLAN 3: ENTERPRISE ($699 Annual / $849 Monthly) */}
              <div className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 ${
                theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Enterprise</h3>
                    <p className="text-xs text-slate-400 mt-1">{translations[lang as keyof typeof translations]?.planEnterpriseDesc || (lang === "ar" ? "للمؤسسات الكبرى والهيئات السيادية" : "For large conglomerates & sovereign entities")}</p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                        ${billingCycle === "annual" ? "699" : "849"}
                      </span>
                      <span className="text-xs text-slate-400">/ {lang === "ar" ? "شهرياً" : "mo"}</span>
                    </div>
                    <p className="text-[11px] text-amber-500 font-semibold mt-1">
                      {translations[lang as keyof typeof translations]?.startingFrom || (lang === "ar" ? "تبدأ من $699/شهرياً" : "Starting from $699/mo")}
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-4 text-xs text-slate-300 border-t border-slate-800">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Dedicated Firebase / Cloud SQL Instance</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> 99.99% Guaranteed SLA Uptime</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> SOC2 & GDPR Compliance Framework</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Invoicing & Direct Contract Billing</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleStripeCheckout("Enterprise")}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{translations[lang as keyof typeof translations]?.upgradeEnterprise || (lang === "ar" ? "الاشتراك بخطة المؤسسات (Stripe Checkout)" : "Subscribe Enterprise (Stripe Checkout)")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="mailto:mohamedvadel60@gmail.com?subject=Zakir%20Enterprise%20Plan%20Inquiry"
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-center font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all block cursor-pointer"
                  >
                    <span>{translations[lang as keyof typeof translations]?.contactSales || (lang === "ar" ? "تواصل مع المبيعات" : "Contact Sales")}</span>
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT & PAYMENT MODAL WITH 4 PAYMENT METHODS & RECEIPT */}
      {selectedPlanForCheckout && (
        <div className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto ${completedReceipt ? "printable-receipt-modal" : ""}`}>
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 md:p-8 space-y-6 ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            
            {!completedReceipt ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      <span>{lang === "ar" ? "بوابة الدفع والتسديد الإلكتروني" : "Checkout & Secure Payment Gateway"}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {lang === "ar" 
                        ? `الاشتراك بخطة ${selectedPlanForCheckout}` 
                        : `Subscribing to ${selectedPlanForCheckout} Plan`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlanForCheckout(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* 4 Supported Payment Methods Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    {lang === "ar" ? "اختر وسيلة الدفع المناسبة:" : "Select Payment Channel:"}
                  </label>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: "visa", label: "Visa Card", icon: CreditCard, badge: "Visa" },
                      { id: "mastercard", label: "MasterCard", icon: CreditCard, badge: "MasterCard" },
                      { id: "bank", label: lang === "ar" ? "حساب بنكي" : "Bank Transfer", icon: Landmark, badge: "IBAN" },
                      { id: "wallet", label: lang === "ar" ? "محفظة إلكترونية" : "E-Wallet", icon: Smartphone, badge: "Bankily/Masrvi" },
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-3.5 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/15 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className={`w-5 h-5 ${isSelected ? "text-amber-400" : "text-slate-400"}`} />
                            {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{method.label}</p>
                            <p className="text-[10px] opacity-70">{method.badge}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Form Fields Depending on Method */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/50 space-y-4">
                  {(paymentMethod === "visa" || paymentMethod === "mastercard") && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "اسم صاحب البطاقة" : "Cardholder Name"}</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-medium focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "رقم البطاقة (16 رقم)" : "Card Number (16 Digits)"}</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "تاريخ انتهاء الصلاحية" : "Expiry Date"}</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">CVC / CVV</label>
                          <input
                            type="password"
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            maxLength={4}
                            className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "bank" && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                        <p className="font-bold mb-1">{lang === "ar" ? "تفاصيل الحساب البنكي المعتمد للمؤسسة:" : "Corporate Verified Bank Account Details:"}</p>
                        <p>Bank: Attijari Bank / BCM Mauritanie</p>
                        <p>IBAN: MR13 0001 0200 9821 0041 88</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "اسم البنك المحول منه" : "Sender Bank Name"}</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-medium focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "رقم المرجع / الإيصال البنكي" : "Bank Transfer Receipt Ref"}</label>
                        <input
                          type="text"
                          value={bankRef}
                          onChange={(e) => setBankRef(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === "wallet" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "مزود المحفظة الإلكترونية" : "E-Wallet Provider"}</label>
                        <select
                          value={walletProvider}
                          onChange={(e) => setWalletProvider(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-medium focus:border-amber-500 focus:outline-none"
                        >
                          <option value="Bankily">Bankily (بنكيلي)</option>
                          <option value="Masrvi">Masrvi (مصرفي)</option>
                          <option value="Sedad">Sedad (سداد)</option>
                          <option value="Click">Click (كليك)</option>
                          <option value="ApplePay">Apple Pay / Google Pay</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "رقم الهاتف / معرّف المحفظة" : "Wallet Phone Number / ID"}</label>
                        <input
                          type="text"
                          value={walletPhone}
                          onChange={(e) => setWalletPhone(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Payment Action */}
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={handleConfirmPayment}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isProcessingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{lang === "ar" ? "جاري الاتصال ببنك التخصيص والتحقق..." : "Connecting & Verifying Payment..."}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>
                        {lang === "ar" 
                          ? `تأكيد وسداد مبلغ ${selectedPlanForCheckout === "Enterprise" ? "$899.00" : "$299.00"}` 
                          : `Confirm & Pay ${selectedPlanForCheckout === "Enterprise" ? "$899.00 USD" : "$299.00 USD"}`}
                      </span>
                    </>
                  )}
                </button>
              </>
            ) : (
              /* PAYMENT CONFIRMATION RECEIPT / INVOICE DISPLAY */
              <div className="space-y-6 text-slate-900 dark:text-white">
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
                      <p className="font-bold text-amber-400">{completedReceipt.plan}</p>
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
                    className="flex-1 min-w-[120px] py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
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
                  <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
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
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto"
              >
                <Key className="w-4 h-4 text-amber-400" />
                <span>{lang === "ar" ? "اختبار الرمز السري وإلغاء القفل" : "Test Secret Code Unlock"}</span>
              </button>
            </div>

            {/* CEO Authorization Matrix Table */}
            <div className="pt-4 border-t border-slate-800/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>{lang === "ar" ? "مصفوفة صلاحيات الأعضاء (المعينة من طرف CEO):" : "Member Power Authorization Matrix (Designated by CEO):"}</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {lang === "ar" ? "انقر على الخانات للتعديل المباشر" : "Click checkboxes to toggle powers directly"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4 font-bold">{lang === "ar" ? "عضو الفريق" : "Team Member"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "الدور" : "Designated Role"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "📁 إدارة الملفات" : "File Vault"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "🧠 مكتبة الذكريات" : "Memory Vault"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "⚠️ رادار المخاطر" : "Risk Radar"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "📊 استخبارات السوق" : "Market Intel"}</th>
                      <th className="py-3 px-3 font-bold text-center">{lang === "ar" ? "⚙️ إعدادات النظام" : "System Settings"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{member.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{member.email}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            member.role.includes("CEO") 
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                              : "bg-slate-800 text-slate-300"
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
                              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500"
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
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              {lang === "ar" ? "قائمة الأعضاء وإعدادات الوصول الفردية:" : "Active Team Seat Grants & Individual CEO Powers:"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 font-extrabold text-sm flex items-center justify-center border border-amber-500/30">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{member.name}</span>
                          {member.role.includes("CEO") && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">Owner</span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">{member.email}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-mono">
                      {member.role}
                    </span>
                  </div>

                  {/* Powers Badges */}
                  <div className="space-y-2 pt-3 border-t border-slate-800/80">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                : "bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60"
                            }`}
                          >
                            {isGranted ? <Check className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-slate-500" />}
                            <span>{p.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEditingMemberModal(member)}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تعديل صلاحيات العضو" : "Configure Member Powers"}</span>
                    </button>

                    {!member.role.includes("CEO") && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTeamMember(member.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
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
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>{lang === "ar" ? "إضافة عضو جديد وتخصيص صلاحياته:" : "Provision New Team Member with Custom Powers:"}</span>
            </h3>

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
                    className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs focus:border-amber-500 focus:outline-none"
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
                    className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{lang === "ar" ? "الدور الوظيفي" : "Designated Role"}</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-xs focus:border-amber-500 focus:outline-none"
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
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <p className="text-xs font-bold text-amber-400">
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
                    <label key={p.key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!newMemberPowers[p.key as keyof ModulePermissions]}
                        onChange={(e) => setNewMemberPowers({
                          ...newMemberPowers,
                          [p.key]: e.target.checked
                        })}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === "ar" ? "دعوة العضو وتخصيص الصلاحيات" : "Invite Member & Grant CEO Powers"}</span>
              </button>
            </form>
          </div>

        </div>
      )}

      {/* SUB-TAB 5: SECURITY & ENCRYPTION PASSCODE CONTROL (CEO ENCRYPTION FOR SENSITIVE MODULES) */}
      {currentTab === "security" && (
        <div className="space-y-8">

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
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit mb-2">
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
            <div className="p-6 rounded-2xl border border-amber-500/30 bg-slate-950/80 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {lang === "ar" ? "الرمز السري المعتمد للتشفير (Master Encryption PIN):" : "Master Encryption Security Code / PIN:"}
                    </h3>
                    <p className="text-[11px] text-slate-400">
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
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                      {lang === "ar" ? "1. أدخل الرمز السري الجديد:" : "1. Enter Secret Code / Passcode:"}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretPasscode ? "text" : "password"}
                        value={secretPasscodeVal}
                        onChange={(e) => setSecretPasscodeVal(e.target.value)}
                        placeholder={lang === "ar" ? "أدخل الرمز السري الخاص (مثلاً: 1234)" : "Enter secret passcode (e.g. 1234)"}
                        className="w-full h-11 pl-3 pr-10 bg-slate-900 border border-slate-800 text-amber-400 font-mono text-sm rounded-xl focus:border-amber-500 focus:outline-none tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretPasscode(!showSecretPasscode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showSecretPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                      {lang === "ar" ? "2. إعـادة التأكـد مـن الـرمـز السـري:" : "2. Re-check & Confirm Secret Code:"}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretPasscode ? "text" : "password"}
                        value={secretPasscodeConfirmVal}
                        onChange={(e) => setSecretPasscodeConfirmVal(e.target.value)}
                        placeholder={lang === "ar" ? "أدخل نفس الرمز للتأكيد" : "Confirm secret passcode"}
                        className="w-full h-11 pl-3 pr-10 bg-slate-900 border border-slate-800 text-amber-400 font-mono text-sm rounded-xl focus:border-amber-500 focus:outline-none tracking-widest"
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
                    className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>{lang === "ar" ? "تأكيد الرمز والتشفير التلقائي" : "Confirm Code & Auto-Encrypt All Data"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestUnlockModalOpen(true);
                      setTestEnteredPin("");
                      setTestUnlockStatus(null);
                    }}
                    className="px-5 h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Unlock className="w-4 h-4 text-amber-400" />
                    <span>{lang === "ar" ? "اختبار فك القفل" : "Test Unlock"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Encrypted Modules Selection Grid */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>{lang === "ar" ? "تحديد الأقسام القابلة للتشفير والإغلاق بالرمز السري:" : "Select Modules to Encrypt & Lock with Secret Code:"}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. FILE MANAGEMENT VAULT LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.fileVault 
                    ? "bg-amber-500/10 border-amber-500/40" 
                    : "bg-slate-950/60 border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.fileVault ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{lang === "ar" ? "تشفير إدارة الملفات (File Vault)" : "Encrypted File Management"}</span>
                        {encryptedSecurity.lockedModules.fileVault && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {lang === "ar" ? "يتطلب إدخال الرمز السري لعرض وتحميل المستندات" : "Requires secret passcode to view and download files"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("fileVault")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.fileVault ? "bg-amber-500" : "bg-slate-800"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                      encryptedSecurity.lockedModules.fileVault ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 2. MEMORY LIBRARY VAULT LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.memoryVault 
                    ? "bg-amber-500/10 border-amber-500/40" 
                    : "bg-slate-950/60 border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.memoryVault ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{lang === "ar" ? "تشفير مكتبة الذكريات (Memory Vault)" : "Encrypted Memory Vault"}</span>
                        {encryptedSecurity.lockedModules.memoryVault && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {lang === "ar" ? "حماية الذكريات والقرارات الاستراتيجية بالرمز السري" : "Locks institutional memories & causal factors behind PIN"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("memoryVault")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.memoryVault ? "bg-amber-500" : "bg-slate-800"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                      encryptedSecurity.lockedModules.memoryVault ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 3. RISK RADAR & SENSITIVE ALERTS LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.riskRadar 
                    ? "bg-amber-500/10 border-amber-500/40" 
                    : "bg-slate-950/60 border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.riskRadar ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{lang === "ar" ? "تشفير رادار المخاطر والمعلومات الحساسة" : "Encrypted Risk Radar & Alerts"}</span>
                        {encryptedSecurity.lockedModules.riskRadar && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {lang === "ar" ? "إغلاق سجل المخاطر الحرجة والتقارير المالية الحساسة" : "Encrypts high-risk warnings & internal audit data"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("riskRadar")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.riskRadar ? "bg-amber-500" : "bg-slate-800"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                      encryptedSecurity.lockedModules.riskRadar ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* 4. SYSTEM SETTINGS LOCK */}
                <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${
                  encryptedSecurity.lockedModules.settings 
                    ? "bg-amber-500/10 border-amber-500/40" 
                    : "bg-slate-950/60 border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      encryptedSecurity.lockedModules.settings ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{lang === "ar" ? "تشفير إعدادات لوحة التحكم" : "Encrypted System Settings"}</span>
                        {encryptedSecurity.lockedModules.settings && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">LOCKED</span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {lang === "ar" ? "قفل تعديلات المظهر والاشتراك وصلاحيات الفريق بالرمز السري" : "Locks admin controls & billing updates with secret code"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleModuleLock("settings")}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      encryptedSecurity.lockedModules.settings ? "bg-amber-500" : "bg-slate-800"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                      encryptedSecurity.lockedModules.settings ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>

              </div>
            </div>

            {/* SYSTEM BACKUP EXPORT SECTION */}
            <div className="pt-6 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{lang === "ar" ? "تصدير نسخ احتياطية مشفرة (JSON)" : "Export Encrypted Full Memory Vault Backup (JSON)"}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{lang === "ar" ? "تحميل سجل الذكريات والتنبيهات المعتمدة" : "Download encrypted snapshot of institutional memories and permissions"}</p>
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
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
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
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>{lang === "ar" ? `تخصيص صلاحيات العضو: ${editingMemberModal.name}` : `CEO Power Grants: ${editingMemberModal.name}`}</span>
                </h3>
                <p className="text-xs text-slate-400">{editingMemberModal.email} ({editingMemberModal.role})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMemberModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {lang === "ar" ? "الأقسام المتاحة للعضو:" : "Module Access Powers Granted by CEO:"}
              </p>

              {[
                { key: "fileVault", title: lang === "ar" ? "إدارة الملفات (File Vault)" : "File Vault Access", desc: lang === "ar" ? "رفع واستعراض وتنزيل المستندات" : "Upload, view, and download files" },
                { key: "memoryVault", title: lang === "ar" ? "مكتبة الذكريات (Memory Vault)" : "Memory Vault Access", desc: lang === "ar" ? "تسجيل واستعراض الذكريات والقرارات" : "Log, view, and query institutional memories" },
                { key: "riskRadar", title: lang === "ar" ? "رادار المخاطر والتنبيهات" : "Risk Radar & Alerts", desc: lang === "ar" ? "استعراض ومتابعة التنبيهات الحساسة" : "Review high-level risk warnings & audits" },
                { key: "marketIntel", title: lang === "ar" ? "استخبارات السوق والتحليلات" : "Market Intelligence", desc: lang === "ar" ? "إنشاء تقارير الذكاء الاصطناعي للسوق" : "Generate AI intelligence forecasts" },
                { key: "settings", title: lang === "ar" ? "إعدادات النظام والتحكم" : "System Settings Access", desc: lang === "ar" ? "إدارة المظهر والدفع وإرشادات الفريق" : "Modify workspace configuration" },
              ].map((p) => {
                const isChecked = !!editingMemberModal.powers[p.key as keyof ModulePermissions];
                return (
                  <div key={p.key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{p.title}</p>
                      <p className="text-[10px] text-slate-400">{p.desc}</p>
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
                      className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingMemberModal(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleSaveMemberModalPowers}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/60">
              <div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit mb-2">
                  <HelpCircle className="w-3.5 h-3.5" />
                  {lang === "ar" ? "خدمة العملاء والدعم الفني" : "Customer Support Center"}
                </span>
                <h2 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "الدعم والتعليمات" : "Help & Support"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
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
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {lang === "ar" ? "اختبار الرمز السري لفك التشفير" : "Test Secret Code Decryption Unlock"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestUnlockModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
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
                  className="w-full h-11 px-3 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-center text-lg tracking-widest rounded-xl focus:border-amber-500 focus:outline-none"
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
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>

              <button
                type="button"
                onClick={handleVerifyTestPasscode}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
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
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">
                  {lang === "ar" ? "تأكيد فك التشفير وإلغاء القفل" : "Confirm Passcode to Cancel Lock"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelLockModuleTarget(null);
                  setCancelLockError("");
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
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
                  className="w-full h-11 px-3 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-center text-lg tracking-widest rounded-xl focus:border-amber-500 focus:outline-none"
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
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                {lang === "ar" ? "إلغاء الأمر" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleConfirmCancelLock}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Unlock className="w-4 h-4" />
                <span>{lang === "ar" ? "تأكيد وإلغاء القفل" : "Verify & Unlock"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
