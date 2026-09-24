import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  lang?: "ar" | "en" | "fr";
  theme?: "dark" | "light";
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SmartEvolutionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[SmartEvolutionErrorBoundary] Caught section runtime error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isAr = this.props.lang === "ar";
      const isDark = this.props.theme !== "light";

      return (
        <div
          className={`p-8 rounded-2xl border transition-all text-start space-y-4 ${
            isDark
              ? "bg-slate-900/50 border-rose-500/30 text-slate-100"
              : "bg-rose-50/50 border-rose-200 text-slate-900"
          }`}
        >
          <div className="flex items-center gap-3 text-rose-500 font-bold">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h3 className="text-base font-black">
                {isAr ? "تعذر إكمال معالجة التطور الذكي" : "Unable to complete Smart Evolution analysis"}
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                {isAr
                  ? "حدث خطأ أثناء معالجة أو عرض النتائج. تم احتواء الخطأ داخل هذا القسم لحماية استقرار بيئة العمل."
                  : "An error occurred during report processing. Contained safely within this module."}
              </p>
            </div>
          </div>

          {this.state.error?.message && (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-rose-500/20 text-rose-400 font-mono text-[11px] break-all dir-ltr">
              {this.state.error.message}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={this.handleReset}
              className="h-10 px-5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isAr ? "إعادة المحاولة" : "Retry Analysis"}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
