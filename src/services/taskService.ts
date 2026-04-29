import { initialData } from "../data/sampleData";
import { isSupabaseConfigured, requireSupabase, supabaseConfigStatus } from "../lib/supabaseClient";
import type { Task } from "../types";
import { backupTasks, logDataError, validateTasks } from "../utils/dataSafety";
import { fromDb, toDb, updatesToDb, UUID_PATTERN } from "../utils/taskMapper";

const taskColumns = "id,title,description,group_name,assignee,status,start_date,due_date,is_visible_to_client";
const TASK_STORAGE_KEY = "odakom_tasks";
const TASK_DEBUG_KEY = "odakom_tasks_debug";
const LEGACY_APP_STORAGE_KEY = "odakom-oda-management-v1";
const TASK_SEEDED_KEY = "tasks_seeded";

export type TaskDataSource = "Supabase" | "localStorage" | "defaultTasks";

function debugLog(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  if (meta === undefined) console.log(message);
  else console.log(message, meta);
}

function debugError(message: string, error: unknown) {
  if (import.meta.env.DEV) console.error(message, error);
}

function defaultTasks() {
  return initialData.tasks.map((task) => ({ ...task }));
}

function setTaskDebug(source: TaskDataSource, count: number) {
  localStorage.setItem(TASK_DEBUG_KEY, JSON.stringify({
    source,
    lastSavedAt: new Date().toISOString(),
    count
  }));
}

export function getTaskDebugInfo() {
  const raw = localStorage.getItem(TASK_DEBUG_KEY);
  if (!raw) return { source: "defaultTasks" as TaskDataSource, lastSavedAt: "-", count: 0 };
  try {
    return JSON.parse(raw) as { source: TaskDataSource; lastSavedAt: string; count: number };
  } catch {
    return { source: "defaultTasks" as TaskDataSource, lastSavedAt: "-", count: 0 };
  }
}

function readLocalTasks() {
  const raw = localStorage.getItem(TASK_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Task[] : null;
  } catch {
    return null;
  }
}

function readLegacyTasks() {
  const raw = localStorage.getItem(LEGACY_APP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.tasks) ? parsed.tasks as Task[] : null;
  } catch {
    return null;
  }
}

function writeLocalTasks(tasks: Task[], source: TaskDataSource = "localStorage") {
  if (!tasks.length) return;
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  backupTasks(tasks);
  setTaskDebug(source, tasks.length);
}

function getEditableLocalTasks() {
  return readLocalTasks() ?? (isSupabaseConfigured ? [] : defaultTasks());
}

export function getInitialLocalTasks() {
  const existing = readLocalTasks();
  if (existing) {
    setTaskDebug("localStorage", existing.length);
    return existing;
  }
  const legacy = readLegacyTasks();
  if (legacy && legacy.length > 0) {
    writeLocalTasks(legacy, "localStorage");
    return legacy;
  }
  return defaultTasks();
}

function logSupabaseTaskConfig() {
  debugLog("Supabase URL:", supabaseConfigStatus.hasUrl);
}

function deduplicateTasks(tasks: Task[]) {
  const seen = new Set<string>();
  const deduplicated: Task[] = [];
  for (const task of tasks) {
    const key = task.title.trim() || task.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(task);
  }
  if (deduplicated.length !== tasks.length) {
    console.warn(`Loaded ${tasks.length} tasks from Supabase, showing ${deduplicated.length} unique tasks after duplicate-title cleanup.`);
  }
  return deduplicated;
}

