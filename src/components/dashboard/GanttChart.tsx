import { useMemo } from "react";
import type { Task } from "../../types";
import { daysBetween, todayIso } from "../../utils/date";
import { groupTasks } from "../../utils/taskGrouping";

const statusColor: Record<Task["status"], string> = {
  미착수: "bg-slate-400",
  진행중: "bg-blue-500",
  완료: "bg-emerald-500",
  "보고서 반영": "bg-emerald-600",
  "발주처 확인": "bg-emerald-700"
};

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function minIso(values: string[]) {
  return values.reduce((min, value) => (value && value < min ? value : min), values[0] || todayIso());
}

function maxIso(values: string[]) {
  return values.reduce((max, value) => (value && value > max ? value : max), values[0] || todayIso());
}

export function GanttChart({ tasks, title = "전체 일정 간트차트", readOnly = true, visibleOnly = false }: { tasks: Task[]; title?: string; readOnly?: boolean; visibleOnly?: boolean }) {
  const chart = useMemo(() => {
    const sourceTasks = visibleOnly ? tasks.filter((task) => task.isVisibleToClient !== false) : tasks;
    const validTasks = groupTasks(sourceTasks).flatMap((group) => group.tasks.filter((task) => task.startDate && task.dueDate));
    const start = minIso(validTasks.map((task) => task.startDate));
    const end = maxIso(validTasks.map((task) => task.dueDate));
    const totalDays = Math.max(daysBetween(start, end), 1);
    const tickStep = Math.max(Math.ceil(totalDays / 6), 7);
    const ticks = Array.from({ length: Math.floor(totalDays / tickStep) + 1 }, (_, index) => addDays(start, index * tickStep));
    const todayOffset = Math.min(Math.max((daysBetween(start, todayIso()) / totalDays) * 100, 0), 100);
    return { validTasks, start, end, totalDays, ticks, todayOffset };
  }, [tasks, visibleOnly]);

  if (chart.validTasks.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-ink">{title}</h2>
        <div className="mt-4 rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">표시할 과업 일정이 없습니다.</div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{chart.start} ~ {chart.end}{readOnly ? " · 읽기 전용" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />미착수</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />진행중</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />완료</span>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[240px_1fr] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-500">
            <div>과업</div>
            <div className="relative h-6">
              <span className="absolute top-0 z-10 -translate-x-1/2 rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600" style={{ left: `${chart.todayOffset}%` }}>오늘</span>
              <span className="absolute bottom-0 top-0 z-0 w-px bg-red-400" style={{ left: `${chart.todayOffset}%` }} />
              {chart.ticks.map((tick) => (
                <span key={tick} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${(daysBetween(chart.start, tick) / chart.totalDays) * 100}%` }}>{tick.slice(5)}</span>
              ))}
            </div>
          </div>
          <div>
            {groupTasks(chart.validTasks).map((group) => (
              <div key={group.group}>
                <div className="grid grid-cols-[240px_1fr] gap-3 border-b border-slate-200 bg-slate-50 py-2">
                  <div className="pr-2 text-sm font-bold text-ink">{group.group}</div>
                  <div className="text-xs font-semibold text-slate-500">과업 {group.tasks.length}개</div>
                </div>
                {group.tasks.map((task) => {
                  const left = Math.min(Math.max((daysBetween(chart.start, task.startDate) / chart.totalDays) * 100, 0), 100);
                  const width = Math.max((Math.max(daysBetween(task.startDate, task.dueDate), 1) / chart.totalDays) * 100, 1.5);
                  const tooltip = `${task.title}\n담당자: ${task.owner || "-"}\n기간: ${task.startDate} ~ ${task.dueDate}\n상태: ${task.status}`;
                  return (
                    <div key={task.id} className="grid grid-cols-[240px_1fr] gap-3 border-b border-slate-100 py-2">
                      <div className="truncate pl-4 pr-2 text-sm font-medium text-slate-700" title={task.title}>{task.title}</div>
                      <div className="relative h-7 rounded bg-slate-50">
                        <span className="absolute bottom-0 top-0 z-0 w-px bg-red-200" style={{ left: `${chart.todayOffset}%` }} />
                        <div
                          className={`absolute top-1 h-5 rounded ${statusColor[task.status]} shadow-sm transition hover:brightness-95`}
                          style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                          title={tooltip}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
