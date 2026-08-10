import { UserFile } from "../types.js";

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

export function openUserFileInNewTab(file: { fileName: string; fileUrl: string; mimeType?: string; [key: string]: any }) {
  if (!file || !file.fileUrl) {
    alert("رابط الملف غير متاح");
    return;
  }

  const fileName = file.fileName || "document";
  let mime = file.mimeType || "";
  if (!mime) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mime = "application/pdf";
    else if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "")) mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else if (["txt", "csv", "json", "xml", "html"].includes(ext || "")) mime = `text/${ext === "csv" ? "csv" : ext === "json" ? "json" : "plain"}`;
    else mime = "application/pdf"; // default assumption for verification documents
  }

  // Open blank window immediately to bypass popup blockers synchronously
  const win = window.open("about:blank", "_blank");

  if (!win) {
    // Fallback if popup blocked
    downloadUserFile(file);
    return;
  }

  try {
    win.document.title = fileName + " - معاينة المستند";
  } catch (e) {
    // Ignore cross-origin error
  }

  // 1. If HTTP or HTTPS URL (e.g. Firebase Storage)
  if (file.fileUrl.startsWith("http://") || file.fileUrl.startsWith("https://")) {
    fetch(file.fileUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const fileBlob = new Blob([blob], { type: mime || blob.type || "application/pdf" });
        const blobUrl = URL.createObjectURL(fileBlob);
        win.location.replace(blobUrl);
      })
      .catch(() => {
        win.location.replace(file.fileUrl);
      });
    return;
  }

  // 2. If Data URL or Base64 string
  const { blob, mime: detectedMime } = dataUrlToBlob(file.fileUrl, mime);
  if (blob.size > 0) {
    const finalMime = detectedMime || mime || "application/pdf";
    const fileBlob = new Blob([blob], { type: finalMime });
    const blobUrl = URL.createObjectURL(fileBlob);
    win.location.replace(blobUrl);
    return;
  }

  // 3. Fallback direct redirect
  win.location.replace(file.fileUrl);
}

export function downloadUserFile(file: { fileName: string; fileUrl: string; mimeType?: string; [key: string]: any }) {
  if (!file || !file.fileUrl) {
    alert("رابط الملف غير متاح");
    return;
  }

  const fileName = file.fileName || "downloaded_file";
  let mime = file.mimeType || "";
  if (!mime) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mime = "application/pdf";
    else if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "")) mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    else mime = "application/octet-stream";
  }

  let downloadUrl = file.fileUrl;

  if (file.fileUrl.startsWith("http://") || file.fileUrl.startsWith("https://")) {
    fetch(file.fileUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const fileBlob = new Blob([blob], { type: mime || blob.type || "application/octet-stream" });
        const blobUrl = URL.createObjectURL(fileBlob);
        triggerDownload(blobUrl, fileName);
      })
      .catch(() => {
        triggerDownload(file.fileUrl, fileName);
      });
    return;
  }

  const { blob } = dataUrlToBlob(file.fileUrl, mime);
  if (blob.size > 0) {
    const fileBlob = new Blob([blob], { type: mime || "application/octet-stream" });
    downloadUrl = URL.createObjectURL(fileBlob);
  }

  triggerDownload(downloadUrl, fileName);
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