export async function loadTasksFromSupabase() {
  if (!isSupabaseConfigured) return null;
  logSupabaseTaskConfig();
  debugLog("Loading tasks from Supabase...");
  const { data, error } = await requireSupabase().from("tasks").select(taskColumns).order("due_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  debugLog("Loaded tasks count:", data?.length ?? 0);
  const tasks = deduplicateTasks((data ?? []).map(fromDb));
  validateTasks(tasks);
  return tasks;
}

export async function seedDefaultTasksIfEmpty() {
  if (!isSupabaseConfigured) {
    logSupabaseTaskConfig();
    throw new Error("Supabase ?섍꼍蹂?섍? ?ㅼ젙?섏? ?딆븯?듬땲??");
  }

  logSupabaseTaskConfig();
  debugLog("Loading tasks from Supabase...");
  const supabase = requireSupabase();
  const { data: existing, error: selectError } = await supabase.from("tasks").select(taskColumns).order("due_date", { ascending: true }).order("created_at", { ascending: true });
  if (selectError) {
    debugError("Seed failed:", selectError);
    throw selectError;
  }

  debugLog("Loaded tasks count:", existing?.length ?? 0);
  const existingCount = existing?.length ?? 0;
  if (existingCount > 0) {
    const tasks = deduplicateTasks((existing ?? []).map(fromDb));
    validateTasks(tasks);
    writeLocalTasks(tasks, "Supabase");
    return tasks;
  }

  if (localStorage.getItem(TASK_SEEDED_KEY) === "true") {
    debugLog("Tasks table is empty, but seed has already run once. Skipping defaultTasks seed.");
    return [];
  }

  debugLog("Seeding default tasks...");
  const { data, error } = await supabase.from("tasks").insert(defaultTasks().map((task) => toDb(task, { includeId: false }))).select(taskColumns);
  if (error) {
    debugError("Seed failed:", error);
    logDataError("tasks.seed", error);
    throw error;
  }
  localStorage.setItem(TASK_SEEDED_KEY, "true");
  debugLog("Seed success:", data);
  const tasks = deduplicateTasks((data ?? []).map(fromDb));
  validateTasks(tasks);
  writeLocalTasks(tasks, "Supabase");
  return tasks;
}

export async function getTasks() {
  if (isSupabaseConfigured) {
    try {
      return await seedDefaultTasksIfEmpty();
    } catch (error) {
      debugError("Supabase task load failed:", error);
      logDataError("tasks.load", error);
      throw error;
    }
  }
  return getInitialLocalTasks();
}

export async function saveTasksToSupabase(tasks: Task[]) {
  if (!isSupabaseConfigured) return;
  const supabase = requireSupabase();
  if (tasks.length === 0) return;
  const existingSupabaseTasks = tasks.filter((task) => UUID_PATTERN.test(task.id));
  const localOnlyTasks = tasks.filter((task) => !UUID_PATTERN.test(task.id));
  if (localOnlyTasks.length > 0) {
    console.warn("Skipped local-only task ids during Supabase bulk save to avoid duplicate inserts:", localOnlyTasks.map((task) => task.id));
  }
  if (existingSupabaseTasks.length === 0) return;
  const { data, error } = await supabase.from("tasks").upsert(existingSupabaseTasks.map((task) => toDb(task, { partial: true })), { onConflict: "id" }).select(taskColumns);
  if (error) {
    debugError("Supabase task save failed:", error);
    logDataError("tasks.save", error);
    throw error;
  }
  debugLog("Saved task to Supabase:", data);
}

export async function saveTasks(tasks: Task[]) {
  if (isSupabaseConfigured) {
    console.warn("Blocked bulk saveTasks in Supabase mode. Use addTask/updateTask/deleteTask for guarded row-level writes.");
    return;
  }
  writeLocalTasks(tasks, isSupabaseConfigured ? "Supabase" : "localStorage");
}

export async function updateTask(taskId: string, updates: Partial<Task>) {
  const tasks = getEditableLocalTasks().map((task) => task.id === taskId ? { ...task, ...updates } : task);
  writeLocalTasks(tasks, isSupabaseConfigured ? "Supabase" : "localStorage");
  if (isSupabaseConfigured) {
    if (!UUID_PATTERN.test(taskId)) {
      console.warn("Skipped Supabase update for temporary task id until insert completes:", taskId);
      return tasks;
    }
    const task = tasks.find((item) => item.id === taskId);
    if (task) {
      const payload = updatesToDb(updates);
      debugLog("Before update:", task);
      debugLog("Update payload:", payload);
      if (Object.keys(payload).length === 0) return tasks;
      const { data, error } = await requireSupabase().from("tasks").update(payload).eq("id", taskId).select(taskColumns);
      if (error) {
        debugError("Task save failed:", error);
        logDataError("tasks.update", error);
        window.alert("怨쇱뾽 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
        throw error;
      }
      debugLog("Task saved to Supabase:", data);
    }
  }
  return tasks;
}

export async function addTask(task: Task) {
  let savedTask = task;
  if (isSupabaseConfigured) {
    const { data, error } = await requireSupabase().from("tasks").insert(toDb(task, { includeId: false })).select(taskColumns);
    if (error) {
      debugError("Task save failed:", error);
      logDataError("tasks.add", error);
      window.alert("怨쇱뾽 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.");
      throw error;
    }
    savedTask = data?.[0] ? fromDb(data[0]) : task;
    debugLog("Task saved to Supabase:", data);
  }
  const tasks = [...getEditableLocalTasks().filter((item) => item.id !== task.id), savedTask];
  writeLocalTasks(tasks, isSupabaseConfigured ? "Supabase" : "localStorage");
  return savedTask;
}

export async function deleteTask(taskId: string) {
  const tasks = getEditableLocalTasks().filter((task) => task.id !== taskId);
  writeLocalTasks(tasks, isSupabaseConfigured ? "Supabase" : "localStorage");
  if (isSupabaseConfigured) {
    const { data, error } = await requireSupabase().from("tasks").delete().eq("id", taskId).select("id");
    if (error) {
      debugError("Supabase task save failed:", error);
      logDataError("tasks.delete", error);
      throw error;
    }
    debugLog("Saved task to Supabase:", data);
  }
  return tasks;
}

export async function resetTasksToDefault() {
  console.warn("resetTasksToDefault is disabled to prevent accidental data initialization.");
  return readLocalTasks() ?? [];
}

export async function testSupabaseTaskInsert() {
  if (!isSupabaseConfigured) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const testTask: Task = {
    id: `task-test-${Date.now()}`,
    title: `Supabase 연결 테스트 ${new Date().toISOString()}`,
    note: "설정 화면에서 생성한 연결 테스트 과업입니다.",
    group: "설계 단계",
    groupOrder: 2,
    category: "설계 단계",
    owner: "테스트",
    status: "미착수",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    deliverable: "",
    evidence: "",
    isVisibleToClient: false
  };
  const { data, error } = await requireSupabase().from("tasks").insert(toDb(testTask, { includeId: false })).select(taskColumns);
  if (error) {
    debugError("Supabase task save failed:", error);
    throw error;
  }
  debugLog("Saved task to Supabase:", data);
  return data;
}

