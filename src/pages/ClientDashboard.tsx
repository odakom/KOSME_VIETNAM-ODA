import { CalendarDays, Check, Download, Pencil, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GanttChart } from "../components/dashboard/GanttChart";
import { ProgressBar } from "../components/ProgressBar";
import { StatCard } from "../components/StatCard";
import { downloadFile, hasDownloadableFile } from "../services/fileService";
import { useComments } from "../services/useComments";
import type { AppData, ClientComment, Task, TaskDeliverable } from "../types";
import { getClientCommentsByTarget, getClientVisibleComments, getClientVisibleDeliverables, getClientVisibleTasks } from "../utils/clientView";
import { daysBetween, todayIso } from "../utils/date";
import { calculateIntegratedProgress, calculateScheduleProgress, calculateTaskProgress, formatProgress } from "../utils/progress";
import { getUpcomingTasks } from "../utils/schedule";

type ClientView = "dashboard" | "schedule" | "deliverables" | "comments";

export function ClientDashboard({ data, setData, view = "dashboard" }: { data: AppData; setData: (data: AppData) => void; view?: ClientView }) {
  const commentsApi = useComments(data, setData);
  const visibleTasks = useMemo(() => getClientVisibleTasks(data.tasks), [data.tasks]);
  const publicDeliverables = useMemo(() => getClientVisibleDeliverables(data.taskDeliverables), [data.taskDeliverables]);
  const clientComments = useMemo(() => getClientVisibleComments(commentsApi.comments), [commentsApi.comments]);
  const unprocessedComments = clientComments.filter((comment) => ["접수", "검토중", "반영중"].includes(comment.status));
  const taskProgress = calculateTaskProgress(visibleTasks);
  const scheduleProgress = calculateScheduleProgress(data.contract.periodStart, data.contract.periodEnd);
  const progress = calculateIntegratedProgress(taskProgress, scheduleProgress);
  const upcomingTasks = getUpcomingTasks(visibleTasks, 5);

  const projectOverview = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold text-ink">프로젝트 개요</h1>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div><span className="font-semibold text-slate-800">계약명</span><br />{data.contract.name}</div>
        <div><span className="font-semibold text-slate-800">발주처</span><br />{data.contract.client}</div>
        <div><span className="font-semibold text-slate-800">계약기간</span><br />{data.contract.periodStart} ~ {data.contract.periodEnd}</div>
        <div><span className="font-semibold text-slate-800">납품기한</span><br />{data.contract.deliveryDue}</div>
      </div>
    </section>
  );

  const progressSection = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-ink">통합 진행률</h2>
          <p className="text-xs text-slate-500">과업 상태 70% + 일정 경과 30% 기준</p>
        </div>
        <span className="text-lg font-bold text-public">{formatProgress(progress)}%</span>
      </div>
      <ProgressBar value={progress} />
    </section>
  );

  const scheduleSection = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-ink"><CalendarDays size={18} /> 향후 일정</h2>
      <div className="space-y-3">
        {upcomingTasks.map((task) => {
          const dday = daysBetween(todayIso(), task.dueDate);
          return (
            <div key={task.id} className={`rounded-md border p-3 ${dday <= 7 ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
              <div className="font-semibold text-slate-800">{task.title}</div>
              <div className="text-sm text-slate-500">마감일 {task.dueDate} · {dday < 0 ? `D+${Math.abs(dday)}` : dday === 0 ? "D-day" : `D-${dday}`}</div>
            </div>
          );
        })}
        {upcomingTasks.length === 0 ? <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">예정된 공개 과업 일정이 없습니다.</div> : null}
      </div>
    </section>
  );

  const deliverablesSection = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-ink">공개 산출물</h2>
      <div className="space-y-3">
        {publicDeliverables.map((item) => {
          const targetTitle = item.title || item.originalFileName || item.fileName || "산출물";
          const itemComments = getClientCommentsByTarget(clientComments, "deliverable", item.id);
          return (
            <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="font-semibold text-slate-800">{targetTitle}</div>
                  <div className="text-sm text-slate-500">{item.originalFileName || item.fileName || "파일명 없음"} · {item.version} · {item.status}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hasDownloadableFile(item) ? (
                    <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => downloadFile(item)}>
                      <Download size={16} /> 다운로드
                    </button>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400">파일 원본 없음</span>
                  )}
                  <Link to={`/client/comments?target=deliverable:${item.id}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink">
                    의견 남기기
                  </Link>
                </div>
              </div>
              {itemComments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {itemComments.map((comment) => (
                    <div key={comment.id} className="rounded-md bg-white p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{comment.authorName}</span><span className="text-xs font-semibold text-public">{comment.status}</span></div>
                      <p className="mt-1 text-slate-600">{comment.content}</p>
                      {comment.response ? <p className="mt-2 text-slate-500">답변/반영 내용: {comment.response}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {publicDeliverables.length === 0 ? <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">현재 발주처에 공개된 산출물이 없습니다. 공개 처리된 산출물이 등록되면 이곳에 표시됩니다.</div> : null}
      </div>
    </section>
  );

  const commentsSection = <ClientCommentForm data={data} commentsApi={commentsApi} visibleTasks={visibleTasks} publicDeliverables={publicDeliverables} clientComments={clientComments} />;

  if (view === "schedule") return <div className="space-y-6">{projectOverview}{progressSection}{scheduleSection}<GanttChart tasks={visibleTasks} title="발주처 일정 간트차트" readOnly visibleOnly /></div>;
  if (view === "deliverables") return <div className="space-y-6">{deliverablesSection}</div>;
  if (view === "comments") return <div className="space-y-6">{commentsSection}</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="프로젝트" value="ODA 종료평가" hint={data.contract.client} />
        <StatCard label="최종 납품 D-day" value={`D-${Math.max(daysBetween(todayIso(), data.contract.deliveryDue), 0)}`} hint={data.contract.deliveryDue} />
        <StatCard label="미처리 의견" value={`${unprocessedComments.length}건`} hint="접수/검토중/반영중 기준" />
      </div>
      {projectOverview}
      {progressSection}
      {scheduleSection}
      {deliverablesSection}
      {commentsSection}
    </div>
  );
}

function ClientCommentForm({ data, commentsApi, visibleTasks, publicDeliverables, clientComments }: {
  data: AppData;
  commentsApi: ReturnType<typeof useComments>;
  visibleTasks: Task[];
  publicDeliverables: TaskDeliverable[];
  clientComments: ClientComment[];
}) {
  const [searchParams] = useSearchParams();
  const [author, setAuthor] = useState("발주처");
  const [targetKey, setTargetKey] = useState(searchParams.get("target") ?? "project:project");
  const [content, setContent] = useState("");
  const [filterType, setFilterType] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [savedMessage, setSavedMessage] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingContent, setEditingContent] = useState("");

  const targetOptions = useMemo(() => [
    { key: "project:project", type: "project" as const, id: "project", title: data.contract.name, label: "프로젝트 전체 의견" },
    ...visibleTasks.map((task) => ({ key: `task:${task.id}`, type: "task" as const, id: task.id, title: task.title, label: `과업 · ${task.title}` })),
    ...publicDeliverables.map((item) => {
      const title = item.title || item.originalFileName || item.fileName || "공개 산출물";
      return { key: `deliverable:${item.id}`, type: "deliverable" as const, id: item.id, title, label: `산출물 · ${title}` };
    })
  ], [data.contract.name, publicDeliverables, visibleTasks]);

  useEffect(() => {
    const queryTarget = searchParams.get("target");
    if (queryTarget && targetOptions.some((option) => option.key === queryTarget)) setTargetKey(queryTarget);
  }, [searchParams, targetOptions]);

  const selectedTarget = targetOptions.find((option) => option.key === targetKey) ?? targetOptions[0];
  const visibleComments = clientComments
    .filter((comment) => filterType === "전체" || comment.targetType === filterType)
    .filter((comment) => filterStatus === "전체" || comment.status === filterStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    await commentsApi.add({
      id: `com-${Date.now()}`,
      targetType: selectedTarget.type,
      targetId: selectedTarget.id,
      targetTitle: selectedTarget.title,
      authorName: author.trim() || "발주처",
      authorRole: "client",
      content: trimmed,
      status: "접수",
      createdAt: now,
      updatedAt: now,
      response: "",
      respondedBy: "",
      respondedAt: "",
      reflectedLocation: "",
      holdReason: ""
    });
    setContent("");
    setSavedMessage("의견이 저장되었습니다.");
  };

  const startEdit = (comment: ClientComment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
    setSavedMessage("");
  };

  const cancelEdit = () => {
    setEditingCommentId("");
    setEditingContent("");
  };

  const saveEdit = async (comment: ClientComment) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    await commentsApi.update(comment.id, { content: trimmed });
    setEditingCommentId("");
    setEditingContent("");
    setSavedMessage("의견이 수정되었습니다.");
  };

  const deleteComment = async (comment: ClientComment) => {
    if (!window.confirm("작성한 의견을 삭제하시겠습니까?")) return;
    await commentsApi.remove(comment.id);
    setSavedMessage("의견이 삭제되었습니다.");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-ink">발주처 의견 작성</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-public" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="작성자명" />
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-public" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
          {targetOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>
      <textarea className="mt-3 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-public" value={content} onChange={(event) => setContent(event.target.value)} placeholder="의견을 입력하세요." />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-public">{savedMessage}</span>
        <button className="inline-flex items-center gap-2 rounded-md bg-public px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!content.trim()} onClick={submit}>
          <Send size={16} /> 의견 저장
        </button>
      </div>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-ink">저장된 의견 목록</h3>
          <div className="flex gap-2">
            <select className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
              <option value="전체">전체</option>
              <option value="project">프로젝트</option>
              <option value="task">과업</option>
              <option value="deliverable">산출물</option>
            </select>
            <select className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              {["전체", "접수", "검토중", "반영중", "반영완료", "보류"].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {visibleComments.map((comment) => (
            <div key={comment.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-800">{comment.targetTitle}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-public">{comment.status}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{comment.createdAt.slice(0, 10)} · {comment.authorName}</div>
              {editingCommentId === comment.id ? (
                <div className="mt-3 space-y-2">
                  <textarea className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-public" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600" onClick={cancelEdit}>
                      <X size={14} /> 취소
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-md bg-public px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!editingContent.trim()} onClick={() => saveEdit(comment)}>
                      <Check size={14} /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-700">{comment.content}</p>
              )}
              {comment.response ? <p className="mt-2 text-sm text-slate-500">답변/반영 내용: {comment.response}</p> : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3">
                  {comment.targetType === "task" ? <Link to="/client/schedule" className="text-xs font-semibold text-public hover:underline">관련 과업 보기</Link> : null}
                  {comment.targetType === "deliverable" ? <Link to="/client/deliverables" className="text-xs font-semibold text-public hover:underline">관련 산출물 보기</Link> : null}
                </div>
                {editingCommentId !== comment.id ? (
                  <div className="flex flex-wrap gap-2">
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-public hover:text-public" onClick={() => startEdit(comment)}>
                      <Pencil size={14} /> 수정
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => deleteComment(comment)}>
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {visibleComments.length === 0 ? <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">저장된 의견이 없습니다.</div> : null}
        </div>
      </div>
    </section>
  );
}
