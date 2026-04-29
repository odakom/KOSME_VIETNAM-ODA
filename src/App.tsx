import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Upload } from "lucide-react";
import { ClientLayout } from "./components/ClientLayout";
import { GanttChart } from "./components/dashboard/GanttChart";
import { EditableTable, type Field } from "./components/EditableTable";
import { Layout, type MenuItem } from "./components/Layout";
import { GroupedTaskList } from "./components/tasks/GroupedTaskList";
import { ClientDashboard } from "./pages/ClientDashboard";
import { ContractPage } from "./pages/ContractPage";
import { Dashboard } from "./pages/Dashboard";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { clearAdminAccess, clearClientAccess, hasAdminAccess, hasAdminPasswordConfigured, hasClientAccess, hasClientPasswordConfigured, isClientOnlyDeploy, verifyAdminPassword, verifyClientPassword } from "./services/authService";
import { deleteFileMock, downloadFile, formatFileSize, hasDownloadableFile, uploadFileMock } from "./services/fileService";
import { addTask as saveTaskAdd, deleteTask as saveTaskDelete, getTaskDebugInfo, testSupabaseTaskInsert, updateTask as saveTaskUpdate } from "./services/taskService";
import { useComments } from "./services/useComments";
import { useDeliverables } from "./services/useDeliverables";
import { usePersistentData } from "./services/usePersistentData";
import type { AppData, ClientComment, Risk, Role, Task, TaskDeliverable } from "./types";
import { daysBetween, todayIso } from "./utils/date";
import { getDataErrorLogs, getTaskBackups } from "./utils/dataSafety";
import { getGroupOrder, groupTasks, normalizeTaskGroup } from "./utils/taskGrouping";

const adminMenu: MenuItem[] = [
  { id: "dashboard", label: "프로젝트 대시보드" },
  { id: "contract", label: "계약관리" },
  { id: "tasks", label: "과업 체크리스트" },
  { id: "schedule", label: "일정관리" },
  { id: "deliverables", label: "산출물 관리" },
  { id: "comments", label: "발주처 의견관리" },
  { id: "client", label: "발주처 화면" },
  { id: "risks", label: "리스크 관리" },
  { id: "settings", label: "프로젝트 설정" }
];

const clientPortalMenu: MenuItem[] = [
  { id: "dashboard", label: "프로젝트 개요" },
  { id: "schedule", label: "향후 일정" },
  { id: "deliverables", label: "공개 산출물" },
  { id: "comments", label: "의견 작성" }
];

const pathByPage: Record<string, string> = {
  dashboard: "/",
  contract: "/contract",
  tasks: "/tasks",
  checklist: "/tasks",
  schedule: "/schedule",
  deliverables: "/deliverables",
  comments: "/comments",
  client: "/client-preview",
  risks: "/risks",
  settings: "/settings"
};

