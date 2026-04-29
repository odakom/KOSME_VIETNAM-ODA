import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EditableTable, type Field } from "../EditableTable";
import { ProgressBar } from "../ProgressBar";
import type { Task } from "../../types";
import { calculateGroupProgress, getGroupOrder, groupTasks, normalizeTaskGroup, taskGroups } from "../../utils/taskGrouping";

interface Props {
  tasks: Task[];
  fields: Field<Task>[];
  onChange: (tasks: Task[]) => void;
  createRow: (group: string) => Task;
  rowActions?: (task: Task) => ReactNode;
  readOnly?: boolean;
}

export function GroupedTaskList({ tasks, fields, onChange, createRow, rowActions, readOnly }: Props) {
  const grouped = useMemo(() => {
    const existingGroups = groupTasks(tasks);
    if (readOnly) return existingGroups;
    const byGroup = new Map(existingGroups.map((item) => [item.group, item]));
    return taskGroups.map((group) => byGroup.get(group) ?? { group, groupOrder: getGroupOrder(group), tasks: [] });
  }, [readOnly, tasks]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const updateGroup = (group: string, nextGroupTasks: Task[]) => {
    const nextIds = new Set(nextGroupTasks.map((task) => task.id));
    const rest = tasks.filter((task) => normalizeTaskGroup(task).group !== group && !nextIds.has(task.id));
    onChange([...rest, ...nextGroupTasks.map(normalizeTaskGroup)].sort((a, b) => (a.groupOrder ?? getGroupOrder(a.group ?? "")) - (b.groupOrder ?? getGroupOrder(b.group ?? "")) || a.startDate.localeCompare(b.startDate)));
  };

  return (
    <div className="space-y-3">
      {grouped.map(({ group, tasks: groupRows }) => {
        const isOpen = openGroups[group] ?? false;
        const progress = calculateGroupProgress(groupRows);
        return (
          <section key={group} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between" onClick={() => setOpenGroups((current) => ({ ...current, [group]: !isOpen }))}>
              <div className="flex items-center gap-3">
                <ChevronDown className={`text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} size={18} />
                <div>
                  <h2 className="font-semibold text-ink">{group}</h2>
                  <p className="text-sm text-slate-500">과업 {groupRows.length}개 · 진행률 {progress}%</p>
                </div>
              </div>
              <div className="w-full sm:w-56">
                <ProgressBar value={progress} />
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-200">
                <EditableTable
                  rows={groupRows}
                  fields={fields}
                  onChange={(nextRows) => updateGroup(group, nextRows)}
                  createRow={() => createRow(group)}
                  rowActions={rowActions}
                  rowActionsLabel="산출물"
                  readOnly={readOnly}
                />
              </div>
            ) : null}
          </section>
        );
      })}
      {grouped.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">표시할 과업이 없습니다.</div> : null}
    </div>
  );
}
