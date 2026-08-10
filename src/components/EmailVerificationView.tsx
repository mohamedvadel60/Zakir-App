import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, LogOut } from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { sendVerificationCodeApi, verifyCodeApi } from "../lib/firebaseServices";
import { User } from "../types";

interface EmailVerificationViewProps {
  currentUser: User;
  lang: "ar" | "en" | "fr";
  onLogout: () => void;
  setCurrentUser: (user: User | null) => void;
  applyUserPreferences: (user: User | null) => void;
}

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  currentUser,
  lang,
  onLogout,
  setCurrentUser,
  applyUserPreferences,
}) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [resendAttempts, setResendAttempts] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

  // 1. Automatically request initial OTP on mount without consuming resend attempts
  useEffect(() => {
    let isMounted = true;
    const autoSentKey = `auto_sent_otp_${currentUser.id || currentUser.email}`;
    
    if (!sessionStorage.getItem(autoSentKey)) {
      sessionStorage.setItem(autoSentKey, "true");
      
      sendVerificationCodeApi(
        currentUser.email,
        undefined,
        "account_registration",
        currentUser.id,
        currentUser.ownerName || currentUser.companyName,
        lang,
        true // isInitial = true (does not count towards resend attempts)
      )
        .then((res) => {
          if (!isMounted) return;
          if (res && res.success) {
            setVerificationSuccess(
              lang === "ar"
                ? "تم إرسال رمز التحقق تلقائياً إلى بريدك الإلكتروني!"
                : "Verification code automatically sent to your email!"
            );
          } else if (res && res.error) {
            // If already sent or throttled, don't show noisy error for initial auto send
            console.warn("Initial auto OTP notice:", res.error);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.warn("Initial auto OTP send warning:", err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.email]);

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Cooldown timer effect
  useEffect(() => {
    if (!cooldownUntil) return;
    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000));
      setCooldownTimeLeft(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setVerificationError(
        lang === "ar"
          ? "يرجى إدخال رمز التحقق المكون من 6 أرقام."
          : "Please enter the full 6-digit verification code."
      );
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError("");
    setVerificationSuccess("");

    try {
      const res = await verifyCodeApi(
        currentUser.email,
        verificationCode,
        "account_registration",
        undefined,
        currentUser.id
      );

      if (res && res.success) {
        setVerificationSuccess(
          lang === "ar" ? "تم التحقق بنجاح! جاري التوجيه..." : "Verification successful! Redirecting..."
        );

        const updatedUser: User = {
          ...currentUser,
          isVerified: true,
          isEmailVerified: true,
          email_verified: true,
          emailVerified: true,
          verification_status: "verified" as const,
          verification_required: false,
        };

        setCurrentUser(updatedUser);
        applyUserPreferences(updatedUser);

        if (currentUser?.id) {
          try {
            const { updateDoc, doc } = await import("firebase/firestore");
            const { db } = await import("../firebase");
            await updateDoc(doc(db, "users", currentUser.id), {
              isVerified: true,
              isEmailVerified: true,
              email_verified: true,
              emailVerified: true,
              verification_status: "verified",
              verification_required: false,
              "verificationInfo.status": "verified",
              "verificationInfo.verifiedAt": new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn("Failed to persist Firestore verification status:", fsErr);
          }
        }
      } else {
        setVerificationError(
          res?.error || (lang === "ar" ? "رمز التحقق غير صحيح." : "Incorrect verification code.")
        );
      }
    } catch (err: any) {
      setVerificationError(err?.message || "Verification failed");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendClick = async () => {
    if (cooldownTimeLeft > 0 || resendCountdown > 0 || resendAttempts >= 3) return;

    setIsResendingCode(true);
    setVerificationError("");
    setVerificationSuccess("");

    try {
      const res = await sendVerificationCodeApi(
        currentUser.email,
        undefined,
        "account_registration",
        currentUser.id,
        currentUser.ownerName || currentUser.companyName,
        lang,
        false // isInitial = false (counts as resend attempt)
      );

      if (res && res.success) {
        setVerificationSuccess(
          lang === "ar" ? "تم إعادة إرسال رمز التحقق بنجاح!" : "Verification code resent successfully!"
        );
        const newCount = typeof res.sendCount === "number" ? res.sendCount : resendAttempts + 1;
        setResendAttempts(newCount);
        if (res.cooldownUntil) {
          setCooldownUntil(res.cooldownUntil);
        } else {
          setResendCountdown(60);
        }
      } else {
        if (res) {
          if (typeof res.sendCount === "number") setResendAttempts(res.sendCount);
          if (res.cooldownUntil) setCooldownUntil(res.cooldownUntil);
        }
        setVerificationError(
          res?.userFriendlyMessage ||
            res?.error ||
            (lang === "ar" ? "فشل إرسال الرمز." : "Failed to resend code.")
        );
      }
    } catch (err: any) {
      setVerificationError(err?.message || "Failed to resend code");
    } finally {
      setIsResendingCode(false);
    }
  };

  const remainingAttempts = Math.max(0, 3 - resendAttempts);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 relative selection:bg-amber-500/30">
      {/* Top Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <ZakirLogo iconOnly size={18} theme="dark" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">ZAKIR</span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
        </button>
      </div>

      {/* Verification Code Box */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {lang === "ar"
              ? "توثيق البريد الإلكتروني"
              : lang === "fr"
              ? "Vérification de l'E-mail"
              : "Email Verification"}
          </h2>
          <p className="text-xs text-slate-400">
            {lang === "ar"
              ? "لقد أرسلنا رمز تحقق ديناميكي من 6 أرقام إلى:"
              : lang === "fr"
              ? "Nous avons envoyé un code à 6 chiffres à :"
              : "We've sent a 6-digit verification code to:"}
          </p>
          <p className="text-sm font-semibold text-amber-400 break-all">{currentUser.email}</p>
        </div>

        {/* Error/Success Notifications */}
        {verificationError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{verificationError}</span>
          </div>
        )}
        {verificationSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{verificationSuccess}</span>
          </div>
        )}

        {/* Code Input Form */}
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {lang === "ar" ? "رمز التحقق" : "Verification Code"}
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="------"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center tracking-[12px] text-xl font-bold font-mono py-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-amber-400 placeholder:text-slate-800 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifyingCode || verificationCode.length !== 6}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {isVerifyingCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{lang === "ar" ? "تأكيد وتفعيل الحساب" : "Confirm & Activate Account"}</span>
          </button>
        </form>

        {/* Resend Code Section */}
        <div className="text-center pt-2 space-y-2">
          <button
            type="button"
            disabled={isResendingCode || resendCountdown > 0 || cooldownTimeLeft > 0 || resendAttempts >= 3}
            onClick={handleResendClick}
            className="text-xs text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isResendingCode && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {cooldownTimeLeft > 0
                ? lang === "ar"
                  ? `حاول مجدداً خلال ${cooldownTimeLeft}ث`
                  : `Try again in ${cooldownTimeLeft}s`
                : resendCountdown > 0
                ? lang === "ar"
                  ? `إعادة إرسال الرمز خلال ${resendCountdown} ثانية`
                  : `Resend code in ${resendCountdown}s`
                : resendAttempts >= 3
                ? lang === "ar"
                  ? "لقد استنفدت محاولات إعادة إرسال الرمز."
                  : "No more resend attempts remaining."
                : lang === "ar"
                ? "إعادة إرسال الرمز"
                : "Resend Verification Code"}
            </span>
          </button>

          {cooldownTimeLeft > 0 ? (
            <p className="text-[11px] text-amber-400/90 font-medium px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              {lang === "ar"
                ? "لقد وصلت إلى الحد الأقصى لطلبات الرمز. يرجى الانتظار بضع دقائق قبل طلب رمز جديد."
                : "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new code."}
            </p>
          ) : resendAttempts >= 3 ? (
            <p className="text-[11px] text-rose-400 font-medium px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              {lang === "ar"
                ? "لقد استنفدت محاولات إعادة إرسال الرمز (3 من 3)."
                : "You have exhausted all 3 resend attempts."}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium">
              {lang === "ar"
                ? `محاولات إعادة الإرسال المتبقية: ${remainingAttempts} من 3`
                : `Remaining resend attempts: ${remainingAttempts} of 3`}
            </p>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-600">
        &copy; 2026 Zakir Enterprise. All rights reserved.
      </div>
    </div>
  );
};
