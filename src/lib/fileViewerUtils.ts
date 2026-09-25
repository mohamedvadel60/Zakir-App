import { getFreshAuthToken } from "./apiUtils.js";

export function dataUrlToBlob(fileUrl: string, fallbackMime?: string): { blob: Blob; mime: string } {
  let url = (fileUrl || "").trim();
  let mime = fallbackMime || "";

  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:") && !url.startsWith("blob:")) {
    url = `data:${mime || "application/pdf"};base64,` + url;
  }

  if (url.startsWith("data:")) {
    try {
      const parts = url.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        mime = mimeMatch[1];
      }
      const base64Data = parts[1] || "";
      const bstr = atob(base64Data);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const finalMime = mime || fallbackMime || "application/pdf";
      return { blob: new Blob([u8arr], { type: finalMime }), mime: finalMime };
    } catch (e) {
      console.warn("Failed to convert data URL to Blob:", e);
    }
  }

  return { blob: new Blob([], { type: mime || fallbackMime || "application/pdf" }), mime: mime || fallbackMime || "application/pdf" };
}

export function detectMimeType(fileName: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime !== "application/octet-stream" && fallbackMime !== "") return fallbackMime;
  const cleanName = (fileName || "").trim().toLowerCase();
  const ext = cleanName.split(".").pop() || "";
  
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (["png", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext)) return `image/${ext === "svg" ? "svg+xml" : ext === "ico" ? "x-icon" : ext}`;
  if (["txt", "log"].includes(ext)) return "text/plain";
  if (ext === "csv") return "text/csv";
  if (ext === "json") return "application/json";
  if (["xml", "html", "htm"].includes(ext)) return `text/${ext === "xml" ? "xml" : "html"}`;
  if (["doc", "docx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (["xls", "xlsx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (["ppt", "pptx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "application/zip";
  
  return fallbackMime || "application/pdf";
}

/**
 * Fetch a file as a Blob using authenticated Bearer token when required.
 */
export async function fetchFileAsBlob(file: { fileName?: string; name?: string; fileUrl?: string; url?: string; documentId?: string; id?: string; mimeType?: string; type?: string; [key: string]: any }): Promise<{ blob: Blob; mime: string; fileName: string }> {
  const fileId = file?.documentId || file?.id || file?.fileId;
  const rawUrl = file?.fileUrl || file?.url || (fileId ? `/api/auth/verification-document/${encodeURIComponent(fileId)}` : "");
  const fileName = file.fileName || file.name || "document";
  const expectedMime = detectMimeType(fileName, file.mimeType || file.type);

  if (!rawUrl && !fileId) {
    throw new Error("رابط الملف غير متوفر.");
  }

  // 1. Data URL / Base64
  if (rawUrl.startsWith("data:")) {
    const { blob, mime } = dataUrlToBlob(rawUrl, expectedMime);
    return { blob, mime, fileName };
  }

  // 2. Blob URL
  if (rawUrl.startsWith("blob:")) {
    try {
      const res = await fetch(rawUrl);
      if (res.ok) {
        const b = await res.blob();
        return { blob: b, mime: b.type || expectedMime, fileName };
      }
    } catch (e) {}
  }

  // 3. Direct HTTP/HTTPS URL
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      const res = await fetch(rawUrl);
      if (res.ok) {
        const b = await res.blob();
        const detectedMime = res.headers.get("content-type") || expectedMime;
        return { blob: new Blob([b], { type: detectedMime }), mime: detectedMime, fileName };
      }
    } catch (e) {
      console.warn("Direct HTTP fetch failed, attempting API proxy:", e);
    }
  }

  // 4. Authenticated API Endpoint
  const apiRoute = rawUrl.startsWith("/")
    ? rawUrl
    : `/api/auth/verification-document/${encodeURIComponent(fileId || "")}`;

  const token = await getFreshAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(apiRoute, { headers });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.message || errJson.error || `Failed to fetch file (HTTP ${res.status})`);
  }

  const b = await res.blob();
  const detectedMime = res.headers.get("content-type") || expectedMime;
  return { blob: new Blob([b], { type: detectedMime }), mime: detectedMime, fileName };
}

