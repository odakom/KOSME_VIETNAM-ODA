import type { Task, TaskStatus } from "../types";
import { daysBetween, todayIso } from "./date";

export function getTaskWeight(status: TaskStatus) {
  const weights: Record<TaskStatus, number> = {
    미착수: 0,
    진행중: 0.3,
    완료: 0.7,
    "보고서 반영": 0.9,
    "발주처 확인": 1
  };

  return weights[status] ?? 0;
}

export function calculateTaskProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, task) => sum + getTaskWeight(task.status), 0);
  return (totalWeight / tasks.length) * 100;
}

export function calculateScheduleProgress(startDate: string, endDate: string) {
  const totalDays = Math.max(daysBetween(startDate, endDate), 1);
  const elapsedDays = Math.min(Math.max(daysBetween(startDate, todayIso()), 0), totalDays);
  return (elapsedDays / totalDays) * 100;
}

export function calculateIntegratedProgress(taskProgress: number, scheduleProgress: number) {
  return taskProgress * 0.7 + scheduleProgress * 0.3;
}

export function formatProgress(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}
