import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface UpdateStatusData {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'dev-mode';
  info?: {
    version?: string;
  };
  progress?: {
    percent: number;
  };
  error?: string;
}

interface Props {
  lang?: 'ar' | 'fr' | 'en';
}

export const DesktopUpdateNotification: React.FC<Props> = ({ lang = 'ar' }) => {
  const [updateState, setUpdateState] = useState<UpdateStatusData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).zakirDesktop) {
      return;
    }

    const api = (window as any).zakirDesktop;
    const cleanup = api.onUpdateStatus?.((data: UpdateStatusData) => {
      console.log('[DesktopUpdateNotification] Update status:', data);
      setUpdateState(data);
      if (data.status === 'available' || data.status === 'downloaded') {
        setDismissed(false);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  if (!updateState || dismissed) return null;
  if (updateState.status === 'not-available' || updateState.status === 'dev-mode' || updateState.status === 'checking') {
    return null;
  }

  const handleDownload = () => {
    if ((window as any).zakirDesktop?.downloadUpdate) {
      (window as any).zakirDesktop.downloadUpdate();
    }
  };

  const handleInstall = () => {
    if ((window as any).zakirDesktop?.installUpdate) {
      (window as any).zakirDesktop.installUpdate();
    }
  };

  const isAr = lang === 'ar';
  const newVersion = updateState.info?.version || '';
  const percent = Math.round(updateState.progress?.percent || 0);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 shadow-2xl shadow-slate-950/80 text-white animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            {updateState.status === 'downloaded' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : updateState.status === 'downloading' ? (
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : updateState.status === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-emerald-400" />
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              {updateState.status === 'available' && (isAr ? 'تحديث جديد متاح' : 'New Update Available')}
              {updateState.status === 'downloading' && (isAr ? 'جارٍ تنزيل التحديث...' : 'Downloading Update...')}
              {updateState.status === 'downloaded' && (isAr ? 'التحديث جاهز للتثبيت' : 'Update Ready to Install')}
              {updateState.status === 'error' && (isAr ? 'فشل التحديث' : 'Update Failed')}
              {newVersion && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  v{newVersion}
                </span>
              )}
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              {updateState.status === 'available' && (isAr ? 'يتوفر إصدار جديد من تطبيق Zakir للسطح المكتب.' : 'A new version of Zakir desktop app is available.')}
              {updateState.status === 'downloading' && (isAr ? `تم تنزيل ${percent}% من التحديث.` : `Downloaded ${percent}% of the update.`)}
              {updateState.status === 'downloaded' && (isAr ? 'تم تنزيل التحديث بنجاح. انقر لإعادة التشغيل وتثبيت التحديث.' : 'Update downloaded. Click to restart and complete update.')}
              {updateState.status === 'error' && (updateState.error || (isAr ? 'حدث خطأ أثناء البحث عن التحديث.' : 'An error occurred during update.'))}
            </p>

            {updateState.status === 'downloading' && (
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              {updateState.status === 'available' && (
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isAr ? 'تنزيل التحديث' : 'Download Update'}
                </button>
              )}

              {updateState.status === 'downloaded' && (
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isAr ? 'إعادة التشغيل والتثبيت' : 'Restart & Install'}
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
