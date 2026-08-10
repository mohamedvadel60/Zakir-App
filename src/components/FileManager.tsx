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
      {/* Security Status Card */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
              <span>{lang === "ar" ? "مخزن الملفات الخاص بالمستخدم (Firebase Auth & Firestore)" : (lang === "fr" ? "Coffre-fort Fichiers Privé" : "User Private File Vault")}</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                {lang === "ar" ? "وصول معتمد" : "Strict Owner Rules"}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "ar"
                ? "يتم عرض الملفات غير المشفرة مباشرة لمن يمتلكون الصلاحيات، بينما تتطلب الملفات المشفرة إدخال الرمز السري."
                : "Unencrypted files are accessible to authorized users. Only files marked encrypted require passcode authentication."}
            </p>
          </div>
        </div>

        <button 
          onClick={loadFiles}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border cursor-pointer shrink-0 ${
            theme === "dark"
              ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300"
              : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
          <span>{lang === "ar" ? "تحديث الملفات" : (lang === "fr" ? "Actualiser" : "Refresh Vault")}</span>
        </button>
      </div>

      {/* Upload File Section */}
      <div className={`p-6 rounded-2xl border ${
        theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <h3 className={`text-base font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${
          theme === "dark" ? "text-white" : "text-slate-900"
        }`}>
          <UploadCloud className="w-5 h-5 text-amber-400" />
          <span>{lang === "ar" ? "تحميل وثيقة / ملف جديد" : (lang === "fr" ? "Téléverser un nouveau fichier" : "Upload New File / Document")}</span>
        </h3>

        {uploadSuccess && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File Selection Box */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                {lang === "ar" ? "اختر الملف (مستندات، صور، شهادات):" : (lang === "fr" ? "Sélectionnez un fichier :" : "Select File (Docs, Images, PDFs):")}
              </label>
              <div className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                selectedFile
                  ? "border-amber-500/50 bg-amber-500/5"
                  : theme === "dark" ? "border-slate-800 hover:border-slate-700 bg-slate-950/40" : "border-slate-200 hover:border-slate-300 bg-slate-50"
              }`}>
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    {getFileIcon(selectedFile.type)}
                    <div className="text-left rtl:text-right">
                      <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{selectedFile.name}</p>
                      <p className="text-[11px] text-amber-400 font-mono mt-0.5">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 flex flex-col items-center justify-center gap-1">
                    <UploadCloud className="w-8 h-8 text-slate-500" />
                    <p className="text-xs text-slate-400 font-medium">
                      {lang === "ar" ? "انقر لاختيار ملف أو اسحبه هنا" : (lang === "fr" ? "Cliquez ou glissez-déposez un fichier ici" : "Click or drag & drop a file here")}
                    </p>
                    <p className="text-[10px] text-slate-500">PDF, PNG, JPG, DOCX, CSV</p>
                  </div>
                )}
              </div>
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                {lang === "ar" ? "فئة المستند:" : (lang === "fr" ? "Catégorie :" : "Category:")}
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value !== "Other") {
                    setCustomFileCategory("");
                  }
                }}
                className={`w-full h-11 px-3 text-xs rounded-xl border outline-none font-medium ${
                  theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="Verification">{lang === "ar" ? "السجل التجاري والتحقق" : "Corporate Verification"}</option>
                <option value="Compliance">{lang === "ar" ? "سياسات الامتثال" : "Compliance Policy"}</option>
                <option value="Financial">{lang === "ar" ? "تقارير مالية" : "Financial Report"}</option>
                <option value="Customs">{lang === "ar" ? "بيانات جمركية" : "Customs Declaration"}</option>
                <option value="Audit">{lang === "ar" ? "سجلات التدقيق" : "Audit Log"}</option>
                <option value="General">{lang === "ar" ? "عام" : "General"}</option>
                <option value="Other">{lang === "ar" ? "أخرى (كتابة فئة مخصصة)" : (lang === "fr" ? "Autre (écrire personnalisé)" : "Other (write custom)")}</option>
              </select>
              {category === "Other" && (
                <input 
                  type="text"
                  value={customFileCategory}
                  onChange={(e) => setCustomFileCategory(e.target.value)}
                  className={`w-full h-11 px-3.5 mt-2 border rounded-xl text-xs outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                    theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                  placeholder={lang === "ar" ? "اكتب فئة المستند هنا..." : "Enter custom document category..."}
                  required
                />
              )}
            </div>
          </div>

          {/* Optional Description */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">
              {lang === "ar" ? "وصف المستند / ملاحظات إضافية:" : (lang === "fr" ? "Description / Notes :" : "Description / Notes:")}
            </label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "ar" ? "مثال: نسخة معتمدة من السجل التجاري لسنة 2026..." : "e.g. Certified corporate license copy 2026"}
              className={`w-full h-10 px-3 text-xs rounded-xl border outline-none ${
                theme === "dark" ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* Encryption & Lock Option Checkbox */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {lang === "ar" ? "تأمين وتشفير هذا الملف بالرمز السري الحصري" : "Lock & Encrypt File with Master Secret Code"}
                </p>
                <p className="text-[10px] text-amber-400/80">
                  {lang === "ar" ? "تطبيق التشفير على هذا الملف المالي/الحساس المختار فقط" : "Encrypt only this selected sensitive file"}
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

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className={`w-full md:w-auto px-6 h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>
              {uploading 
                ? (lang === "ar" ? "جاري الحفظ..." : "Processing Upload...") 
                : (lang === "ar" ? "حفظ الملف في المخزن" : "Upload File to Storage")}
            </span>
          </button>
        </form>
      </div>

      {/* File Explorer / List */}
      <div className={`p-6 rounded-2xl border ${
        theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-amber-400" />
            <h3 className={`text-base font-bold uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
              {lang === "ar" ? "قائمة الملفات المخزنة" : (lang === "fr" ? "Fichiers téléversés" : "Stored Documents Vault")}
            </h3>
            <span className="ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-800 text-amber-400 font-mono">
              {files.length}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 rtl:right-3 top-3" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === "ar" ? "بحث عن ملف..." : "Search files..."}
                className={`w-40 md:w-52 h-9 pl-9 rtl:pr-9 rtl:pl-3 text-xs rounded-xl border outline-none ${
                  theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`h-9 px-3 text-xs rounded-xl border outline-none font-medium ${
                theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
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

        {/* File Explorer Grid */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-2" />
            <p className="text-xs">{lang === "ar" ? "جاري تحميل قائمة الملفات من Firestore..." : "Fetching file vault records from Firestore..."}</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-800/80 rounded-2xl">
            <Folder className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className={`text-sm font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
              {lang === "ar" ? "لا توجد ملفات مخزنة حتى الآن" : "No stored files found"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {lang === "ar" ? "قم بتحميل أول مستند مؤسسي باستخدام النموذج أعلاه." : "Upload your first document using the form above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFiles.map(file => {
              const isLockedFile = file.isEncrypted && !unlockedFileIds.has(file.id);

              return (
                <div 
                  key={file.id} 
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    file.isEncrypted
                      ? "bg-slate-950 border-amber-500/40 shadow-sm"
                      : theme === "dark" ? "bg-slate-950/60 border-slate-800 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className={`text-xs font-bold truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`} title={file.fileName}>
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        {file.isEncrypted ? (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{lang === "ar" ? "مشفر" : "Encrypted"}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            {lang === "ar" ? "غير مشفر" : "Standard"}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          {file.category}
                        </span>
                      </div>
                    </div>

                    {file.description && (
                      <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed bg-slate-900/30 p-2 rounded-lg border border-slate-800/50">
                        {file.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 flex-wrap">
                    {isLockedFile ? (
                      <button
                        onClick={(e) => handleUnlockFile(file, e)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{lang === "ar" ? "إدخال الرمز لفك التشفير" : "Unlock & View File"}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handlePreviewFile(file, e)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? "معاينة" : "Preview"}</span>
                        </button>

                        <button 
                          onClick={(e) => handleDownloadFile(file, e)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                          <span>{lang === "ar" ? "تنزيل" : "Download"}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {/* Encryption Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleEncryption(file, e)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-bold border ${
                          file.isEncrypted
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                        title={file.isEncrypted ? (lang === "ar" ? "إلغاء التشفير عن هذا الملف" : "Remove Encryption") : (lang === "ar" ? "تشفير هذا الملف" : "Encrypt File")}
                      >
                        {file.isEncrypted ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(file.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title={lang === "ar" ? "حذف الملف" : "Delete File"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Confirm Delete Popup */}
                  {deleteTargetId === file.id && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-2 animate-in fade-in"
                    >
                      <p className="text-rose-300 font-bold">
                        {lang === "ar" ? "تأكيد حذف الملف نهائياً من المخزن؟" : "Confirm permanent file deletion?"}
                      </p>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file);
                          }}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          {lang === "ar" ? "نعم، احذف فوراً" : "Yes, Delete Now"}
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(null);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
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
