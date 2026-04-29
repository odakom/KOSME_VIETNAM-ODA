import type { ClientComment, Task, TaskDeliverable } from "../types";
import { getGroupOrder, getTaskGroup } from "./taskGrouping";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbRow = Record<string, unknown>;

function removeNil(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null));
}

function normalizeTaskStatus(value: unknown): Task["status"] {
  const status = String(value ?? "");
  if (["미착수", "진행중", "완료", "보고서 반영", "발주처 확인"].includes(status)) return status as Task["status"];
  if (status.includes("진행")) return "진행중";
  if (status.includes("완료")) return "완료";
  if (status.includes("반영")) return "보고서 반영";
  if (status.includes("확인")) return "발주처 확인";
  return "미착수";
}

function normalizeDeliverableStatus(value: unknown): TaskDeliverable["status"] {
  const status = String(value ?? "");
  if (["작성중", "내부검토", "발주처검토", "수정중", "최종완료"].includes(status)) return status as TaskDeliverable["status"];
  if (status.includes("최종")) return "최종완료";
  if (status.includes("발주처")) return "발주처검토";
  if (status.includes("내부")) return "내부검토";
  if (status.includes("수정")) return "수정중";
  return "작성중";
}

function normalizeReviewStatus(value: unknown): ClientComment["status"] {
  const status = String(value ?? "");
  if (["접수", "검토중", "반영중", "반영완료", "보류"].includes(status)) return status as ClientComment["status"];
  if (status.includes("검토")) return "검토중";
  if (status.includes("완료")) return "반영완료";
  if (status.includes("반영")) return "반영중";
  if (status.includes("보류")) return "보류";
  return "접수";
}

export function fromDb(row: DbRow): Task {
  const groupName = String(row.group_name ?? row.groupName ?? "") || "설계 단계";
  return {
    id: String(row.id),
    group: groupName,
    groupOrder: getGroupOrder(groupName),
    category: groupName,
    title: String(row.title ?? ""),
    owner: String(row.assignee ?? row.owner ?? ""),
    startDate: String(row.start_date ?? row.startDate ?? ""),
    dueDate: String(row.due_date ?? row.dueDate ?? ""),
    status: normalizeTaskStatus(row.status),
    deliverable: String(row.deliverable ?? ""),
    evidence: String(row.evidence ?? ""),
    note: String(row.description ?? row.note ?? ""),
    isVisibleToClient: row.is_visible_to_client == null && row.isVisibleToClient == null ? true : Boolean(row.is_visible_to_client ?? row.isVisibleToClient)
  };
}

export function toDb(task: Task, options: { includeId?: boolean; partial?: boolean } = {}) {
  const groupName = task.group || task.category || getTaskGroup(task);
  const payload: Record<string, unknown> = {
    title: task.title,
    description: task.note || task.deliverable || task.evidence || "",
    group_name: groupName,
    assignee: task.owner,
    status: task.status,
    start_date: task.startDate || (options.partial ? undefined : null),
    due_date: task.dueDate || (options.partial ? undefined : null),
    is_visible_to_client: task.isVisibleToClient ?? true
  };
  if (options.includeId !== false && UUID_PATTERN.test(task.id)) payload.id = task.id;
  return removeNil(payload);
}

export function updatesToDb(updates: Partial<Task>) {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.note !== undefined) payload.description = updates.note;
  if (updates.group !== undefined || updates.category !== undefined) payload.group_name = updates.group ?? updates.category;
  if (updates.owner !== undefined) payload.assignee = updates.owner;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.startDate) payload.start_date = updates.startDate;
  if (updates.dueDate) payload.due_date = updates.dueDate;
  if (updates.isVisibleToClient !== undefined) payload.is_visible_to_client = updates.isVisibleToClient;
  return removeNil(payload);
}

export function deliverableFromDb(row: DbRow): TaskDeliverable {
  return {
    id: String(row.id),
    taskId: String(row.task_id ?? row.taskId ?? ""),
    title: String(row.title ?? ""),
    fileName: String(row.file_name ?? row.fileName ?? row.original_file_name ?? ""),
    originalFileName: String(row.original_file_name ?? row.originalFileName ?? row.file_name ?? row.fileName ?? ""),
    storedFileName: String(row.stored_file_name ?? row.storedFileName ?? ""),
    fileSize: Number(row.file_size ?? row.fileSize ?? 0),
    fileType: String(row.file_type ?? row.fileType ?? ""),
    fileUrl: String(row.file_url ?? row.fileUrl ?? ""),
    filePath: String(row.file_path ?? row.filePath ?? ""),
    fileData: typeof row.file_data === "string" ? row.file_data : undefined,
    version: String(row.version ?? "v0.1"),
    plannedSubmitDate: String(row.planned_submit_date ?? row.plannedSubmitDate ?? ""),
    actualSubmitDate: String(row.actual_submit_date ?? row.actualSubmitDate ?? ""),
    status: normalizeDeliverableStatus(row.status),
    uploadedBy: String(row.uploaded_by ?? row.uploadedBy ?? ""),
    uploadedAt: String(row.uploaded_at ?? row.uploadedAt ?? ""),
    note: String(row.note ?? ""),
    isVisibleToClient: Boolean(row.is_visible_to_client ?? row.isVisibleToClient)
  };
}

export function deliverableToDb(deliverable: TaskDeliverable) {
  return removeNil({
    id: deliverable.id,
    task_id: deliverable.taskId,
    title: deliverable.title,
    original_file_name: deliverable.originalFileName || deliverable.fileName,
    file_url: deliverable.fileUrl,
    file_path: deliverable.filePath ?? "",
    version: deliverable.version,
    status: deliverable.status,
    uploaded_at: deliverable.uploadedAt || null,
    is_visible_to_client: deliverable.isVisibleToClient
  });
}

export function commentFromDb(row: DbRow): ClientComment {
  const createdAt = String(row.created_at ?? row.createdAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? `com-${Date.now()}`),
    targetType: (row.target_type ?? row.targetType ?? "project") as ClientComment["targetType"],
    targetId: String(row.target_id ?? row.targetId ?? ""),
    targetTitle: String(row.target_title ?? row.targetTitle ?? "프로젝트 전체"),
    authorName: String(row.author_name ?? row.authorName ?? "발주처"),
    authorRole: (row.author_role ?? row.authorRole ?? "client") as ClientComment["authorRole"],
    content: String(row.content ?? ""),
    status: normalizeReviewStatus(row.status),
    createdAt,
    updatedAt: String(row.updated_at ?? row.updatedAt ?? createdAt),
    response: String(row.response ?? ""),
    respondedBy: String(row.responded_by ?? row.respondedBy ?? ""),
    respondedAt: String(row.responded_at ?? row.respondedAt ?? ""),
    reflectedLocation: String(row.reflected_location ?? row.reflectedLocation ?? ""),
    holdReason: String(row.hold_reason ?? row.holdReason ?? "")
  };
}

export function commentToDb(comment: ClientComment, options: { includeId?: boolean } = {}) {
  return removeNil({
    id: options.includeId === false ? undefined : comment.id,
    target_type: comment.targetType,
    target_id: comment.targetId,
    target_title: comment.targetTitle,
    author_name: comment.authorName,
    author_role: comment.authorRole,
    content: comment.content,
    status: comment.status,
    response: comment.response
  });
}
