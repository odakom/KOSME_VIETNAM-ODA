import type { Task } from "../types";
import { daysBetween, todayIso } from "./date";

const completedStatuses: Task["status"][] = ["완료", "보고서 반영", "발주처 확인"];

export function getUpcomingTasks(tasks: Task[], limit = 8) {
  return tasks
    .filter((task) => task.dueDate && !completedStatuses.includes(task.status) && daysBetween(todayIso(), task.dueDate) >= 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.startDate.localeCompare(b.startDate))
    .slice(0, limit);
}
