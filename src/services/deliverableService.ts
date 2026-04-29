import { isSupabaseConfigured, requireSupabase } from "../lib/supabaseClient";
import type { TaskDeliverable } from "../types";
import { logDataError } from "../utils/dataSafety";
import { deliverableFromDb, deliverableToDb, UUID_PATTERN } from "../utils/taskMapper";

const TASK_DELIVERABLE_STORAGE_KEY = "odakom_task_deliverables";
const LEGACY_APP_STORAGE_KEY = "odakom-oda-management-v1";
const deliverableColumns = "id,task_id,title,original_file_name,file_url,file_path,version,status,uploaded_at,is_visible_to_client";
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function debugLog(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  if (meta === undefined) console.log(message);
  else console.log(message, meta);
}

function debugError(message: string, error: unknown) {
  if (import.meta.env.DEV) console.error(message, error);
}

function deliverableKey(deliverable: TaskDeliverable) {
  return deliverable.filePath
    || `${deliverable.taskId}:${deliverable.originalFileName || deliverable.fileName || deliverable.title}:${deliverable.version}`;
}

function deduplicateDeliverables(deliverables: TaskDeliverable[]) {
  const seen = new Set<string>();
  const result: TaskDeliverable[] = [];
  for (const deliverable of deliverables) {
    const key = deliverableKey(deliverable);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(deliverable);
  }
  if (result.length !== deliverables.length) {
    console.warn(`Loaded ${deliverables.length} task deliverables, showing ${result.length} after duplicate cleanup.`);
  }
  return result;
}

function defaultTaskDeliverables() {
  return [];
}

function readLocalTaskDeliverables() {
  const raw = localStorage.getItem(TASK_DELIVERABLE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as TaskDeliverable[] : null;
  } catch {
    return null;
  }
}

function readLegacyTaskDeliverables() {
  const raw = localStorage.getItem(LEGACY_APP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.taskDeliverables) ? parsed.taskDeliverables as TaskDeliverable[] : null;
  } catch {
    return null;
  }
}

function writeLocalTaskDeliverables(deliverables: TaskDeliverable[]) {
  localStorage.setItem(TASK_DELIVERABLE_STORAGE_KEY, JSON.stringify(deliverables));
}

export function getInitialLocalTaskDeliverables() {
  const existing = readLocalTaskDeliverables();
  if (existing) return existing;
  const legacy = readLegacyTaskDeliverables();
  if (legacy && legacy.length > 0) {
    writeLocalTaskDeliverables(legacy);
    return legacy;
  }
  return defaultTaskDeliverables();
}

async function loadTaskDeliverablesFromSupabase() {
  const { data, error } = await requireSupabase().from("task_deliverables").select(deliverableColumns).order("uploaded_at", { ascending: true });
  if (error) throw error;
  return deduplicateDeliverables((data ?? []).map(deliverableFromDb));
}

async function saveTaskDeliverablesToSupabase(deliverables: TaskDeliverable[]) {
  const supabase = requireSupabase();
  if (deliverables.length === 0) return;
  const normalized = deduplicateDeliverables(deliverables).map((deliverable) => UUID_PATTERN.test(deliverable.id) ? deliverable : { ...deliverable, id: newId() });
  const { error } = await supabase.from("task_deliverables").upsert(normalized.map(deliverableToDb), { onConflict: "id" });
  if (error) throw error;
}

export async function getTaskDeliverables() {
  if (isSupabaseConfigured) {
    try {
      const deliverables = await loadTaskDeliverablesFromSupabase();
      if (deliverables.length > 0) {
        writeLocalTaskDeliverables(deliverables);
      }
      return deliverables;
    } catch (error) {
      debugError("Supabase task deliverables load failed.", error);
      logDataError("deliverables.load", error);
      throw error;
    }
  }
  return getInitialLocalTaskDeliverables();
}

export function getDeliverablesByTaskId(taskId: string, deliverables = getInitialLocalTaskDeliverables()) {
  return deliverables.filter((deliverable) => deliverable.taskId === taskId);
}

