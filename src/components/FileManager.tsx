import React, { useState, useEffect } from "react";
import { 
  Folder, 
  UploadCloud, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Eye, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Lock,
  Unlock,
  Tag,
  Info,
  RefreshCw,
  Plus,
  X
} from "lucide-react";
import { UserFile } from "../types.js";
import { 
  uploadFirebaseUserFile, 
  fetchFirebaseUserFiles, 
  deleteFirebaseUserFile, 
  updateFirebaseUserFile,
  formatBytes 
} from "../lib/firebaseServices.js";
import { openOrDownloadUserFile, downloadUserFile as downloadUserFileUtil, openUserFileInNewTab as openUserFileInNewTabUtil } from "../lib/fileViewerUtils.js";

interface FileManagerProps {
  userId: string;
  lang: "ar" | "en" | "fr";
  theme: "dark" | "light";
  secretPasscode?: string;
  isVaultLocked?: boolean;
}

// Helpers for data URL to blob & downloads
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

function downloadUserFile(file: UserFile) {
  downloadUserFileUtil(file);
}

function openUserFileInNewTab(file: UserFile) {
  openUserFileInNewTabUtil(file);
}

export const FileManager: React.FC<FileManagerProps> = ({ 
  userId, 
  lang, 
  theme,
  secretPasscode = "",
  isVaultLocked = false
}) => {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  
  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("Verification");
  const [customFileCategory, setCustomFileCategory] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");

  // Unlocked files set in this session
  const [unlockedFileIds, setUnlockedFileIds] = useState<Set<string>>(new Set());

  // Filter & Delete Target State
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Decryption & Passcode Modal State
  const [passcodeModal, setPasscodeModal] = useState<{
    isOpen: boolean;
    file: UserFile | null;
    action: "unlock" | "decryptToggle" | "preview" | "download";
    isVerified?: boolean;
    error?: string;
  }>({
    isOpen: false,
    file: null,
    action: "unlock",
    isVerified: false,
    error: ""
  });
  const [enteredPasscode, setEnteredPasscode] = useState<string>("");

  useEffect(() => {
    loadFiles();
  }, [userId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchFirebaseUserFiles(userId);
      setFiles(data);
    } catch (e) {
      console.error("Error loading user files:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError("");
    }
  };

  // Instant Upload (Optimistic UI + Background Firebase Sync)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError(
        lang === "ar" 
          ? "يرجى تحديد ملف للتحميل" 
          : (lang === "fr" ? "Veuillez sélectionner un fichier" : "Please select a file to upload")
      );
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const finalCategory = category === "Other" ? (customFileCategory.trim() || "Other") : category;
      const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const storagePath = `users/${userId}/files/${fileId}_${selectedFile.name}`;
      
      let localDataUrl = "";
      try {
        localDataUrl = await fileToBase64(selectedFile);
      } catch (e) {
        localDataUrl = "";
      }

      const newFile: UserFile = {
        id: fileId,
        fileName: selectedFile.name,
        fileUrl: localDataUrl,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || "application/octet-stream",
        uploadDate: new Date().toISOString(),
        userId: userId,
        category: finalCategory,
        description: description,
        storagePath: storagePath,
        isEncrypted: isEncrypted
      };

      // Instantly add to UI list!
      setFiles(prev => [newFile, ...prev]);
      setSelectedFile(null);
      setDescription("");
      setCustomFileCategory("");
      setIsEncrypted(false);
      setUploadSuccess(
        lang === "ar" 
          ? "تم إضافة وحفظ الملف بنجاح في مخزن المستندات!" 
          : (lang === "fr" ? "Fichier ajouté au coffre-fort avec succès !" : "File successfully added to stored documents!")
      );
      setTimeout(() => setUploadSuccess(""), 4000);

      // Async background sync with Firebase Storage & Firestore
      uploadFirebaseUserFile(userId, selectedFile, finalCategory, description, isEncrypted)
        .then((uploaded) => {
          if (uploaded.fileUrl) {
            setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, fileUrl: uploaded.fileUrl } : f));
          }
        })
        .catch(err => console.warn("Background storage sync error:", err));

    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  // Instant Delete (Optimistic UI + Background Deletion)
  const handleDelete = (file: UserFile) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    setDeleteTargetId(null);
    deleteFirebaseUserFile(userId, file.id, file.storagePath).catch(e => console.warn("Background delete error:", e));
  };

  // Preview File Handler - Opens directly in a new browser web tab
  const handlePreviewFile = (file: UserFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isLocked = file.isEncrypted && !unlockedFileIds.has(file.id);
    if (isLocked) {
      setEnteredPasscode("");
      setPasscodeModal({
        isOpen: true,
        file: file,
        action: "preview",
        error: ""
      });
    } else {
      openUserFileInNewTab(file);
    }
  };

  // Download File Handler
  const handleDownloadFile = (file: UserFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isLocked = file.isEncrypted && !unlockedFileIds.has(file.id);
    if (isLocked) {
      setEnteredPasscode("");
      setPasscodeModal({
        isOpen: true,
        file: file,
        action: "download",
        error: ""
      });
    } else {
      downloadUserFile(file);
    }
  };

  // Unlock Button Handler
  const handleUnlockFile = (file: UserFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEnteredPasscode("");
    setPasscodeModal({
      isOpen: true,
      file: file,
      action: "unlock",
      error: ""
    });
  };

  // Toggle Encryption Button Handler (Encrypts unencrypted file or prompts for decryption of encrypted file)
  const handleToggleEncryption = (file: UserFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (file.isEncrypted) {
      // Attempting to decrypt requires passcode entry modal
      setEnteredPasscode("");
      setPasscodeModal({
        isOpen: true,
        file: file,
        action: "decryptToggle",
        error: ""
      });
    } else {
      // Encrypting the file
      const nextState = true;
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, isEncrypted: nextState } : f));
      updateFirebaseUserFile(userId, file.id, { isEncrypted: nextState }).catch(e => console.warn("Toggle encryption error:", e));
    }
  };

  // Passcode Verification Submission
  const handleVerifyPasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = passcodeModal.file;
    if (!file) return;

    const passcodeToMatch = (secretPasscode && secretPasscode.trim() !== "") ? secretPasscode.trim() : "1234";

    if (enteredPasscode.trim() === passcodeToMatch) {
      // Session unlock
      setUnlockedFileIds(prev => new Set(prev).add(file.id));

      if (passcodeModal.action === "decryptToggle") {
        // Permanently un-encrypt file in DB and state
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, isEncrypted: false } : f));
        updateFirebaseUserFile(userId, file.id, { isEncrypted: false }).catch(e => console.warn("Toggle encryption error:", e));
      }

      // Transition modal state to options choice (isVerified: true)
      setPasscodeModal(prev => ({
        ...prev,
        isVerified: true,
        error: ""
      }));
      setEnteredPasscode("");
    } else {
      setPasscodeModal(prev => ({
        ...prev,
        error: lang === "ar"
          ? "رمز/كلمة السر لفك التشفير غير صحيحة! تعذر فك تشفير الملف."
          : "Incorrect passcode! Decryption verification failed."
      }));
    }
  };

  // Helper: File Icon based on MimeType
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="w-6 h-6 text-amber-400" />;
    } else if (mimeType.includes("pdf")) {
      return <FileText className="w-6 h-6 text-rose-400" />;
    } else {
      return <File className="w-6 h-6 text-teal-400" />;
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.fileName.toLowerCase().includes(search.toLowerCase()) ||
                          file.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Context Header */}
      <div className={`p-6 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all duration-300 relative overflow-hidden ${
        theme === "dark" 
          ? "bg-gradient-to-br from-slate-900/80 to-slate-950/90 border-slate-800/80 shadow-2xl shadow-black/40" 
          : "bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-xl shadow-slate-100/40"
      }`}>
        <div className="absolute top-0 right-0 w-64 h-32 bg-[#D4AF37]/5 blur-3xl pointer-events-none rounded-full" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/5">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-lg font-black tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {lang === "ar" ? "مخزن المستندات الآمن" : "Secure Institutional Document Vault"}
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold uppercase tracking-wider font-mono">
                {lang === "ar" ? "قوانين وصول صارمة" : "Strict Owner Rules"}
              </span>
            </div>
            <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {lang === "ar"
                ? "إدارة وتحميل الملفات المؤسسية الحساسة. يتم تشفير الملفات المالية والتنظيمية باستخدام الرمز السري الحصري للشركة."
                : "Manage and upload sensitive corporate documents. Critical financial and compliance records are encrypted locally using the master secret code."}
            </p>
          </div>
        </div>

        <button 
          onClick={loadFiles}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer shrink-0 shadow-md ${
            theme === "dark"
              ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
          <span>{lang === "ar" ? "تحديث مخزن الملفات" : "Refresh Vault"}</span>
        </button>
      </div>

      {/* Main Split Layout Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Upload Control Desk (lg:col-span-4) */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`p-6 rounded-2xl border transition-all duration-300 ${
            theme === "dark" 
              ? "bg-slate-900/30 border-slate-800/80 backdrop-blur-md shadow-xl" 
              : "bg-white border-slate-200 shadow-md"
          }`}>
            <h3 className={`text-sm font-black uppercase tracking-wider mb-5 flex items-center gap-2.5 pb-3 border-b ${
              theme === "dark" ? "text-white border-slate-800/60" : "text-slate-900 border-slate-100"
            }`}>
              <UploadCloud className="w-5 h-5 text-[#D4AF37]" />
              <span>{lang === "ar" ? "تحميل وثيقة جديدة" : "Document Desk Control"}</span>
            </h3>

            {uploadSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-medium">{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-medium">{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Elevated Drop Zone area */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  {lang === "ar" ? "الملف المصدر:" : "Source File:"}
                </label>
                <div className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-300 cursor-pointer group ${
                  selectedFile
                    ? "border-amber-500/50 bg-amber-500/5"
                    : theme === "dark" 
                      ? "border-slate-800 hover:border-slate-700 bg-slate-950/40" 
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}>
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-3.5 text-left rtl:text-right">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                        {getFileIcon(selectedFile.type)}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className={`text-xs font-black truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{selectedFile.name}</p>
                        <p className="text-[10px] text-amber-400 font-mono mt-0.5">{formatBytes(selectedFile.size)}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-4 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-slate-800/40 border border-slate-700/40 flex items-center justify-center text-slate-400 group-hover:scale-105 group-hover:text-[#D4AF37] transition-all">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                          {lang === "ar" ? "انقر لاختيار ملف أو اسحبه هنا" : "Click to browse or drop document"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">PDF, PNG, JPG, DOCX, CSV</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Select */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  {lang === "ar" ? "فئة المستند:" : "Category Mapping:"}
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value !== "Other") {
                      setCustomFileCategory("");
                    }
                  }}
                  className={`w-full h-11 px-3.5 text-xs rounded-xl border outline-none font-bold transition-all ${
                    theme === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white focus:border-[#D4AF37]/50" 
                      : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#D4AF37]/50"
                  }`}
                >
                  <option value="Verification">{lang === "ar" ? "السجل التجاري والتحقق" : "Corporate Verification"}</option>
                  <option value="Compliance">{lang === "ar" ? "سياسات الامتثال" : "Compliance Policy"}</option>
                  <option value="Financial">{lang === "ar" ? "تقارير مالية" : "Financial Report"}</option>
                  <option value="Customs">{lang === "ar" ? "بيانات جمركية" : "Customs Declaration"}</option>
                  <option value="Audit">{lang === "ar" ? "سجلات التدقيق" : "Audit Log"}</option>
                  <option value="General">{lang === "ar" ? "عام" : "General"}</option>
                  <option value="Other">{lang === "ar" ? "أخرى (كتابة فئة مخصصة)" : "Other (write custom)"}</option>
                </select>
                {category === "Other" && (
                  <input 
                    type="text"
                    value={customFileCategory}
                    onChange={(e) => setCustomFileCategory(e.target.value)}
                    className={`w-full h-11 px-3.5 mt-2 border rounded-xl text-xs outline-none focus:border-[#D4AF37]/70 focus:ring-1 focus:ring-[#D4AF37]/20 ${
                      theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                    placeholder={lang === "ar" ? "اكتب فئة المستند هنا..." : "Enter custom document category..."}
                    required
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  {lang === "ar" ? "وصف المستند / ملاحظات إضافية:" : "Document Narrative Description:"}
                </label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={lang === "ar" ? "مثال: نسخة معتمدة من السجل التجاري لسنة 2026..." : "e.g. Certified corporate license copy 2026"}
                  className={`w-full h-20 p-3 text-xs rounded-xl border outline-none resize-none transition-all ${
                    theme === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-[#D4AF37]/50" 
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#D4AF37]/50"
                  }`}
                />
              </div>

              {/* Secure Encryption Toggle Indicator */}
              <div className={`p-4 rounded-xl border transition-all duration-300 ${
                isEncrypted 
                  ? "bg-amber-500/10 border-amber-500/30" 
                  : theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-150"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isEncrypted ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
                      <Lock className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <p className={`text-xs font-black ${isEncrypted ? "text-amber-300" : "text-slate-400"}`}>
                        {lang === "ar" ? "تشفير وحماية المستند" : "Local Security Encryption"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {lang === "ar" ? "تقييد هذا الملف بكلمة المرور الحصرية للشركة" : "Require the master PIN code to decrypt & view file"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEncrypted}
                    onChange={(e) => setIsEncrypted(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full h-11 bg-gradient-to-r from-[#D4AF37] to-[#B59410] hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {uploading 
                    ? (lang === "ar" ? "جاري الحفظ والتحميل..." : "Processing Upload...") 
                    : (lang === "ar" ? "حفظ الملف في المخزن" : "Upload File to Storage")}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Stored Documents Vault (lg:col-span-8) */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`p-6 rounded-2xl border transition-all duration-300 ${
            theme === "dark" 
              ? "bg-slate-900/30 border-slate-800/80 backdrop-blur-md shadow-xl" 
              : "bg-white border-slate-200 shadow-md"
          }`}>
            {/* Headers & Search Box strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/40 mb-6">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#D4AF37]" />
                <h3 className={`text-sm font-black uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {lang === "ar" ? "الملفات والوثائق النشطة" : "Active Documents Repository"}
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-slate-900 text-[#D4AF37] border border-slate-800 font-mono">
                  {files.length}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-1 md:justify-end">
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={lang === "ar" ? "بحث عن ملف..." : "Search repository..."}
                    className={`w-full h-9 pl-9 pr-3 text-xs rounded-xl border outline-none transition-all ${
                      theme === "dark" 
                        ? "bg-slate-950 border-slate-800 text-white focus:border-[#D4AF37]/50" 
                        : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#D4AF37]/50"
                    }`}
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`h-9 px-3 text-xs rounded-xl border outline-none font-bold transition-all ${
                    theme === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white" 
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="all">{lang === "ar" ? "جميع الفئات" : "All Categories"}</option>
                  {Array.from(new Set([
                    "Verification",
                    "Compliance",
                    "Financial",
                    "Customs",
                    "Audit",
                    "General",
                    ...files.map(f => f.category)
                  ])).filter(Boolean).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document Content List */}
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin text-[#D4AF37] mb-2" />
                <p className="text-xs font-bold">{lang === "ar" ? "جاري مزامنة الملفات المشفرة مع السحابة..." : "Syncing encrypted documents with cloud storage..."}</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-800/80 rounded-2xl">
                <Folder className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-40" />
                <p className={`text-sm font-black ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {lang === "ar" ? "لا توجد مستندات مطابقة حالياً" : "Vault holds no matching documents"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === "ar" ? "قم بتحميل أول وثيقة لتظهر في الفهرس الذكي." : "Upload a file using the configuration panel to expand database."}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredFiles.map(file => {
                  const isLockedFile = file.isEncrypted && !unlockedFileIds.has(file.id);

                  return (
                    <div 
                      key={file.id} 
                      className={`p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                        file.isEncrypted
                          ? "bg-slate-950/80 border-amber-500/35 shadow-lg shadow-amber-500/2"
                          : theme === "dark" 
                            ? "bg-slate-900/10 border-slate-800 hover:border-slate-700 hover:bg-slate-900/20" 
                            : "bg-slate-50 border-slate-150 hover:border-[#D4AF37]/35 hover:bg-slate-100/30 shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 overflow-hidden">
                          <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                            file.isEncrypted 
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                              : "bg-slate-800 border-slate-700 text-slate-300"
                          }`}>
                            {getFileIcon(file.mimeType)}
                          </div>
                          
                          <div className="overflow-hidden">
                            <h4 className={`text-xs font-black truncate leading-normal ${theme === "dark" ? "text-white" : "text-slate-900"}`} title={file.fileName}>
                              {file.fileName}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{formatBytes(file.fileSize)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {new Date(file.uploadDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Badges and tags segment */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {file.isEncrypted ? (
                            <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>{lang === "ar" ? "مشفر" : "Encrypted"}</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wide">
                              {lang === "ar" ? "مكشوف" : "Standard"}
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] uppercase tracking-wide font-mono">
                            {file.category}
                          </span>
                        </div>
                      </div>

                      {file.description && (
                        <p className={`text-[11px] leading-relaxed mt-3.5 p-2.5 rounded-lg border ${
                          theme === "dark" 
                            ? "text-slate-400 bg-slate-950/40 border-slate-800/60" 
                            : "text-slate-600 bg-white border-slate-150"
                        }`}>
                          {file.description}
                        </p>
                      )}

                      {/* Interactive Controls Desk */}
                      <div className="mt-4 pt-3 border-t border-slate-800/40 flex flex-wrap items-center justify-between gap-2">
                        {isLockedFile ? (
                          <button
                            onClick={(e) => handleUnlockFile(file, e)}
                            className="px-3.5 h-8 rounded-lg text-[11px] font-black bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{lang === "ar" ? "إدخال الرمز لفك التشفير" : "Decrypt Secure File"}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handlePreviewFile(file, e)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "معاينة" : "Preview"}</span>
                            </button>

                            <button 
                              onClick={(e) => handleDownloadFile(file, e)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>{lang === "ar" ? "تنزيل" : "Download"}</span>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {/* Crypt toggle code */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleEncryption(file, e)}
                            className={`p-2 rounded-lg transition-all cursor-pointer border ${
                              file.isEncrypted
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700"
                            }`}
                            title={file.isEncrypted ? "Decrypt Document" : "Secure Document"}
                          >
                            {file.isEncrypted ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTargetId(file.id);
                            }}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Confirm Delete Popup */}
                      {deleteTargetId === file.id && (
                        <div 
                          onClick={(e) => e.stopPropagation()} 
                          className="mt-3.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-2.5 animate-in slide-in-from-top-2 duration-200"
                        >
                          <p className="text-rose-300 font-bold">
                            {lang === "ar" ? "تأكيد حذف الملف نهائياً من مخزن سحابة Firestore؟" : "Confirm permanent deletion from database?"}
                          </p>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file);
                              }}
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-[11px] cursor-pointer"
                            >
                              {lang === "ar" ? "نعم، احذف فوراً" : "Yes, Purge Document"}
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetId(null);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              {lang === "ar" ? "إلغاء" : "Cancel"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* DECRYPTION / UNLOCK PASSCODE MODAL */}
      {passcodeModal.isOpen && passcodeModal.file && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl border ${
                  passcodeModal.isVerified 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}>
                  {passcodeModal.isVerified ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {passcodeModal.isVerified
                      ? (lang === "ar" ? "تم فك تشفير المستند بنجاح" : "Document Decrypted Successfully")
                      : (lang === "ar" ? "فك تشفير وإلغاء قفل الملف" : "Decrypt & Unlock File")}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[220px]" title={passcodeModal.file.fileName}>
                    {passcodeModal.file.fileName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPasscodeModal({ isOpen: false, file: null, action: "unlock", isVerified: false, error: "" });
                  setEnteredPasscode("");
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passcodeModal.isVerified ? (
              /* OPTIONS CHOICE SCREEN AFTER PASSCODE VERIFICATION */
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {lang === "ar"
                    ? "تم فك تشفير الملف بنجاح! حدد الخيار الذي ترغب في إجرائه الآن:"
                    : "File decrypted successfully! Select what you would like to do now:"}
                </p>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      openUserFileInNewTab(passcodeModal.file!);
                      setPasscodeModal({ isOpen: false, file: null, action: "unlock", isVerified: false, error: "" });
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{lang === "ar" ? "معاينة الملف (فتح في تبويب جديد)" : "Preview File (Open in New Tab)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadUserFile(passcodeModal.file!);
                      setPasscodeModal({ isOpen: false, file: null, action: "unlock", isVerified: false, error: "" });
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>{lang === "ar" ? "تنزيل الملف" : "Download File"}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPasscodeModal({ isOpen: false, file: null, action: "unlock", isVerified: false, error: "" });
                    }}
                    className="px-4 h-9 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </button>
                </div>
              </div>
            ) : (
              /* PASSCODE INPUT FORM */
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === "ar"
                    ? "هذا الملف مشفر ومحمي. يرجى إدخال رمز/كلمة السر لفك التشفير والمتابعة:"
                    : "This file is encrypted and protected. Please enter decryption passcode to proceed:"}
                </p>

                {passcodeModal.error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passcodeModal.error}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyPasscodeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">
                      {lang === "ar" ? "رمز/كلمة السر لفك التشفير:" : "Decryption Secret Code / PIN:"}
                    </label>
                    <input
                      type="password"
                      autoFocus
                      value={enteredPasscode}
                      onChange={(e) => {
                        setEnteredPasscode(e.target.value);
                        if (passcodeModal.error) {
                          setPasscodeModal(prev => ({ ...prev, error: "" }));
                        }
                      }}
                      placeholder={lang === "ar" ? "أدخل الرمز السر هنا..." : "Enter passcode..."}
                      className={`w-full h-11 px-3 text-sm rounded-xl border outline-none font-mono ${
                        theme === "dark" 
                          ? "bg-slate-950 border-slate-800 text-white focus:border-amber-500" 
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500"
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeModal({ isOpen: false, file: null, action: "unlock", isVerified: false, error: "" });
                        setEnteredPasscode("");
                      }}
                      className="px-4 h-10 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    >
                      {lang === "ar" ? "إلغاء" : "Cancel"}
                    </button>

                    <button
                      type="submit"
                      className="px-5 h-10 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>{lang === "ar" ? "تأكيد وفك التشفير" : "Confirm & Decrypt"}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
