import React, { useEffect, useRef, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { RefreshCw, AlertCircle, RotateCcw, Lock } from "lucide-react";

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

export function getCachedStripeInstance(publishableKey: string): Promise<Stripe | null> {
  const cleanKey = publishableKey ? publishableKey.trim() : "";
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

    // Safety timeout guard: 12 seconds max before failing gracefully with explicit retry option
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

        if (typeof (stripe as any).initEmbeddedCheckout === "function") {
          checkoutInstance = await (stripe as any).initEmbeddedCheckout({
            clientSecret,
            onComplete: () => {
              if (!isCancelled) {
                onComplete();
              }
            },
          });
        } else if (typeof (stripe as any).createEmbeddedCheckoutPage === "function") {
          checkoutInstance = await (stripe as any).createEmbeddedCheckoutPage({
            clientSecret,
            onComplete: () => {
              if (!isCancelled) {
                onComplete();
              }
            },
          });
        } else {
          throw new Error(
            lang === "ar"
              ? "بوابة الدفع المضمنة المباشرة غير مدعومة في هذا المتصفح. سيتم توجيهك إلى صفحة Stripe الآمنة."
              : "Embedded checkout is not available in this browser. You will be redirected to Stripe's secure checkout page."
          );
        }

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
          if (!isCancelled) {
            setStatus("ready");
          }
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
          console.warn("[StripeEmbeddedCheckout] cleanup notice:", e);
        }
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [clientSecret, publishableKey, lang, onComplete]);

  return (
    <div className="w-full relative min-h-[420px]">
      {/* Loading state indicator overlay (positioned over container so iframe has real DOM layout dimensions during mount) */}
      {status === "initializing" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-xl min-h-[420px]">
          <div className="relative inline-block">
            <RefreshCw className="w-9 h-9 text-[#0075DE] animate-spin mx-auto" />
            <Lock className="w-4 h-4 text-emerald-500 absolute bottom-0 right-0 transform translate-x-1 translate-y-1" />
          </div>
          <div className="space-y-1.5 max-w-sm">
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
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="p-6 text-center space-y-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-sm my-4">
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
          </div>
        </div>
      )}

      {/* Mounted Stripe Embedded Checkout iframe container with full normal-flow layout */}
      <div
        ref={containerRef}
        id="stripe-embedded-checkout"
        className={`w-full min-h-[420px] ${status === "error" ? "hidden" : "block"}`}
      />
    </div>
  );
};