export async function saveTaskDeliverables(deliverables: TaskDeliverable[]) {
  writeLocalTaskDeliverables(deliverables);
  if (isSupabaseConfigured) await saveTaskDeliverablesToSupabase(deliverables);
}

export async function saveTaskDeliverablesForTask(taskId: string, nextTaskDeliverables: TaskDeliverable[]) {
  const localDeliverables = getInitialLocalTaskDeliverables();
  const normalizedTaskDeliverables = deduplicateDeliverables(nextTaskDeliverables).map((deliverable) => UUID_PATTERN.test(deliverable.id) ? deliverable : { ...deliverable, id: newId() });
  const nextIds = new Set(normalizedTaskDeliverables.map((deliverable) => deliverable.id));
  const previousForTask = localDeliverables.filter((deliverable) => deliverable.taskId === taskId);
  const deleteIds = previousForTask.map((deliverable) => deliverable.id).filter((id) => UUID_PATTERN.test(id) && !nextIds.has(id));
  const nextLocal = [
    ...localDeliverables.filter((deliverable) => deliverable.taskId !== taskId),
    ...normalizedTaskDeliverables
  ];

  writeLocalTaskDeliverables(nextLocal);

  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    if (deleteIds.length > 0) {
      const { error } = await supabase.from("task_deliverables").delete().in("id", deleteIds);
      if (error) {
        debugError("Task deliverables delete failed:", error);
        logDataError("deliverables.deleteForTask", error);
        throw error;
      }
    }
    if (normalizedTaskDeliverables.length > 0) {
      const { data, error } = await supabase
        .from("task_deliverables")
        .upsert(normalizedTaskDeliverables.map(deliverableToDb), { onConflict: "id" })
        .select(deliverableColumns);
      if (error) {
        debugError("Task deliverables save failed:", error);
        logDataError("deliverables.saveForTask", error);
        throw error;
      }
      debugLog("Task deliverables saved to Supabase:", data);
    }
  }

  return nextLocal;
}

export async function addTaskDeliverable(deliverable: TaskDeliverable) {
  const normalized = UUID_PATTERN.test(deliverable.id) ? deliverable : { ...deliverable, id: newId() };
  const deliverables = deduplicateDeliverables([...getInitialLocalTaskDeliverables(), normalized]);
  writeLocalTaskDeliverables(deliverables);
  if (isSupabaseConfigured) {
    const { error } = await requireSupabase().from("task_deliverables").insert(deliverableToDb(normalized));
    if (error) {
      logDataError("deliverables.add", error);
      throw error;
    }
  }
  return deliverables;
}

export async function updateTaskDeliverable(deliverableId: string, updates: Partial<TaskDeliverable>) {
  const deliverables = getInitialLocalTaskDeliverables().map((deliverable) => deliverable.id === deliverableId ? { ...deliverable, ...updates } : deliverable);
  writeLocalTaskDeliverables(deliverables);
  if (isSupabaseConfigured) {
    const target = deliverables.find((deliverable) => deliverable.id === deliverableId);
    if (target) {
      const { error } = await requireSupabase().from("task_deliverables").update(deliverableToDb(target)).eq("id", deliverableId);
      if (error) {
        logDataError("deliverables.update", error);
        throw error;
      }
    }
  }
  return deliverables;
}

export async function deleteTaskDeliverable(deliverableId: string) {
  const deliverables = getInitialLocalTaskDeliverables().filter((deliverable) => deliverable.id !== deliverableId);
  writeLocalTaskDeliverables(deliverables);
  if (isSupabaseConfigured) {
    const { error } = await requireSupabase().from("task_deliverables").delete().eq("id", deliverableId);
    if (error) {
      logDataError("deliverables.delete", error);
      throw error;
    }
  }
  return deliverables;
}

export async function toggleClientVisibility(deliverableId: string, isVisibleToClient: boolean) {
  return updateTaskDeliverable(deliverableId, { isVisibleToClient });
}

