import React, { useState, useEffect } from "react";
import { 
  RotateCcw, 
  ShieldCheck, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Mail, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { sendAccountRecoveryOtpApi, restoreAccountApi, loginWithCustomToken } from "../lib/firebaseServices.js";
import { User } from "../types.js";

interface DeletedAccountRecoveryProps {
  email: string;
  daysRemaining?: number;
  restoreUntil?: string | null;
  isExpired?: boolean;
  lang: "ar" | "en" | "fr";
  theme?: "light" | "dark" | "custom";
  onCancel: () => void;
  onRestored: (user: User, customToken?: string) => void;
}

export const DeletedAccountRecovery: React.FC<DeletedAccountRecoveryProps> = ({
  email,
  daysRemaining = 31,
  restoreUntil = null,
  isExpired = false,
  lang,
  theme = "light",
  onCancel,
  onRestored
}) => {
  const isRtl = lang === "ar";

  // Calculate dynamic days remaining if restoreUntil is provided
  const computedDaysRemaining = React.useMemo(() => {
    if (restoreUntil) {
      const remainingMs = new Date(restoreUntil).getTime() - Date.now();
      if (remainingMs <= 0) return 0;
      return Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1000)));
    }
    return Math.max(0, daysRemaining);
  }, [restoreUntil, daysRemaining]);

  const effectiveExpired = isExpired || computedDaysRemaining <= 0;

  // Flow steps: "initial" | "verify_otp" | "success"
  const [step, setStep] = useState<"initial" | "verify_otp" | "success">("initial");
  
  // OTP State
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enablePasswordChange, setEnablePasswordChange] = useState(false);
  
  // Loading & Error States
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePhase, setRestorePhase] = useState<"verifying" | "restoring">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [restoredUserData, setRestoredUserData] = useState<User | null>(null);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Initiating Recovery (Sending OTP)
  const handleStartRecovery = async () => {
    if (effectiveExpired) return;
    setIsSendingOtp(true);
    setErrorMessage(null);

    try {
      const res = await sendAccountRecoveryOtpApi(email);
      if (!res.success) {
        throw new Error(res.error || (lang === "ar" ? "فشل إرسال رمز التحقق للاستعادة." : "Failed to send recovery code."));
      }
      setResendCooldown(60);
      setStep("verify_otp");
    } catch (err: any) {
      console.error("Start recovery OTP failed:", err);
      setErrorMessage(
        err.message || 
        (lang === "ar" 
          ? "تعذر إرسال رمز التحقق. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى." 
          : "Unable to send verification code. Please check your connection and try again.")
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Resending OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setErrorMessage(null);

    try {
      const res = await sendAccountRecoveryOtpApi(email);
      if (!res.success) {
        throw new Error(res.error || (lang === "ar" ? "فشل إعادة إرسال الرمز." : "Failed to resend code."));
      }
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "تعذر إعادة إرسال رمز التحقق." : "Could not resend code."));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Confirming OTP and Executing Restoration
  const handleConfirmAndRestore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMessage(
        lang === "ar" 
          ? "يرجى إدخال رمز التحقق المكون من 6 أرقام." 
          : "Please enter the 6-digit verification code."
      );
      return;
    }

    setIsRestoring(true);
    setRestorePhase("verifying");
    setErrorMessage(null);

    try {
      // Step 1: Verify & Restore via backend
      setTimeout(() => {
        setRestorePhase("restoring");
      }, 700);

      const res = await restoreAccountApi(
        email, 
        cleanCode, 
        enablePasswordChange && newPassword.trim() ? newPassword.trim() : undefined
      );

      if (!res.success || !res.user) {
        throw new Error(
          res.error || 
          (lang === "ar" 
            ? "تعذر استعادة الحساب. لم نتمكن من إكمال عملية الاستعادة. يرجى التحقق من هويتك والمحاولة مرة أخرى." 
            : "Unable to restore account. Could not complete recovery process. Please verify your identity and try again.")
        );
      }

      const restoredUser = res.user as User;
      setRestoredUserData(restoredUser);
      setStep("success");

      // Auto login with customToken if returned
      if (res.customToken) {
        try {
          await loginWithCustomToken(res.customToken);
        } catch (tErr) {
          console.warn("Custom token sign-in fallback:", tErr);
        }
      }

      // Transition to active session after short confirmation delay
      setTimeout(() => {
        onRestored(restoredUser, res.customToken);
      }, 1400);

    } catch (err: any) {
      console.error("Account restore confirmation failed:", err);
      setErrorMessage(
        err.message || 
        (lang === "ar" 
          ? "تعذر استعادة الحساب - لم نتمكن من إكمال عملية الاستعادة. يرجى التحقق من هويتك والمحاولة مرة أخرى." 
          : "Unable to restore account. Could not complete recovery process. Please verify your identity and try again.")
      );
      setIsRestoring(false);
    }
  };

  // Translations
  const t = {
    ar: {
      foundTitle: "تم العثور على حساب سابق",
      expiredTitle: "انتهت فترة استعادة هذا الحساب",
      foundDesc: "لقد تم حذف هذا الحساب سابقاً، لكنه لا يزال ضمن فترة الاستعادة المتاحة. يمكنك استعادة حسابك وبياناتك السابقة الآن.",
      expiredDesc: "انتهت مهلة 31 يوماً المتاحة لاستعادة هذا الحساب، وتم حذف البيانات نهائياً وفق سياسة حوكمة النظام.",
      daysRemaining: `متبقي ${computedDaysRemaining} يوماً للاستعادة`,
      expiredBadge: "انتهت مهلة الاستعادة",
      primaryRestoreBtn: "استعادة الحساب",
      sendingOtp: "جارٍ التحقق وإرسال الرمز…",
      backToLoginBtn: "العودة",
      verifyTitle: "التحقق من ملكية الحساب",
      verifyDesc: "تم إرسال رمز تحقق مكون من 6 أرقام إلى بريدك الإلكتروني لتأكيد هويتك واستعادة حسابك:",
      codeLabel: "رمز التحقق (6 أرقام)",
      codePlaceholder: "أدخل الرمز (مثال: 123456)",
      newPasswordToggle: "تعيين كلمة مرور جديدة (اختياري)",
      newPasswordLabel: "كلمة المرور الجديدة",
      newPasswordPlaceholder: "أدخل كلمة المرور الجديدة",
      confirmRestoreBtn: "تأكيد واستعادة الحساب",
      verifyingPhase: "جارٍ التحقق من الرمز…",
      restoringPhase: "جارٍ استعادة حسابك وجميع بياناتك…",
      resendCode: "إعادة إرسال الرمز",
      resendWait: (sec: number) => `إعادة الإرسال بعد (${sec} ثانية)`,
      backBtn: "رجوع",
      successTitle: "تمت استعادة حسابك بنجاح",
      successWelcome: "مرحباً بعودتك إلى Zakir.",
      successDesc: "تمت استعادة ملفك الشخصي، مساحة العمل، والصلاحيات كاملة.",
      enterDashboardBtn: "الدخول إلى لوحة التحكم",
      roleLabel: "الدور:",
      workspaceLabel: "مساحة العمل:"
    },
    en: {
      foundTitle: "Deleted Account Found",
      expiredTitle: "Account Recovery Period Expired",
      foundDesc: "You previously deleted this account, but it is still available for recovery. You can restore your account and all data before the recovery window expires.",
      expiredDesc: "The recovery period for this account has expired and data has been permanently deleted according to system policy.",
      daysRemaining: `${computedDaysRemaining} day${computedDaysRemaining > 1 ? "s" : ""} remaining for recovery`,
      expiredBadge: "Recovery Expired",
      primaryRestoreBtn: "Restore Account",
      sendingOtp: "Sending verification code…",
      backToLoginBtn: "Back to Sign In",
      verifyTitle: "Verify Account Ownership",
      verifyDesc: "A 6-digit verification code has been sent to your email address to confirm your identity and restore your account:",
      codeLabel: "Verification Code (6 digits)",
      codePlaceholder: "Enter code (e.g. 123456)",
      newPasswordToggle: "Set new password (optional)",
      newPasswordLabel: "New Password",
      newPasswordPlaceholder: "Enter new password",
      confirmRestoreBtn: "Verify & Restore Account",
      verifyingPhase: "Verifying account…",
      restoringPhase: "Restoring your account and workspace data…",
      resendCode: "Resend Code",
      resendWait: (sec: number) => `Resend in (${sec}s)`,
      backBtn: "Back",
      successTitle: "Account Restored Successfully",
      successWelcome: "Welcome back to Zakir.",
      successDesc: "Your profile, workspace data, and permissions have been fully restored.",
      enterDashboardBtn: "Enter Dashboard",
      roleLabel: "Role:",
      workspaceLabel: "Workspace:"
    },
    fr: {
      foundTitle: "Compte supprimé trouvé",
      expiredTitle: "Délai de récupération expiré",
      foundDesc: "Vous avez précédemment supprimé ce compte, mais il est toujours disponible pour la récupération. Vous pouvez restaurer votre compte et vos données avant l'expiration du délai.",
      expiredDesc: "La période de récupération pour ce compte a expiré et les données ont été définitivement supprimées conformément à la politique du système.",
      daysRemaining: `${computedDaysRemaining} jour${computedDaysRemaining > 1 ? "s" : ""} restant${computedDaysRemaining > 1 ? "s" : ""} pour la récupération`,
      expiredBadge: "Délai expiré",
      primaryRestoreBtn: "Restaurer le compte",
      sendingOtp: "Envoi du code…",
      backToLoginBtn: "Retour à la connexion",
      verifyTitle: "Vérifier la propriété du compte",
      verifyDesc: "Un code de vérification à 6 chiffres a été envoyé à votre adresse e-mail pour confirmer votre identité et restaurer votre compte :",
      codeLabel: "Code de vérification (6 chiffres)",
      codePlaceholder: "Entrez le code (ex: 123456)",
      newPasswordToggle: "Définir un nouveau mot de passe (optionnel)",
      newPasswordLabel: "Nouveau mot de passe",
      newPasswordPlaceholder: "Entrez le mot de passe",
      confirmRestoreBtn: "Vérifier et restaurer le compte",
      verifyingPhase: "Vérification du compte…",
      restoringPhase: "Restauration de votre compte…",
      resendCode: "Renvoyer le code",
      resendWait: (sec: number) => `Renvoyer dans (${sec}s)`,
      backBtn: "Retour",
      successTitle: "Compte restauré avec succès",
      successWelcome: "Bon retour sur Zakir.",
      successDesc: "Votre profil, votre espace de travail et vos autorisations ont été entièrement restaurés.",
      enterDashboardBtn: "Accéder au tableau de bord",
      roleLabel: "Rôle :",
      workspaceLabel: "Espace :"
    }
  }[lang] || {
    foundTitle: "Deleted Account Found",
    expiredTitle: "Account Recovery Period Expired",
    foundDesc: "You previously deleted this account, but it is still available for recovery. You can restore your account and all data before the recovery window expires.",
    expiredDesc: "The recovery period for this account has expired and data has been permanently deleted according to system policy.",
    daysRemaining: `${computedDaysRemaining} days remaining for recovery`,
    expiredBadge: "Recovery Expired",
    primaryRestoreBtn: "Restore Account",
    sendingOtp: "Sending verification code…",
    backToLoginBtn: "Back to Sign In",
    verifyTitle: "Verify Account Ownership",
    verifyDesc: "A 6-digit verification code has been sent to your email address to confirm your identity and restore your account:",
    codeLabel: "Verification Code (6 digits)",
    codePlaceholder: "Enter code (e.g. 123456)",
    newPasswordToggle: "Set new password (optional)",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "Enter new password",
    confirmRestoreBtn: "Verify & Restore Account",
    verifyingPhase: "Verifying account…",
    restoringPhase: "Restoring your account…",
    resendCode: "Resend Code",
    resendWait: (sec: number) => `Resend in (${sec}s)`,
    backBtn: "Back",
    successTitle: "Account Restored Successfully",
    successWelcome: "Welcome back to Zakir.",
    successDesc: "Your profile, workspace, and permissions have been fully restored.",
    enterDashboardBtn: "Enter Dashboard",
    roleLabel: "Role:",
    workspaceLabel: "Workspace:"
  };

  return (
    <div 
      id="deleted-account-recovery-container"
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300"
    >
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* ================= STEP 1: INITIAL STATE (DETECTED / EXPIRED) ================= */}
      {step === "initial" && (
        <div className="flex flex-col items-center text-center space-y-5">
          {/* Top Badge Icon */}
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 hover:scale-105 ${
              effectiveExpired 
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60" 
                : "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/60 shadow-blue-500/10"
            }`}>
              {effectiveExpired ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <RotateCcw className="w-8 h-8" />
              )}
            </div>
            {!effectiveExpired && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white dark:border-slate-900"></span>
              </span>
            )}
          </div>

          {/* Titles & Descriptions */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {effectiveExpired ? t.expiredTitle : t.foundTitle}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              {effectiveExpired ? t.expiredDesc : t.foundDesc}
            </p>
          </div>

          {/* Account Target Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-mono text-slate-700 dark:text-slate-300 max-w-full truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>

          {/* Remaining Days or Expired Chip */}
          <div className="w-full">
            {effectiveExpired ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t.expiredBadge}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-sm">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold">{t.daysRemaining}</span>
              </div>
            )}
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-start leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-3 pt-2">
            {!effectiveExpired && (
              <button
                id="btn-restore-account-start"
                type="button"
                onClick={handleStartRecovery}
                disabled={isSendingOtp}
                className="w-full h-12 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSendingOtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.sendingOtp}</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>{t.primaryRestoreBtn}</span>
                    {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            )}

            <button
              id="btn-restore-account-cancel"
              type="button"
              onClick={onCancel}
              className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <span>{t.backToLoginBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: OTP VERIFICATION & RESTORATION ================= */}
      {step === "verify_otp" && (
        <form onSubmit={handleConfirmAndRestore} className="flex flex-col space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t.verifyTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {email}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {t.verifyDesc}
          </p>

          {/* OTP Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.codeLabel}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="input-recovery-otp-code"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t.codePlaceholder}
                autoFocus
                disabled={isRestoring}
                className="w-full h-12 ps-10 pe-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-center tracking-[0.35em] text-lg font-black placeholder:tracking-normal placeholder:font-sans placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Optional Password Update Section */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enablePasswordChange}
                onChange={(e) => setEnablePasswordChange(e.target.checked)}
                disabled={isRestoring}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.newPasswordToggle}
              </span>
            </label>

            {enablePasswordChange && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.newPasswordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-recovery-new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.newPasswordPlaceholder}
                    disabled={isRestoring}
                    className="w-full h-10 ps-9 pe-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resend Code Button & Countdown */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 dark:text-slate-400">
              {resendCooldown > 0 ? t.resendWait(resendCooldown) : ""}
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || isSendingOtp || isRestoring}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSendingOtp ? t.sendingOtp : t.resendCode}
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-start leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Submit & Back Buttons */}
          <div className="space-y-2 pt-2">
            <button
              id="btn-restore-account-confirm"
              type="submit"
              disabled={isRestoring || !otpCode.trim()}
              className="w-full h-12 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {restorePhase === "verifying" ? t.verifyingPhase : t.restoringPhase}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.confirmRestoreBtn}</span>
                </>
              )}
            </button>

            <button
              id="btn-restore-account-back-step"
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setStep("initial");
              }}
              disabled={isRestoring}
              className="w-full h-10 rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t.backBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================= STEP 3: RESTORATION SUCCESS ================= */}
      {step === "success" && (
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Animated Success Checkmark */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {t.successTitle}
            </h2>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {t.successWelcome}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
              {t.successDesc}
            </p>
          </div>

          {/* Restored Account Details Pill */}
          {restoredUserData && (
            <div className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-2 text-xs text-start">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t.roleLabel}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40">
                  {restoredUserData.role || "CEO"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t.workspaceLabel}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                  {restoredUserData.workspace?.name || restoredUserData.companyName || "Zakir Workspace"}
                </span>
              </div>
            </div>
          )}

          <div className="w-full pt-2">
            <button
              id="btn-restore-account-enter"
              type="button"
              onClick={() => {
                if (restoredUserData) {
                  onRestored(restoredUserData);
                }
              }}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all duration-200 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.enterDashboardBtn}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default DeletedAccountRecovery;
