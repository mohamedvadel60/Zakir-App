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

function detectMimeType(fileName: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime !== "application/octet-stream") return fallbackMime;
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(ext || "")) return "image/jpeg";
  if (["png", "webp", "gif", "svg"].includes(ext || "")) return `image/${ext}`;
  if (["txt", "csv", "json", "xml", "html"].includes(ext || "")) return `text/${ext === "csv" ? "csv" : ext === "json" ? "json" : "plain"}`;
  if (["doc", "docx"].includes(ext || "")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (["xls", "xlsx"].includes(ext || "")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return fallbackMime || "application/pdf";
}

/**
 * Open a user or verification document in a new browser tab for clean Preview.
 * Authenticated API endpoints and Firebase Storage URLs are handled correctly.
 */
export async function openUserFileInNewTab(file: { fileName?: string; name?: string; fileUrl?: string; url?: string; documentId?: string; id?: string; mimeType?: string; type?: string; [key: string]: any }) {
  const fileId = file?.documentId || file?.id || file?.fileId;
  const rawUrl = file?.fileUrl || file?.url || (fileId ? `/api/auth/verification-document/${encodeURIComponent(fileId)}` : "");

  if (!rawUrl && !fileId) {
    alert("رابط الملف أو المعاينة غير متوفر حاليًا.");
    return;
  }

  const fileName = file.fileName || file.name || "document";
  const mime = detectMimeType(fileName, file.mimeType || file.type);

  // 1. Blob URL
  if (rawUrl.startsWith("blob:")) {
    window.open(rawUrl, "_blank");
    return;
  }

  // 2. Data URL / Base64
  if (rawUrl.startsWith("data:")) {
    const { blob } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }

  // 3. Direct External HTTP/HTTPS URL (e.g. Firebase Storage)
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      // Fetch without Authorization header to avoid CORS rejection from Google Storage
      const res = await fetch(rawUrl);
      if (res.ok) {
        const blob = await res.blob();
        const finalBlob = new Blob([blob], { type: res.headers.get("content-type") || mime });
        const blobUrl = URL.createObjectURL(finalBlob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
    } catch (e) {
      console.warn("Direct HTTP fetch failed, attempting API proxy or direct tab:", e);
    }

    // Fallback: If direct fetch failed and fileId exists, use API proxy route
    if (fileId) {
      const proxyUrl = `/api/auth/verification-document/${encodeURIComponent(fileId)}`;
      try {
        const token = await getFreshAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(proxyUrl, { headers });
        if (res.ok) {
          const blob = await res.blob();
          const finalBlob = new Blob([blob], { type: res.headers.get("content-type") || mime });
          const blobUrl = URL.createObjectURL(finalBlob);
          window.open(blobUrl, "_blank");
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch (e) {}
    }

    window.open(rawUrl, "_blank");
    return;
  }

  // 4. Authenticated API Endpoint
  const apiRoute = rawUrl.startsWith("/") ? rawUrl : `/api/auth/verification-document/${encodeURIComponent(fileId || "")}`;
  try {
    const token = await getFreshAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(apiRoute, { headers });
    if (res.ok) {
      const blob = await res.blob();
      const responseMime = res.headers.get("content-type") || mime;
      const finalBlob = new Blob([blob], { type: responseMime });
      const blobUrl = URL.createObjectURL(finalBlob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } else {
      const errJson = await res.json().catch(() => ({}));
      alert(errJson.message || errJson.error || "تعذر معاينة الملف. يرجى التحقق من صلاحيات الوصول.");
      return;
    }
  } catch (err) {
    console.error("API preview error:", err);
    alert("حدث خطأ أثناء الاتصال بالخادم لمعاينة الملف.");
  }
}

/**
 * Download a file with guaranteed original filename and MIME type.
 * Converts cross-origin or API responses to local Blob URLs for genuine browser file downloading.
 */
export async function downloadUserFile(file: { fileName?: string; name?: string; fileUrl?: string; url?: string; documentId?: string; id?: string; mimeType?: string; type?: string; [key: string]: any }) {
  const fileId = file?.documentId || file?.id || file?.fileId;
  const rawUrl = file?.fileUrl || file?.url || (fileId ? `/api/auth/verification-document/${encodeURIComponent(fileId)}?download=true` : "");

  if (!rawUrl && !fileId) {
    alert("رابط تنزيل الملف غير متوفر.");
    return;
  }

  const fileName = file.fileName || file.name || "downloaded_file";
  const mime = detectMimeType(fileName, file.mimeType || file.type);

  // 1. Blob URL
  if (rawUrl.startsWith("blob:")) {
    triggerDownload(rawUrl, fileName);
    return;
  }

  // 2. Data URL / Base64
  if (rawUrl.startsWith("data:")) {
    const { blob } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }

  // 3. Direct External HTTP/HTTPS URL
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      const res = await fetch(rawUrl);
      if (res.ok) {
        const blob = await res.blob();
        const finalBlob = new Blob([blob], { type: res.headers.get("content-type") || mime });
        const blobUrl = URL.createObjectURL(finalBlob);
        triggerDownload(blobUrl, fileName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
    } catch (e) {
      console.warn("Direct HTTP download fetch failed, attempting API proxy:", e);
    }

    if (fileId) {
      const proxyUrl = `/api/auth/verification-document/${encodeURIComponent(fileId)}?download=true`;
      try {
        const token = await getFreshAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(proxyUrl, { headers });
        if (res.ok) {
          const blob = await res.blob();
          const finalBlob = new Blob([blob], { type: res.headers.get("content-type") || mime });
          const blobUrl = URL.createObjectURL(finalBlob);
          triggerDownload(blobUrl, fileName);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch (e) {}
    }

    triggerDownload(rawUrl, fileName);
    return;
  }

  // 4. Authenticated API Endpoint
  const apiRoute = rawUrl.startsWith("/")
    ? (rawUrl.includes("?") ? `${rawUrl}&download=true` : `${rawUrl}?download=true`)
    : `/api/auth/verification-document/${encodeURIComponent(fileId || "")}?download=true`;

  try {
    const token = await getFreshAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(apiRoute, { headers });
    if (res.ok) {
      const blob = await res.blob();
      const finalBlob = new Blob([blob], { type: res.headers.get("content-type") || mime });
      const blobUrl = URL.createObjectURL(finalBlob);
      triggerDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } else {
      const errJson = await res.json().catch(() => ({}));
      alert(errJson.message || errJson.error || "تعذر تنزيل الملف. يرجى التحقق من صلاحيات الوصول.");
      return;
    }
  } catch (err) {
    console.error("API download error:", err);
    alert("حدث خطأ أثناء تنزيل الملف.");
  }
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
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
