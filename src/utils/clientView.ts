import type { ClientComment, Task, TaskDeliverable } from "../types";

export function getClientVisibleTasks(tasks: Task[]) {
  return tasks.filter((task) => task.isVisibleToClient !== false);
}

export function getClientVisibleDeliverables(deliverables: TaskDeliverable[]) {
  return deliverables.filter((deliverable) => deliverable.isVisibleToClient === true);
}

export function getClientVisibleComments(comments: ClientComment[]) {
  return comments.filter((comment) => comment.authorRole === "client");
}

export function getClientCommentsByTarget(comments: ClientComment[], targetType: ClientComment["targetType"], targetId: string) {
  return getClientVisibleComments(comments).filter((comment) => comment.targetType === targetType && comment.targetId === targetId);
}
