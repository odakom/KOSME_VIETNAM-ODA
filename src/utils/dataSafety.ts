import type { Task } from "../types";

const TASK_BACKUP_KEY = "tasks_backup";
const DATA_ERROR_KEY = "odakom_data_error_logs";
const MAX_BACKUPS = 3;
const MAX_ERRORS = 10;

interface TaskBackup {
  savedAt: string;
  tasks: Task[];
}

interface DataErrorLog {
  at: string;
  scope: string;
  message: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function backupTasks(tasks: Task[]) {
  if (!tasks.length) return;
  const backups = readJson<TaskBackup[]>(TASK_BACKUP_KEY, []);
  const next = [{ savedAt: new Date().toISOString(), tasks }, ...backups].slice(0, MAX_BACKUPS);
  localStorage.setItem(TASK_BACKUP_KEY, JSON.stringify(next));
}

export function restoreTasksFromBackup() {
  return readJson<TaskBackup[]>(TASK_BACKUP_KEY, [])[0]?.tasks ?? null;
}

export function getTaskBackups() {
  return readJson<TaskBackup[]>(TASK_BACKUP_KEY, []);
}

export function logDataError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const logs = readJson<DataErrorLog[]>(DATA_ERROR_KEY, []);
  const next = [{ at: new Date().toISOString(), scope, message }, ...logs].slice(0, MAX_ERRORS);
  localStorage.setItem(DATA_ERROR_KEY, JSON.stringify(next));
}

export function getDataErrorLogs() {
  return readJson<DataErrorLog[]>(DATA_ERROR_KEY, []);
}

export function validateTasks(tasks: Task[]) {
  const corrupted = tasks.filter((task) => !task.startDate || !task.dueDate);
  if (corrupted.length > 0) {
    console.error("Data corruption detected", corrupted);
    logDataError("tasks.validate", `Missing startDate/dueDate: ${corrupted.map((task) => task.title || task.id).join(", ")}`);
    window.alert("데이터 이상 감지: 일부 과업의 시작일 또는 마감일이 비어 있습니다.");
    return false;
  }
  return true;
}
