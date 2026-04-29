import { isSupabaseConfigured, requireSupabase } from "../lib/supabaseClient";
import type { ClientComment, ReviewStatus } from "../types";
import { logDataError } from "../utils/dataSafety";
import { commentFromDb, commentToDb, UUID_PATTERN } from "../utils/taskMapper";

const COMMENT_STORAGE_KEY = "odakom_comments";
const LEGACY_APP_STORAGE_KEY = "odakom-oda-management-v1";
const commentColumns = "id,target_type,target_id,target_title,author_name,author_role,content,status,response,created_at";
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function debugLog(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  if (meta === undefined) console.log(message);
  else console.log(message, meta);
}

function debugError(message: string, error: unknown) {
  if (import.meta.env.DEV) console.error(message, error);
}

function normalizeComment(comment: Partial<ClientComment> & Record<string, unknown> | ClientComment): ClientComment {
  const raw = comment as Partial<ClientComment> & Record<string, unknown>;
  const createdAt = String(raw.createdAt ?? raw.created_at ?? new Date().toISOString());
  return {
    id: String(raw.id ?? `com-${Date.now()}`),
    targetType: (raw.targetType ?? raw.target_type ?? "project") as ClientComment["targetType"],
    targetId: String(raw.targetId ?? raw.target_id ?? ""),
    targetTitle: String(raw.targetTitle ?? raw.target_title ?? "프로젝트 전체"),
    authorName: String(raw.authorName ?? raw.author_name ?? raw.author ?? "발주처"),
    authorRole: (raw.authorRole ?? raw.author_role ?? "client") as ClientComment["authorRole"],
    content: String(raw.content ?? ""),
    status: (raw.status ?? "접수") as ClientComment["status"],
    createdAt,
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? createdAt),
    response: String(raw.response ?? raw.reply ?? raw.actionTaken ?? ""),
    respondedBy: String(raw.respondedBy ?? raw.responded_by ?? ""),
    respondedAt: String(raw.respondedAt ?? raw.responded_at ?? raw.completedAt ?? ""),
    reflectedLocation: String(raw.reflectedLocation ?? raw.reflected_location ?? ""),
    holdReason: String(raw.holdReason ?? raw.hold_reason ?? "")
  };
}

function readLocalComments(): ClientComment[] | null {
  const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeComment) : null;
  } catch {
    return null;
  }
}

function readLegacyComments(): ClientComment[] | null {
  const raw = localStorage.getItem(LEGACY_APP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.comments) ? parsed.comments.map(normalizeComment) : null;
  } catch {
    return null;
  }
}

function writeLocalComments(comments: ClientComment[]) {
  localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(comments));
}

function commentUpdatesToDb(updates: Partial<ClientComment>) {
  const payload: Record<string, unknown> = {
    target_type: updates.targetType,
    target_id: updates.targetId,
    target_title: updates.targetTitle,
    author_name: updates.authorName,
    author_role: updates.authorRole,
    content: updates.content,
    status: updates.status,
    response: updates.response,
    responded_by: updates.respondedBy,
    responded_at: updates.respondedAt || null,
    reflected_location: updates.reflectedLocation,
    hold_reason: updates.holdReason,
    updated_at: updates.updatedAt ?? new Date().toISOString()
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  return payload;
}

export function getInitialLocalComments(): ClientComment[] {
  const existing = readLocalComments();
  if (existing) return existing;
  const legacy = readLegacyComments();
  if (legacy && legacy.length > 0) {
    writeLocalComments(legacy);
    return legacy;
  }
  return [];
}

async function loadCommentsFromSupabaseInternal(): Promise<ClientComment[]> {
  const { data, error } = await requireSupabase().from("comments").select(commentColumns).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(commentFromDb);
}

async function saveCommentsToSupabaseInternal(comments: ClientComment[]) {
  if (comments.length === 0) return;
  const normalized = comments.map((comment) => UUID_PATTERN.test(comment.id) ? comment : { ...comment, id: newId() });
  const { error } = await requireSupabase().from("comments").upsert(normalized.map((comment) => commentToDb(comment)), { onConflict: "id" });
  if (error) throw error;
}

export async function getComments(): Promise<ClientComment[]> {
  if (isSupabaseConfigured) {
    try {
      const comments = await loadCommentsFromSupabaseInternal();
      writeLocalComments(comments);
      return comments;
    } catch (error) {
      debugError("Supabase comments load failed.", error);
      logDataError("comments.load", error);
      throw error;
    }
  }
  return getInitialLocalComments();
}

export function getCommentsByTarget(targetType: ClientComment["targetType"], targetId: string, comments: ClientComment[] = getInitialLocalComments()) {
  return comments.filter((comment) => comment.targetType === targetType && comment.targetId === targetId);
}

export async function saveComments(comments: ClientComment[]) {
  const normalized = comments.map((comment) => normalizeComment(comment));
  writeLocalComments(normalized);
  if (isSupabaseConfigured) await saveCommentsToSupabaseInternal(normalized);
}

export async function addComment(comment: ClientComment) {
  const normalized = normalizeComment({ ...comment, id: UUID_PATTERN.test(comment.id) ? comment.id : newId() });
  if (isSupabaseConfigured) {
    const { data, error } = await requireSupabase().from("comments").insert(commentToDb(normalized)).select(commentColumns).single();
    if (error) {
      debugError("Failed to save comment:", error);
      logDataError("comments.add", error);
      throw error;
    }
    debugLog("Saved comment id:", data?.id);
    return getComments();
  }
  const comments = [...getInitialLocalComments(), normalized];
  writeLocalComments(comments);
  debugLog("Saved comment id:", normalized.id);
  return comments;
}

export async function updateComment(commentId: string, updates: Partial<ClientComment>) {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    if (!UUID_PATTERN.test(commentId)) return getComments();
    const { error } = await requireSupabase().from("comments").update(commentUpdatesToDb({ ...updates, updatedAt: now })).eq("id", commentId);
    if (error) {
      logDataError("comments.update", error);
      throw error;
    }
    return getComments();
  }
  const comments = getInitialLocalComments().map((comment) => comment.id === commentId ? normalizeComment({ ...comment, ...updates, updatedAt: now }) : comment);
  writeLocalComments(comments);
  return comments;
}

export async function deleteComment(commentId: string) {
  if (isSupabaseConfigured && UUID_PATTERN.test(commentId)) {
    const { error } = await requireSupabase().from("comments").delete().eq("id", commentId);
    if (error) {
      logDataError("comments.delete", error);
      throw error;
    }
    return getComments();
  }
  const comments = getInitialLocalComments().filter((comment) => comment.id !== commentId);
  writeLocalComments(comments);
  return comments;
}

export async function updateCommentStatus(commentId: string, status: ReviewStatus) {
  return updateComment(commentId, { status });
}

export async function loadCommentsFromSupabase() {
  if (!isSupabaseConfigured) return null;
  return loadCommentsFromSupabaseInternal();
}

export async function saveCommentsToSupabase(comments: ClientComment[]) {
  if (!isSupabaseConfigured) return;
  return saveCommentsToSupabaseInternal(comments);
}