/**
 * Open a user or verification document in a new browser tab for clean Preview.
 * Authenticated API endpoints and Firebase Storage URLs are handled correctly.
 */
export async function openUserFileInNewTab(file: { fileName?: string; name?: string; fileUrl?: string; url?: string; documentId?: string; id?: string; mimeType?: string; type?: string; [key: string]: any }) {
  const fileName = file.fileName || file.name || "document";
  const rawUrl = file?.fileUrl || file?.url || "";

  // If already a direct blob URL, open immediately in the current user gesture
  if (rawUrl.startsWith("blob:")) {
    window.open(rawUrl, "_blank");
    return;
  }

  // If Data URL
  if (rawUrl.startsWith("data:")) {
    const mime = detectMimeType(fileName, file.mimeType || file.type);
    const { blob } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      return;
    }
  }

  // Pre-open a tab to bypass aggressive browser popup blockers on async fetch
  let popupWindow: Window | null = null;
  try {
    popupWindow = window.open("", "_blank");
    if (popupWindow) {
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Zakir - Loading Document...</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body style="margin:0; background:#0B0F19; color:#94A3B8; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
            <div style="text-align:center;">
              <div style="width:36px; height:36px; border:3px solid #3B82F6; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 16px;"></div>
              <p style="font-size:14px; margin:0;">جاري تحميل المستند بأمان...</p>
              <p style="font-size:12px; color:#64748B; margin:6px 0 0;">${fileName}</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
          </body>
        </html>
      `);
    }
  } catch (e) {
    popupWindow = null;
  }

  try {
    const { blob, mime } = await fetchFileAsBlob(file);
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: mime }));

    if (popupWindow && !popupWindow.closed) {
      popupWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } catch (err: any) {
    console.error("openUserFileInNewTab error:", err);
    if (popupWindow && !popupWindow.closed) {
      popupWindow.document.body.innerHTML = `
        <div style="text-align:center; padding:20px; font-family:sans-serif; color:#EF4444; background:#0B0F19; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <p style="font-size:16px; font-weight:bold; margin-bottom:8px;">تعذر معاينة المستند</p>
          <p style="font-size:13px; color:#94A3B8;">${err?.message || "يرجى التحقق من صلاحيات الوصول أو إعادة المحاولة."}</p>
        </div>
      `;
    } else {
      alert(err?.message || "تعذر معاينة الملف. يرجى التحقق من صلاحيات الوصول.");
    }
  }
}

/**
 * Download a file with guaranteed original filename and MIME type.
 * Converts cross-origin or API responses to local Blob URLs for genuine browser file downloading.
 */
export async function downloadUserFile(file: { fileName?: string; name?: string; fileUrl?: string; url?: string; documentId?: string; id?: string; mimeType?: string; type?: string; [key: string]: any }) {
  const fileName = file.fileName || file.name || "downloaded_file";
  const rawUrl = file?.fileUrl || file?.url || "";

  // 1. Direct Blob URL
  if (rawUrl.startsWith("blob:")) {
    triggerDownload(rawUrl, fileName);
    return;
  }

  // 2. Data URL / Base64
  if (rawUrl.startsWith("data:")) {
    const mime = detectMimeType(fileName, file.mimeType || file.type);
    const { blob } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }

  try {
    const { blob, mime } = await fetchFileAsBlob(file);
    const finalBlob = new Blob([blob], { type: mime });
    const blobUrl = URL.createObjectURL(finalBlob);
    triggerDownload(blobUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err: any) {
    console.error("downloadUserFile error:", err);
    alert(err?.message || "حدث خطأ أثناء تنزيل الملف.");
  }
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (url.startsWith("blob:")) {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

export function openOrDownloadUserFile(file: { fileName: string; fileUrl: string; mimeType?: string; [key: string]: any }) {
  openUserFileInNewTab(file);
}
