import type { Task } from "../types";

export const taskGroups = [
  "착수 단계",
  "설계 단계",
  "문헌조사 단계",
  "정량평가",
  "정성평가",
  "보고 및 납품 단계"
];

export function getTaskGroup(task: Task) {
  if (task.group) return task.group;
  const text = `${task.category} ${task.title} ${task.deliverable}`.toLowerCase();
  if (/착수보고|수행계획|착수/.test(text)) return "착수 단계";
  if (/평가방법론|지표|pdm|매트릭스/.test(text)) return "설계 단계";
  if (/문헌조사|문헌/.test(text)) return "문헌조사 단계";
  if (/설문|데이터|통계|정량/.test(text)) return "정량평가";
  if (/면담|인터뷰|fgd|정성/.test(text)) return "정성평가";
  if (/보고서|최종|납품|요약본|발표자료|정산|의견 반영/.test(text)) return "보고 및 납품 단계";
  return "설계 단계";
}

export function getGroupOrder(group: string) {
  const index = taskGroups.indexOf(group);
  return index >= 0 ? index + 1 : taskGroups.length + 1;
}

export function normalizeTaskGroup(task: Task): Task {
  const group = getTaskGroup(task);
  return { ...task, group, groupOrder: task.groupOrder ?? getGroupOrder(group) };
}

export function groupTasks(tasks: Task[]) {
  const normalized = tasks.map(normalizeTaskGroup);
  return taskGroups.map((group) => ({
    group,
    groupOrder: getGroupOrder(group),
    tasks: normalized
      .filter((task) => getTaskGroup(task) === group)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.dueDate.localeCompare(b.dueDate))
  })).filter((item) => item.tasks.length > 0);
}

export function calculateGroupProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  const score = tasks.reduce((sum, task) => {
    if (["완료", "보고서 반영", "발주처 확인"].includes(task.status)) return sum + 1;
    if (task.status === "진행중") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((score / tasks.length) * 100);
}
