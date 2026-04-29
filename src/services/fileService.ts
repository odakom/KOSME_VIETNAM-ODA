import type { TaskDeliverable } from "../types";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabaseClient";

export interface UploadedFileMeta {
  fileName: string;
  originalFileName: string;
  storedFileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  filePath: string;
  fileData: string;
  uploadedAt: string;
}

export const LOCAL_FILE_SIZE_LIMIT = 5 * 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

export function sanitizeFileName(fileName: string) {
  const extension = getFileExtension(fileName);
  const baseName = fileName.slice(0, extension ? -extension.length : undefined);
  return baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .toLowerCase();
}

export function buildStoragePath(taskId: string, fileName: string) {
  const timestamp = Date.now();
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  const extension = getFileExtension(fileName);
  const safeBaseName = sanitizeFileName(fileName) || "deliverable";
  const storedFileName = `${safeBaseName}_${timestamp}_${unique}${extension}`;
  return {
    filePath: `tasks/${taskId}/${storedFileName}`,
    storedFileName
  };
}

export async function uploadFileMock(file: File, taskId: string, uploadedBy: string): Promise<UploadedFileMeta & { taskId: string; uploadedBy: string }> {
  const { filePath, storedFileName } = buildStoragePath(taskId, file.name);

  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    const { error } = await supabase.storage.from("project-deliverables").upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });
    if (error) throw error;
    const { data } = supabase.storage.from("project-deliverables").getPublicUrl(filePath);
    return {
      taskId,
      uploadedBy,
      fileName: file.name,
      originalFileName: file.name,
      storedFileName,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      fileUrl: data.publicUrl,
      filePath,
      fileData: "",
      uploadedAt: new Date().toISOString()
    };
  }

  if (file.size > LOCAL_FILE_SIZE_LIMIT) {
    throw new Error("현재 로컬 버전에서는 5MB 이하 파일만 저장할 수 있습니다. 실제 운영 시 Supabase Storage 연결이 필요합니다.");
  }
  const fileData = await readFileAsDataUrl(file);
  return {
    taskId,
    uploadedBy,
    fileName: file.name,
    originalFileName: file.name,
    storedFileName,
    fileSize: file.size,
    fileType: file.type || "application/octet-stream",
    fileUrl: fileData,
    filePath: "",
    fileData,
    uploadedAt: new Date().toISOString()
  };
}

export async function deleteStorageFile(filePath?: string) {
  if (!filePath || !isSupabaseConfigured) return true;
  const { error } = await requireSupabase().storage.from("project-deliverables").remove([filePath]);
  if (error) throw error;
  return true;
}

export async function deleteFileMock(_deliverableId: string, filePath?: string) {
  return deleteStorageFile(filePath);
}

export function getFilesByTaskId(taskDeliverables: TaskDeliverable[], taskId: string) {
  return taskDeliverables.filter((deliverable) => deliverable.taskId === taskId);
}

function triggerAnchorDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function hasDownloadableFile(deliverable: Pick<TaskDeliverable, "fileData" | "fileUrl" | "filePath">) {
  return Boolean(deliverable.fileData || (deliverable.fileUrl && deliverable.fileUrl !== "#") || deliverable.filePath);
}

export async function getStorageDownloadUrl(filePath: string) {
  const storage = requireSupabase().storage.from("project-deliverables");
  const signed = await storage.createSignedUrl(filePath, 60);
  if (!signed.error && signed.data.signedUrl) return signed.data.signedUrl;
  const { data } = storage.getPublicUrl(filePath);
  if (data.publicUrl) return data.publicUrl;
  if (signed.error) throw signed.error;
  throw new Error("파일 다운로드 URL을 생성할 수 없습니다.");
}

export async function downloadFile(deliverable: Pick<TaskDeliverable, "fileData" | "fileUrl" | "filePath" | "fileName" | "originalFileName">) {
  const fileName = deliverable.originalFileName || deliverable.fileName || "download";
  try {
    if (deliverable.fileUrl && deliverable.fileUrl !== "#") {
      if (deliverable.fileUrl.startsWith("data:")) {
        triggerAnchorDownload(deliverable.fileUrl, fileName);
        return;
      }
      try {
        const response = await fetch(deliverable.fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        downloadBlob(await response.blob(), fileName);
      } catch {
        window.open(deliverable.fileUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (deliverable.fileData) {
      triggerAnchorDownload(deliverable.fileData, fileName);
      return;
    }
    if (deliverable.filePath && isSupabaseConfigured) {
      const url = await getStorageDownloadUrl(deliverable.filePath);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        downloadBlob(await response.blob(), fileName);
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    throw new Error("파일 원본 없음");
  } catch (error) {
    console.error("File download failed.", error);
    window.alert("파일 다운로드에 실패했습니다. 파일 원본 또는 Supabase Storage 권한을 확인해 주세요.");
  }
}

export function formatFileSize(size: number) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}
