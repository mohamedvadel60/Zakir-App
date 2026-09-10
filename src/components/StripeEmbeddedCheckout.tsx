import React, { useEffect, useRef, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { RefreshCw, AlertCircle, RotateCcw, ArrowRight, ShieldCheck, Lock } from "lucide-react";

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  publishableKey: string;
  onComplete: () => void;
  onRetry: () => void;
  onBack: () => void;
  lang?: string;
  theme?: "dark" | "light";
}

let cachedStripePromise: Promise<Stripe | null> | null = null;
let cachedStripeKey: string | null = null;

function getCachedStripeInstance(publishableKey: string): Promise<Stripe | null> {
  const cleanKey = publishableKey.trim();
  if (!cleanKey) return Promise.resolve(null);
  if (!cachedStripePromise || cachedStripeKey !== cleanKey) {
    cachedStripeKey = cleanKey;
    cachedStripePromise = loadStripe(cleanKey).catch((err) => {
      console.warn("[StripeEmbeddedCheckout] loadStripe script load error:", err);
      cachedStripePromise = null;
      return null;
    });
  }
  return cachedStripePromise;
}

export const StripeEmbeddedCheckout: React.FC<StripeEmbeddedCheckoutProps> = ({
  clientSecret,
  publishableKey,
  onComplete,
  onRetry,
  onBack,
  lang = "ar",
  theme = "dark",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"initializing" | "ready" | "error">("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let checkoutInstance: any = null;
    setStatus("initializing");
    setErrorMessage(null);

    // Timeout guard: 12 seconds max before failing gracefully with explicit retry option
    const timeoutId = setTimeout(() => {
      if (!isCancelled && status !== "ready") {
        setStatus("error");
        setErrorMessage(
          lang === "ar"
            ? "استغرقت تهيئة نموذج الدفع وقتاً أطول من المعتاد. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً."
            : "Payment initialization timed out. Please check your internet connection and try again."
        );
      }
    }, 12000);

    const initStripe = async () => {
      try {
        if (!publishableKey || !publishableKey.startsWith("pk_")) {
          throw new Error(
            lang === "ar"
              ? "مفتاح Stripe العام (Publishable Key) غير صالح أو مفقود."
              : "Invalid or missing Stripe Publishable Key."
          );
        }

        if (!clientSecret || !clientSecret.includes("_secret_")) {
          throw new Error(
            lang === "ar"
              ? "رمز جلسة الدفع الآمنة (Client Secret) غير صالح."
              : "Invalid Stripe client secret."
          );
        }

        const stripe = await getCachedStripeInstance(publishableKey);
        if (isCancelled) return;

        if (!stripe) {
          throw new Error(
            lang === "ar"
              ? "تعذر تحميل مكتبة Stripe.js من خوادم Stripe. يرجى التأكد من عدم حجب الاتصال."
              : "Failed to load Stripe.js library. Please verify your connection."
          );
        }

        if (typeof (stripe as any).initEmbeddedCheckout !== "function") {
          throw new Error(
            lang === "ar"
              ? "بوابة الدفع المضمنة (Embedded Checkout) غير مدعومة في إصدار Stripe.js الحالي."
              : "Stripe Embedded Checkout is not supported in this environment."
          );
        }

        // Initialize embedded checkout instance
        checkoutInstance = await (stripe as any).initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            if (!isCancelled) {
              onComplete();
            }
          },
        });

        if (isCancelled) {
          if (checkoutInstance && typeof checkoutInstance.destroy === "function") {
            try { checkoutInstance.destroy(); } catch (e) {}
          }
          return;
        }

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          checkoutInstance.mount(containerRef.current);
          clearTimeout(timeoutId);
          setStatus("ready");
        }
      } catch (err: any) {
        console.error("[StripeEmbeddedCheckout] Mounting error:", err);
        if (!isCancelled) {
          clearTimeout(timeoutId);
          setStatus("error");
          setErrorMessage(
            err?.message || (
              lang === "ar"
                ? "تعذر تحميل واجهة الدفع الآمنة من Stripe. يرجى المحاولة مرة أخرى."
                : "Failed to mount Stripe payment form. Please try again."
            )
          );
        }
      }
    };

    initStripe();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      if (checkoutInstance && typeof checkoutInstance.destroy === "function") {
        try {
          checkoutInstance.destroy();
        } catch (e) {
          console.warn("[StripeEmbeddedCheckout] cleanup error:", e);
        }
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [clientSecret, publishableKey, lang, onComplete]);

  return (
    <div className="w-full relative">
      {/* Loading state indicator */}
      {status === "initializing" && (
        <div className="py-14 text-center space-y-4 px-4">
          <div className="relative inline-block">
            <RefreshCw className="w-10 h-10 text-[#0075DE] animate-spin mx-auto" />
            <Lock className="w-4 h-4 text-emerald-500 absolute bottom-0 right-0 transform translate-x-1 translate-y-1" />
          </div>
          <div className="space-y-1.5">
            <p className={`text-sm font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
              {lang === "ar"
                ? "جاري إعداد بوابة الدفع الآمنة عبر Stripe..."
                : "Initializing secure Stripe payment interface..."}
            </p>
            <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {lang === "ar"
                ? "يتم تشفير وتأمين جلسة الدفع بمعيار PCI-DSS Level 1"
                : "Secured with end-to-end 256-bit encryption"}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onBack}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              {lang === "ar" ? "إلغاء والعودة للباقات" : "Cancel & Return to Plans"}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="p-6 text-center space-y-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-sm">
          <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-rose-400">
              {lang === "ar" ? "تعذر تحميل بوابة الدفع" : "Failed to load payment checkout"}
            </p>
            <p className="text-xs text-rose-200/90 max-w-md mx-auto">
              {errorMessage}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 bg-gradient-to-r from-[#0075DE] to-[#005BAB] hover:brightness-110 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "إعادة المحاولة" : "Try Again"}</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className={`px-4 py-2 font-bold rounded-xl text-xs cursor-pointer transition-all shadow-sm active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-800"
              }`}
            >
              <span>{lang === "ar" ? "العودة للباقات" : "Back to plans"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mounted Stripe Embedded Checkout iframe container */}
      <div
        ref={containerRef}
        id="stripe-embedded-checkout"
        className={`w-full transition-opacity duration-300 ${
          status === "ready" ? "opacity-100 min-h-[420px]" : "opacity-0 absolute top-0 pointer-events-none h-0 overflow-hidden"
        }`}
      />
    </div>
  );
};
