import { UserFile } from "../types.js";
import { getFreshAuthToken } from "./apiUtils.js";

export function dataUrlToBlob(fileUrl: string, fallbackMime?: string): { blob: Blob; mime: string } {
  let url = (fileUrl || "").trim();
  let mime = fallbackMime || "";

  // If raw base64 string without data: header
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

export async function openUserFileInNewTab(file: { fileName?: string; fileUrl?: string; mimeType?: string; [key: string]: any }) {
  const fileId = file?.documentId || file?.id;
  const rawUrl = file?.fileUrl || (fileId ? `/api/auth/verification-document/${fileId}` : "");

  if (!rawUrl) {
    console.warn("File preview URL not available:", file);
    return;
  }

  const fileName = file.fileName || file.name || "document";
  let mime = file.mimeType || "";
  if (!mime) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mime = "application/pdf";
    else if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "")) mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else if (["txt", "csv", "json", "xml", "html"].includes(ext || "")) mime = `text/${ext === "csv" ? "csv" : ext === "json" ? "json" : "plain"}`;
    else mime = "application/pdf";
  }

  // 1. If Blob URL
  if (rawUrl.startsWith("blob:")) {
    window.open(rawUrl, "_blank");
    return;
  }

  // 2. If Data URL or Base64 string
  if (rawUrl.startsWith("data:")) {
    const { blob, mime: detectedMime } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }

  // 3. If relative or API route, or authenticated URL
  try {
    const token = await getFreshAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(rawUrl, { headers });
    if (res.ok) {
      const blob = await res.blob();
      const finalBlob = new Blob([blob], { type: mime || blob.type || "application/pdf" });
      const blobUrl = URL.createObjectURL(finalBlob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  } catch (err) {
    console.warn("Authenticated fetch error for file opening, opening directly:", err);
  }

  window.open(rawUrl, "_blank");
}

export async function downloadUserFile(file: { fileName?: string; fileUrl?: string; mimeType?: string; [key: string]: any }) {
  const fileId = file?.documentId || file?.id;
  const rawUrl = file?.fileUrl || (fileId ? `/api/auth/verification-document/${fileId}` : "");

  if (!rawUrl) {
    console.warn("File download URL not available:", file);
    return;
  }

  const fileName = file.fileName || file.name || "downloaded_file";
  let mime = file.mimeType || "";
  if (!mime) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mime = "application/pdf";
    else if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "")) mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else mime = "application/octet-stream";
  }

  if (rawUrl.startsWith("blob:")) {
    triggerDownload(rawUrl, fileName);
    return;
  }

  if (rawUrl.startsWith("data:")) {
    const { blob } = dataUrlToBlob(rawUrl, mime);
    if (blob.size > 0) {
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }

  try {
    const token = await getFreshAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(rawUrl, { headers });
    if (res.ok) {
      const blob = await res.blob();
      const finalBlob = new Blob([blob], { type: mime || blob.type || "application/octet-stream" });
      const blobUrl = URL.createObjectURL(finalBlob);
      triggerDownload(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  } catch (err) {
    console.warn("Download fetch error:", err);
  }

  triggerDownload(rawUrl, fileName);
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