const completedTaskStatuses: Task["status"][] = ["완료", "보고서 반영", "발주처 확인"];
const taskStatusOptions: Task["status"][] = ["미착수", "진행중", "완료", "보고서 반영", "발주처 확인"];
const deliverableStatusOptions: TaskDeliverable["status"][] = ["작성중", "내부검토", "발주처검토", "수정중", "최종완료"];
const commentStatusOptions: ClientComment["status"][] = ["접수", "검토중", "반영중", "반영완료", "보류"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nextId = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
const nextUuid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const taskPersistKeys: (keyof Task)[] = ["title", "owner", "status", "startDate", "dueDate", "group", "category", "note", "deliverable", "evidence", "isVisibleToClient"];

function pageFromPath(pathname: string) {
  const segment = pathname.replace(/^\/+/, "").split("/")[0] || "dashboard";
  if (segment === "client-preview") return "client";
  return segment === "checklist" ? "tasks" : segment;
}

function clientViewFromPath(pathname: string) {
  const segment = pathname.replace(/^\/client\/?/, "").split("/")[0] || "dashboard";
  return ["dashboard", "schedule", "deliverables", "comments"].includes(segment) ? segment as "dashboard" | "schedule" | "deliverables" | "comments" : "dashboard";
}

function Page({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function syncDeliverablePlannedDates(prevTasks: Task[], nextTasks: Task[], deliverables: TaskDeliverable[]) {
  const prevById = new Map(prevTasks.map((task) => [task.id, task]));
  const nextById = new Map(nextTasks.map((task) => [task.id, task]));
  return deliverables.map((deliverable) => {
    const prevTask = prevById.get(deliverable.taskId);
    const nextTask = nextById.get(deliverable.taskId);
    if (!prevTask || !nextTask || prevTask.dueDate === nextTask.dueDate) return deliverable;
    const followsTask = !deliverable.actualSubmitDate && (!deliverable.plannedSubmitDate || deliverable.plannedSubmitDate === prevTask.dueDate);
    return followsTask ? { ...deliverable, plannedSubmitDate: nextTask.dueDate } : deliverable;
  });
}

function AdminPage({ page, data, setData }: { page: string; data: AppData; setData: (data: AppData) => void }) {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskSaveStatus, setTaskSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const deliverablesApi = useDeliverables(data, setData);
  const taskDebug = getTaskDebugInfo();

  const persistTaskRows = useCallback(async (nextRows: Task[], nextDeliverables = data.taskDeliverables) => {
    const previousData = data;
    const nextTasks = nextRows.map(normalizeTaskGroup);
    const previousById = new Map(previousData.tasks.map((task) => [task.id, task]));
    const nextById = new Map(nextTasks.map((task) => [task.id, task]));
    const savedTasks = [...nextTasks];
    const replacedIds = new Map<string, string>();

    setTaskSaveStatus("saving");
    setData({ ...previousData, tasks: nextTasks, taskDeliverables: nextDeliverables });
    try {
      for (const previousTask of previousData.tasks) {
        if (!nextById.has(previousTask.id) && uuidPattern.test(previousTask.id)) await saveTaskDelete(previousTask.id);
      }
      for (const nextTask of [...savedTasks]) {
        const previousTask = previousById.get(nextTask.id);
        if (!previousTask || !uuidPattern.test(nextTask.id)) {
          const savedTask = await saveTaskAdd(nextTask);
          const index = savedTasks.findIndex((task) => task.id === nextTask.id);
          if (index >= 0) savedTasks[index] = { ...nextTask, id: savedTask.id };
          replacedIds.set(nextTask.id, savedTask.id);
          continue;
        }
        const updates: Partial<Task> = {};
        for (const key of taskPersistKeys) {
          if (previousTask[key] !== nextTask[key]) (updates as Record<string, unknown>)[key] = nextTask[key];
        }
        if (Object.keys(updates).length > 0) await saveTaskUpdate(nextTask.id, updates);
      }
      setData({
        ...previousData,
        tasks: savedTasks,
        taskDeliverables: nextDeliverables.map((deliverable) => replacedIds.has(deliverable.taskId) ? { ...deliverable, taskId: replacedIds.get(deliverable.taskId)! } : deliverable)
      });
      setTaskSaveStatus("saved");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Task save failed:", error);
      setData(previousData);
      setTaskSaveStatus("failed");
      window.alert("과업 저장에 실패했습니다. Supabase 권한과 컬럼을 확인해 주세요.");
    }
  }, [data, setData]);

  const taskFields: Field<Task>[] = [
    { key: "category", label: "과업구분" },
    { key: "title", label: "세부과업", wide: true },
    { key: "owner", label: "담당자" },
    { key: "startDate", label: "시작일", type: "date" },
    { key: "dueDate", label: "마감일", type: "date" },
    { key: "status", label: "상태", type: "select", options: taskStatusOptions },
    { key: "isVisibleToClient", label: "발주처 공개", type: "boolean" },
    { key: "note", label: "비고", type: "textarea", wide: true }
  ];

  const visibleTasks = statusFilter === "completed"
    ? data.tasks.filter((task) => completedTaskStatuses.includes(task.status))
    : statusFilter === "pending"
      ? data.tasks.filter((task) => !completedTaskStatuses.includes(task.status))
      : data.tasks;
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);
  const mergeRows = (allRows: Task[], visibleRows: Task[]) => {
    const visibleById = new Map(visibleRows.map((row) => [row.id, row]));
    const visibleIds = new Set(visibleRows.map((row) => row.id));
    return [...allRows.map((row) => (visibleIds.has(row.id) ? visibleById.get(row.id)! : row)), ...visibleRows.filter((row) => !allRows.some((item) => item.id === row.id))];
  };

  if (page === "dashboard") return <Dashboard data={data} />;
  if (page === "contract") return <ContractPage data={data} setData={setData} />;
  if (page === "client") return <ClientDashboard data={data} setData={setData} />;
  if (page === "tasks") {
    return (
      <Page title="과업 체크리스트" description="과업 체크리스트의 변경사항은 즉시 Supabase에 저장됩니다.">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          현재 데이터 소스: <span className="font-semibold text-ink">{taskDebug.source}</span>
          <span className="ml-3 text-slate-400">저장된 과업 {data.tasks.length}개 · 마지막 저장 {taskDebug.lastSavedAt}</span>
          <span className={`ml-3 font-semibold ${taskSaveStatus === "failed" ? "text-red-600" : taskSaveStatus === "saving" ? "text-amber-600" : "text-public"}`}>
            {taskSaveStatus === "saving" ? "저장 중..." : taskSaveStatus === "saved" ? "저장 완료" : taskSaveStatus === "failed" ? "저장 실패" : ""}
          </span>
        </div>
        <GroupedTaskList
          tasks={visibleTasks}
          fields={taskFields}
          onChange={(tasks) => {
            const nextTasks = statusFilter ? mergeRows(data.tasks, tasks.map(normalizeTaskGroup)) : tasks.map(normalizeTaskGroup);
            persistTaskRows(nextTasks, syncDeliverablePlannedDates(data.tasks, nextTasks, data.taskDeliverables));
          }}
          createRow={(group): Task => normalizeTaskGroup({ id: nextId("task"), group, groupOrder: getGroupOrder(group), category: group, title: "", owner: "", startDate: todayIso(), dueDate: todayIso(), status: "미착수", deliverable: "", evidence: "", note: "", isVisibleToClient: true })}
          rowActions={(task) => {
            const count = deliverablesApi.getByTaskId(task.id).length;
            return <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:border-odakom hover:bg-slate-50" onClick={() => setSelectedTaskId(task.id)}>산출물 {count}개</button>;
          }}
        />
        {selectedTask ? (
          <TaskDeliverablesModal
            task={selectedTask}
            deliverables={deliverablesApi.getByTaskId(selectedTask.id)}
            onClose={() => setSelectedTaskId(null)}
            onSave={(taskDeliverables) => {
              deliverablesApi.saveForTask(selectedTask.id, taskDeliverables).then(() => setSelectedTaskId(null)).catch(() => undefined);
            }}
            onTaskStatusChange={(status) => {
              persistTaskRows(data.tasks.map((task) => task.id === selectedTask.id ? { ...task, status } : task), data.taskDeliverables);
            }}
          />
        ) : null}
      </Page>
    );
  }
  if (page === "schedule") return <SchedulePage data={data} onChange={(tasks) => persistTaskRows(tasks.map(normalizeTaskGroup), syncDeliverablePlannedDates(data.tasks, tasks, data.taskDeliverables))} />;
  if (page === "deliverables") return <DeliverablesPage data={data} setData={setData} statusFilter={statusFilter} />;
  if (page === "comments") return <CommentsPage data={data} setData={setData} />;
  if (page === "risks") return <RisksPage data={data} setData={setData} />;
  return <SettingsPage data={data} />;
}

function SchedulePage({ data, onChange }: { data: AppData; onChange: (tasks: Task[]) => void }) {
  const grouped = useMemo(() => groupTasks(data.tasks), [data.tasks]);
  const updateTask = (taskId: string, updates: Partial<Task>) => onChange(data.tasks.map((task) => task.id === taskId ? normalizeTaskGroup({ ...task, ...updates }) : task));
  const inputClass = "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-odakom";
  return (
    <Page title="일정관리" description="일정관리는 과업 체크리스트의 tasks 데이터를 그대로 사용합니다.">
      <GanttChart tasks={data.tasks} title="전체 일정 간트차트" />
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-ink">과업 기반 일정 목록</h2>
        </div>
        <div className="space-y-4 p-4">
          {grouped.map((group) => (
            <section key={group.group} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="flex justify-between bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-ink">{group.group}</h3>
                <span className="text-sm font-semibold text-public">과업 {group.tasks.length}개</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-white">
                    <tr>{["과업명", "담당자", "시작일", "마감일", "상태", "D-day", "산출물"].map((label) => <th key={label} className="px-3 py-3 text-left font-semibold text-slate-600">{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.tasks.map((task) => {
                      const dday = task.dueDate ? daysBetween(todayIso(), task.dueDate) : null;
                      const deliverableCount = data.taskDeliverables.filter((item) => item.taskId === task.id).length;
                      return (
                        <tr key={task.id}>
                          <td className="min-w-72 px-3 py-3"><input className={inputClass} value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} /></td>
                          <td className="min-w-36 px-3 py-3"><input className={inputClass} value={task.owner} onChange={(event) => updateTask(task.id, { owner: event.target.value })} /></td>
                          <td className="min-w-36 px-3 py-3"><input className={inputClass} type="date" value={task.startDate} onChange={(event) => updateTask(task.id, { startDate: event.target.value })} /></td>
                          <td className="min-w-36 px-3 py-3"><input className={inputClass} type="date" value={task.dueDate} onChange={(event) => updateTask(task.id, { dueDate: event.target.value })} /></td>
                          <td className="min-w-40 px-3 py-3"><select className={inputClass} value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as Task["status"] })}>{taskStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                          <td className="px-3 py-3 font-semibold">{dday === null ? "-" : dday < 0 ? `D+${Math.abs(dday)}` : dday === 0 ? "D-day" : `D-${dday}`}</td>
                          <td className="px-3 py-3 text-slate-600">산출물 {deliverableCount}개</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </section>
    </Page>
  );
}

function TaskDeliverablesModal({ task, deliverables, onClose, onSave, onTaskStatusChange }: {
  task: Task;
  deliverables: TaskDeliverable[];
  onClose: () => void;
  onSave: (deliverables: TaskDeliverable[]) => void;
  onTaskStatusChange: (status: Task["status"]) => void;
}) {
  const [drafts, setDrafts] = useState<TaskDeliverable[]>(deliverables);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [isSaving, setIsSaving] = useState(false);
  const createDeliverable = (): TaskDeliverable => ({
    id: nextUuid(),
    taskId: task.id,
    title: "",
    fileName: "",
    originalFileName: "",
    storedFileName: "",
    fileSize: 0,
    fileType: "",
    fileUrl: "",
    filePath: "",
    fileData: "",
    version: "v0.1",
    plannedSubmitDate: "",
    actualSubmitDate: "",
    status: "작성중",
    uploadedBy: task.owner || "내부관리자",
    uploadedAt: "",
    note: "",
    isVisibleToClient: false
  });
  const update = (id: string, updates: Partial<TaskDeliverable>) => setDrafts((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
  const remove = async (item: TaskDeliverable) => {
    if (!window.confirm("선택한 산출물을 삭제합니다. 계속하시겠습니까?")) return;
    if (item.filePath) await deleteFileMock(item.id, item.filePath);
    setPendingFiles((files) => {
      const next = { ...files };
      delete next[item.id];
      return next;
    });
    setDrafts((items) => items.filter((draft) => draft.id !== item.id));
  };
  const handleFileSelected = (item: TaskDeliverable, file: File) => {
    const targetId = item.fileName || item.filePath || pendingFiles[item.id] ? nextUuid() : item.id;
    const next = { ...createDeliverable(), ...item, id: targetId, title: item.title || file.name, fileName: file.name, originalFileName: file.name, fileSize: file.size, fileType: file.type, uploadedBy: item.uploadedBy || task.owner || "내부관리자" };
    setPendingFiles((files) => ({ ...files, [targetId]: file }));
    setDrafts((items) => item.fileName || item.filePath || pendingFiles[item.id] ? [...items, next] : items.map((draft) => draft.id === item.id ? next : draft));
  };
  const saveDrafts = async () => {
    setIsSaving(true);
    try {
      const uploadedDrafts = await Promise.all(drafts.map(async (item) => {
        const file = pendingFiles[item.id];
        if (!file) return item;
        const uploaded = await uploadFileMock(file, task.id, item.uploadedBy || task.owner || "내부관리자");
        return { ...item, ...uploaded };
      }));
      onSave(uploadedDrafts);
    } finally {
      setIsSaving(false);
    }
  };
  const hasFinal = drafts.some((item) => item.status === "최종완료");
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 p-4">
      <section className="mx-auto max-w-5xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-bold text-ink">{task.title} 산출물 관리</h2>
        </div>
        <div className="space-y-4 p-5">
          {hasFinal ? <div className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">최종완료 산출물이 있습니다. 과업 상태를 보고서 반영 또는 발주처 확인으로 변경할 수 있습니다.</div> : null}
          <button className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={() => setDrafts((items) => [...items, createDeliverable()])}><Plus size={16} /> 산출물 추가</button>
          {drafts.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="산출물명" value={item.title} onChange={(event) => update(item.id, { title: event.target.value })} />
                <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="버전" value={item.version} onChange={(event) => update(item.id, { version: event.target.value })} />
                <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={item.status} onChange={(event) => update(item.id, { status: event.target.value as TaskDeliverable["status"] })}>{deliverableStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                <label className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" checked={item.isVisibleToClient} onChange={(event) => update(item.id, { isVisibleToClient: event.target.checked })} /> 발주처 공개</label>
              </div>
              <textarea className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="비고" value={item.note} onChange={(event) => update(item.id, { note: event.target.value })} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-ink"><Upload size={16} /> 파일 선택<input className="hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFileSelected(item, file); event.currentTarget.value = ""; }} /></label>
                {item.fileName ? <span className="text-sm text-slate-600">{item.originalFileName || item.fileName} · {formatFileSize(item.fileSize)} · {item.uploadedAt || "업로드 전"}</span> : <span className="text-sm text-slate-400">파일 없음</span>}
                {hasDownloadableFile(item) ? <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={() => downloadFile(item)}>다운로드</button> : <span className="text-sm font-semibold text-slate-400">파일 원본 없음</span>}
                <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-red-600" onClick={() => remove(item)}><Trash2 size={16} /> 삭제</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-slate-200 p-5">
          <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={onClose}>닫기</button>
          <div className="flex gap-2">
            {hasFinal ? <button className="rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700" onClick={() => onTaskStatusChange("보고서 반영")}>과업 상태: 보고서 반영</button> : null}
            <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} onClick={saveDrafts}>{isSaving ? "저장 중..." : "저장"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeliverablesPage({ data, setData, statusFilter }: { data: AppData; setData: (data: AppData) => void; statusFilter: string | null }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(statusFilter === "client-review" ? "발주처검토" : "전체");
  const [visibility, setVisibility] = useState("전체");
  const deliverablesApi = useDeliverables(data, setData);
  const taskById = useMemo(() => new Map(data.tasks.map((task) => [task.id, task])), [data.tasks]);
  const updateDeliverable = (id: string, updates: Partial<TaskDeliverable>) => deliverablesApi.update(id, updates).catch(() => window.alert("산출물 저장에 실패했습니다."));
  const deleteDeliverable = async (item: TaskDeliverable) => {
    if (!window.confirm("선택한 산출물과 연결된 Storage 파일을 삭제합니다. 계속하시겠습니까?")) return;
    try {
      await deleteFileMock(item.id, item.filePath);
      await deliverablesApi.remove(item.id);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Task deliverables delete failed:", error);
      window.alert("산출물 삭제에 실패했습니다.");
    }
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDeliverables = deliverablesApi.deliverables.filter((item) => {
    const task = taskById.get(item.taskId);
    const searchable = `${item.title} ${item.originalFileName || ""} ${item.fileName} ${task?.title || ""}`.toLowerCase();
    return (status === "전체" || item.status === status)
      && (visibility === "전체" || (visibility === "공개" ? item.isVisibleToClient : !item.isVisibleToClient))
      && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
  return (
    <Page title="산출물 관리" description="과업 체크리스트에서 등록한 taskDeliverables 전체를 모아 봅니다.">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-odakom" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="산출물명, 원본 파일명, 관련 과업명 검색" />
          <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="전체">상태 전체</option>
            {deliverableStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="전체">공개 여부 전체</option>
            <option value="공개">발주처 공개</option>
            <option value="비공개">비공개</option>
          </select>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><h2 className="font-semibold text-ink">전체 산출물 {filteredDeliverables.length}개</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{["산출물", "관련 과업", "파일", "버전", "상태", "공개", "비고", "다운로드", "삭제"].map((label) => <th key={label} className="px-3 py-3 text-left font-semibold text-slate-600">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeliverables.map((item) => {
                const task = taskById.get(item.taskId);
                return (
                  <tr key={item.id}>
                    <td className="min-w-56 px-3 py-3"><input className="w-full rounded-md border border-slate-200 px-2 py-2" value={item.title} onChange={(event) => updateDeliverable(item.id, { title: event.target.value })} /></td>
                    <td className="min-w-64 px-3 py-3"><div className="font-semibold">{task?.title || "연결 과업 없음"}</div><div className="text-xs text-slate-500">{task?.category || "-"} · {task?.owner || item.uploadedBy || "담당자 미정"}</div></td>
                    <td className="min-w-56 px-3 py-3"><div className="font-medium">{item.originalFileName || item.fileName || "파일 없음"}</div><div className="text-xs text-slate-500">{formatFileSize(item.fileSize)} · {item.uploadedAt || "-"}</div></td>
                    <td className="min-w-28 px-3 py-3"><input className="w-full rounded-md border border-slate-200 px-2 py-2" value={item.version} onChange={(event) => updateDeliverable(item.id, { version: event.target.value })} /></td>
                    <td className="min-w-40 px-3 py-3"><select className="w-full rounded-md border border-slate-200 px-2 py-2" value={item.status} onChange={(event) => updateDeliverable(item.id, { status: event.target.value as TaskDeliverable["status"] })}>{deliverableStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                    <td className="px-3 py-3"><input className="h-5 w-5 accent-odakom" type="checkbox" checked={item.isVisibleToClient} onChange={(event) => updateDeliverable(item.id, { isVisibleToClient: event.target.checked })} /></td>
                    <td className="min-w-48 px-3 py-3"><textarea className="min-h-16 w-full rounded-md border border-slate-200 px-2 py-2" value={item.note} onChange={(event) => updateDeliverable(item.id, { note: event.target.value })} /></td>
                    <td className="px-3 py-3">{hasDownloadableFile(item) ? <button className="rounded-md border border-slate-200 px-3 py-2 font-semibold text-ink" onClick={() => downloadFile(item)}>다운로드</button> : <span className="text-xs text-slate-400">파일 원본 없음</span>}</td>
                    <td className="px-3 py-3"><button className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => deleteDeliverable(item)}><Trash2 size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredDeliverables.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">조건에 맞는 산출물이 없습니다.</div> : null}
      </section>
    </Page>
  );
}

function CommentsPage({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const commentsApi = useComments(data, setData);
  const update = (id: string, updates: Partial<ClientComment>) => commentsApi.update(id, updates).catch(() => window.alert("의견 저장에 실패했습니다."));
  const targetTypeLabel: Record<ClientComment["targetType"], string> = { project: "프로젝트", task: "과업", deliverable: "산출물" };
  return (
    <Page title="발주처 의견관리" description="comments 단일 원본 기준으로 발주처 의견과 답변을 관리합니다.">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><h2 className="font-semibold text-ink">전체 의견 {commentsApi.comments.length}건</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{["작성자", "작성일", "대상 유형", "대상명", "의견 내용", "상태", "답변", "반영 위치", "보류 사유", "삭제"].map((label) => <th key={label} className="px-3 py-3 text-left font-semibold text-slate-600">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {commentsApi.comments.map((comment) => (
                <tr key={comment.id}>
                  <td className="min-w-32 px-3 py-3"><input className="w-full rounded-md border border-slate-200 px-2 py-2" value={comment.authorName} onChange={(event) => update(comment.id, { authorName: event.target.value })} /></td>
                  <td className="min-w-28 px-3 py-3 text-slate-600">{comment.createdAt.slice(0, 10)}</td>
                  <td className="min-w-24 px-3 py-3">{targetTypeLabel[comment.targetType]}</td>
                  <td className="min-w-48 px-3 py-3 font-semibold">{comment.targetTitle}</td>
                  <td className="min-w-64 px-3 py-3"><textarea className="min-h-20 w-full rounded-md border border-slate-200 px-2 py-2" value={comment.content} onChange={(event) => update(comment.id, { content: event.target.value })} /></td>
                  <td className="min-w-32 px-3 py-3"><select className="w-full rounded-md border border-slate-200 px-2 py-2" value={comment.status} onChange={(event) => update(comment.id, { status: event.target.value as ClientComment["status"] })}>{commentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                  <td className="min-w-64 px-3 py-3"><textarea className="min-h-20 w-full rounded-md border border-slate-200 px-2 py-2" value={comment.response} onChange={(event) => update(comment.id, { response: event.target.value, respondedBy: "내부관리자", respondedAt: new Date().toISOString() })} /></td>
                  <td className="min-w-40 px-3 py-3"><input className="w-full rounded-md border border-slate-200 px-2 py-2" value={comment.reflectedLocation} onChange={(event) => update(comment.id, { reflectedLocation: event.target.value })} /></td>
                  <td className="min-w-40 px-3 py-3"><input className="w-full rounded-md border border-slate-200 px-2 py-2" value={comment.holdReason} onChange={(event) => update(comment.id, { holdReason: event.target.value })} /></td>
                  <td className="px-3 py-3"><button className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => window.confirm("의견을 삭제하시겠습니까?") && commentsApi.remove(comment.id)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {commentsApi.comments.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">등록된 발주처 의견이 없습니다.</div> : null}
      </section>
    </Page>
  );
}

function RisksPage({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  return (
    <Page title="리스크 관리">
      <EditableTable
        rows={data.risks}
        fields={[
          { key: "name", label: "리스크명", wide: true },
          { key: "likelihood", label: "발생가능성", type: "select", options: ["낮음", "보통", "높음"] },
          { key: "impact", label: "영향도", type: "select", options: ["낮음", "보통", "높음"] },
          { key: "mitigation", label: "대응방안", type: "textarea", wide: true },
          { key: "owner", label: "담당자" },
          { key: "status", label: "상태" }
        ] as Field<Risk>[]}
        onChange={(risks) => setData({ ...data, risks })}
        createRow={(): Risk => ({ id: nextId("risk"), name: "", likelihood: "보통", impact: "보통", mitigation: "", owner: "", status: "모니터링" })}
      />
    </Page>
  );
}

function SettingsPage({ data }: { data: AppData }) {
  const taskDebug = getTaskDebugInfo();
  const errorLogs = getDataErrorLogs();
  const taskBackups = getTaskBackups();
  const [testMessage, setTestMessage] = useState("");
  const runConnectionTest = async () => {
    try {
      const result = await testSupabaseTaskInsert();
      setTestMessage(`테스트 저장 성공: ${result?.length ?? 0}건`);
      window.alert("Supabase 연결 테스트에 성공했습니다.");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Supabase task save failed:", error);
      setTestMessage("테스트 저장 실패");
      window.alert(`Supabase 연결 테스트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  };
  return (
    <Page title="프로젝트 설정">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-ink">권한</h2><p className="mt-2 text-sm text-slate-600">관리자와 발주처 화면은 라우팅 단계에서 분리됩니다.</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-ink">데이터 저장소</h2><p className="mt-2 text-sm text-slate-600">{isSupabaseConfigured ? "Supabase 우선 / localStorage fallback" : "localStorage fallback"}</p></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">데이터 안정성 패널</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">현재 데이터 소스</div><div>{isSupabaseConfigured ? "Supabase" : "fallback"} · {taskDebug.source}</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">마지막 저장</div><div>{taskDebug.lastSavedAt}</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">과업 수</div><div>{data.tasks.length}개</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">산출물 수</div><div>{data.taskDeliverables.length}개</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">의견 수</div><div>{data.comments.length}건</div></div>
          <div className="rounded-md bg-slate-50 p-3"><div className="font-semibold text-slate-800">과업 백업</div><div>{taskBackups.length}개 버전</div></div>
          <div className="rounded-md bg-slate-50 p-3 md:col-span-3"><div className="font-semibold text-slate-800">최근 오류</div><div>{errorLogs[0] ? `${errorLogs[0].at} · ${errorLogs[0].scope} · ${errorLogs[0].message}` : "없음"}</div></div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">Supabase 진단</h2>
        <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={runConnectionTest}>Supabase 연결 테스트</button>
        {testMessage ? <p className="mt-3 text-sm font-semibold text-public">{testMessage}</p> : null}
      </section>
    </Page>
  );
}

function ClientAccessGate({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const passwordConfigured = hasClientPasswordConfigured();
  const submit = () => {
    if (!passwordConfigured) {
      setError("VITE_CLIENT_ACCESS_PASSWORD is not configured. Please check deployment environment variables.");
      return;
    }
    if (verifyClientPassword(password)) {
      onSuccess();
      return;
    }
    setError("Invalid password.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-ink">Client Access</h1>
        <p className="mt-2 text-sm text-slate-500">
          {passwordConfigured ? "Enter the shared client password." : "Client password is not configured. You can type here, but access is blocked until the environment variable is set."}
        </p>
        <input className="mt-5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-public" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} />
        {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        <button className="mt-4 w-full rounded-md bg-public px-4 py-2 text-sm font-semibold text-white" onClick={submit}>Sign in</button>
      </section>
    </div>
  );
}
function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const disabled = !hasAdminPasswordConfigured();
  const from = typeof location.state === "object" && location.state && "from" in location.state ? String(location.state.from || "/") : "/";
  const submit = () => {
    if (verifyAdminPassword(password)) {
      navigate(from === "/login" ? "/" : from, { replace: true });
      return;
    }
    setError("관리자 비밀번호가 올바르지 않습니다.");
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-ink">내부관리자 로그인</h1>
        <p className="mt-2 text-sm text-slate-500">{disabled ? "관리자 비밀번호 환경변수(VITE_ADMIN_ACCESS_PASSWORD)가 설정되지 않아 로그인을 허용하지 않습니다." : "내부 관리자 비밀번호를 입력하세요."}</p>
        <input disabled={disabled} className="mt-5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-odakom disabled:bg-slate-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} />
        {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        <button disabled={disabled} className="mt-4 w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={submit}>로그인</button>
      </section>
    </div>
  );
}

function ClientPortal({ data, setData, refreshData, isLoading }: { data: AppData; setData: (data: AppData) => void; refreshData: () => Promise<void>; isLoading: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(hasClientAccess());
  const [refreshing, setRefreshing] = useState(false);
  const view = clientViewFromPath(location.pathname);
  useEffect(() => {
    if (!allowed) return;
    setRefreshing(true);
    refreshData().finally(() => setRefreshing(false));
  }, [allowed, refreshData]);
  const handleClientAccess = async () => {
    setAllowed(true);
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };
  if (!allowed) return <ClientAccessGate onSuccess={handleClientAccess} />;
  return (
    <ClientLayout page={view} menu={clientPortalMenu} onPageChange={(page) => navigate(`/client/${page}`)} onLogout={() => { clearClientAccess(); setAllowed(false); }}>
      {isLoading && !refreshing ? <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Supabase 데이터를 불러오는 중입니다.</div> : null}
      {refreshing ? <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Supabase 데이터를 다시 불러오는 중입니다.</div> : null}
      <ClientDashboard data={data} setData={setData} view={view} />
    </ClientLayout>
  );
}

export default function App() {
  const { data, setData, reset, supabaseError, refreshFromSupabase, isSupabaseLoading } = usePersistentData();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<Role>("admin");
  if (location.pathname === "/client" || location.pathname.startsWith("/client/")) return <ClientPortal data={data} setData={setData} refreshData={refreshFromSupabase} isLoading={isSupabaseLoading} />;
  if (isClientOnlyDeploy()) return <Navigate to="/client/dashboard" replace />;
  if (location.pathname === "/login") return <AdminLoginPage />;
  if (!hasAdminAccess()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const page = pageFromPath(location.pathname);
  if (!pathByPage[page]) return <Navigate to="/" replace />;
  return (
    <Layout
      role={role}
      page={page}
      menu={adminMenu}
      onRoleChange={(nextRole) => {
        setRole(nextRole);
        if (nextRole === "client") navigate("/client-preview");
      }}
      onPageChange={(nextPage) => navigate(pathByPage[nextPage] ?? "/")}
      onReset={reset}
      onLogout={() => {
        clearAdminAccess();
        navigate("/login", { replace: true });
      }}
    >
      {isSupabaseLoading ? <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Supabase 데이터를 불러오는 중입니다.</div> : null}
      {supabaseError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{supabaseError}</div> : null}
      <AdminPage page={page} data={data} setData={setData} />
    </Layout>
  );
}
