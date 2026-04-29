import { AlertTriangle, CalendarDays, ChevronDown, ClipboardCheck, FileText, MessageSquareText, Route } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { GanttChart } from "../components/dashboard/GanttChart";
import { ProgressBar } from "../components/ProgressBar";
import { StatCard } from "../components/StatCard";
import type { AppData } from "../types";
import { daysBetween, todayIso } from "../utils/date";
import { calculateIntegratedProgress, calculateScheduleProgress, calculateTaskProgress, formatProgress } from "../utils/progress";
import { getUpcomingTasks } from "../utils/schedule";
import { calculateGroupProgress, groupTasks } from "../utils/taskGrouping";

export function Dashboard({ data }: { data: AppData }) {
  const [isGanttOpen, setIsGanttOpen] = useState(false);
  const taskProgress = calculateTaskProgress(data.tasks);
  const scheduleProgress = calculateScheduleProgress(data.contract.periodStart, data.contract.periodEnd);
  const progress = calculateIntegratedProgress(taskProgress, scheduleProgress);
  const dday = daysBetween(todayIso(), data.contract.deliveryDue);
  const highRisks = data.risks.filter((risk) => risk.impact === "높음" || risk.likelihood === "높음").slice(0, 3);
  const upcomingTasks = getUpcomingTasks(data.tasks, 2);
  const groupedTasks = groupTasks(data.tasks);
  const unprocessedCommentStatuses = new Set(["접수", "검토중", "반영중"]);
  const decisionCommentStatuses = new Set(["접수", "검토중"]);
  const unprocessedComments = data.comments.filter((comment) => unprocessedCommentStatuses.has(comment.status));
  const pendingApprovals = data.approvals.filter((approval) => approval.status === "미승인");
  const reviewPendingCount = unprocessedComments.length + pendingApprovals.length;
  const decisionItems = data.comments
    .filter((comment) => decisionCommentStatuses.has(comment.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const clickableCard = "block focus:outline-none focus-visible:ring-2 focus-visible:ring-public focus-visible:ring-offset-2";
  const shortcuts = [
    { to: "/tasks", label: "과업 체크리스트", icon: ClipboardCheck },
    { to: "/schedule", label: "일정관리", icon: CalendarDays },
    { to: "/deliverables", label: "산출물 관리", icon: FileText },
    { to: "/comments", label: "발주처 의견관리", icon: MessageSquareText }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">프로젝트 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">{data.contract.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Link className={clickableCard} to="/tasks">
          <StatCard interactive label="통합 진행률" value={`${formatProgress(progress)}%`} hint="과업 70% + 일정 30%" />
        </Link>
        <Link className={clickableCard} to="/contract">
          <StatCard interactive label="납품기한 D-day" value={dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`} hint={data.contract.deliveryDue} />
        </Link>
        <Link className={clickableCard} to="/risks">
          <StatCard interactive label="주요 리스크" value={`${highRisks.length}건`} hint={highRisks.length > 0 ? "높음 리스크 기준" : "현재 주요 리스크 없음"} />
        </Link>
        <Link className={clickableCard} to="/comments">
          <StatCard interactive label="미처리 의견" value={`${unprocessedComments.length}건`} hint={`검토 대기 ${reviewPendingCount}건`} />
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">단계별 진행률</h2>
            <p className="text-xs text-slate-500">과업 체크리스트 기준 요약</p>
          </div>
          <Link to="/tasks" className="text-sm font-semibold text-public hover:underline">자세히 보기</Link>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {groupedTasks.map((group) => (
              <span key={group.group} className="font-medium text-slate-700">
                {group.group} <span className="font-bold text-public">{calculateGroupProgress(group.tasks)}%</span>
              </span>
            ))}
          </div>
          <ProgressBar value={progress} />
        </div>
      </section>

      <div className={`grid gap-4 ${highRisks.length > 0 ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><CalendarDays size={18} /> 향후 일정</h2>
            <Link to="/schedule" className="text-sm font-semibold text-public hover:underline">전체보기</Link>
          </div>
          <div className="space-y-2">
            {upcomingTasks.map((task) => {
              const taskDday = daysBetween(todayIso(), task.dueDate);
              return (
                <Link key={task.id} to="/schedule" className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 transition hover:border-odakom hover:bg-white">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">{task.title}</div>
                    <div className="text-xs text-slate-500">{task.dueDate} · {task.owner || "담당자 미정"}</div>
                  </div>
                  <span className={`shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold ${taskDday <= 7 ? "text-amber-700" : "text-public"}`}>
                    {taskDday === 0 ? "D-day" : `D-${taskDday}`}
                  </span>
                </Link>
              );
            })}
            {upcomingTasks.length === 0 ? <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">예정된 과업 마감일이 없습니다.</div> : null}
          </div>
        </section>

        {highRisks.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-ink"><AlertTriangle size={18} /> 주요 리스크</h2>
              <Link to="/risks" className="text-sm font-semibold text-amber-700 hover:underline">전체보기</Link>
            </div>
            <div className="space-y-2">
              {highRisks.map((risk) => (
                <Link key={risk.id} to="/risks" className="block rounded-md border border-amber-100 bg-white px-3 py-2 transition hover:border-amber-300">
                  <div className="font-semibold text-slate-800">{risk.name}</div>
                  <div className="truncate text-xs text-slate-600">{risk.mitigation}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><MessageSquareText size={18} /> 의사결정 필요 항목</h2>
          <Link to="/comments" className="text-sm font-semibold text-public hover:underline">의견관리로 이동</Link>
        </div>
        <div className="space-y-2">
          {decisionItems.map((comment) => (
            <Link key={comment.id} to="/comments" className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 transition hover:border-odakom hover:bg-white">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{comment.targetTitle}</div>
                <div className="truncate text-xs text-slate-500">{comment.content}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-semibold text-public">{comment.status}</div>
                <div className="text-xs text-slate-500">{comment.createdAt.slice(0, 10)}</div>
              </div>
            </Link>
          ))}
          {decisionItems.length === 0 ? <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">현재 의사결정 필요 항목이 없습니다.</div> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <button className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-ink" onClick={() => setIsGanttOpen((current) => !current)}>
          <span className="flex items-center gap-2"><Route size={18} /> 전체 일정 펼쳐보기</span>
          <ChevronDown className={`text-slate-500 transition ${isGanttOpen ? "rotate-180" : ""}`} size={18} />
        </button>
        {isGanttOpen ? <div className="border-t border-slate-200 p-4"><GanttChart tasks={data.tasks} /></div> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {shortcuts.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-odakom hover:bg-slate-50">
            <Icon size={16} /> {label}
          </Link>
        ))}
      </section>
    </div>
  );
}
