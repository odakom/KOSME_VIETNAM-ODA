import { useCallback } from "react";
import type { AppData, TaskDeliverable } from "../types";
import { addTaskDeliverable, deleteTaskDeliverable, getDeliverablesByTaskId, saveTaskDeliverables, saveTaskDeliverablesForTask, toggleClientVisibility, updateTaskDeliverable } from "./deliverableService";

export function useDeliverables(data: AppData, setData: (data: AppData) => void) {
  const logSaveFailure = (error: unknown) => {
    if (import.meta.env.DEV) console.error("Task deliverables save failed. App data fallback is preserved.", error);
  };

  const setDeliverables = useCallback((taskDeliverables: TaskDeliverable[]) => {
    setData({ ...data, taskDeliverables });
    saveTaskDeliverables(taskDeliverables).catch((error) => {
      logSaveFailure(error);
    });
  }, [data, setData]);

  return {
    deliverables: data.taskDeliverables,
    getByTaskId: (taskId: string) => getDeliverablesByTaskId(taskId, data.taskDeliverables),
    setDeliverables,
    saveForTask: async (taskId: string, taskDeliverables: TaskDeliverable[]) => {
      const next = [
        ...data.taskDeliverables.filter((deliverable) => deliverable.taskId !== taskId),
        ...taskDeliverables
      ];
      setData({ ...data, taskDeliverables: next });
      try {
        const saved = await saveTaskDeliverablesForTask(taskId, taskDeliverables);
        setData({ ...data, taskDeliverables: saved });
        return saved;
      } catch (error) {
        if (import.meta.env.DEV) console.error("Task deliverables save failed:", error);
        window.alert("?곗텧臾???μ뿉 ?ㅽ뙣?덉뒿?덈떎. Supabase task_deliverables 沅뚰븳怨?而щ읆???뺤씤??二쇱꽭??");
        throw error;
      }
    },
    add: async (deliverable: TaskDeliverable) => {
      const next = [...data.taskDeliverables, deliverable];
      setDeliverables(next);
      await addTaskDeliverable(deliverable);
    },
    update: async (deliverableId: string, updates: Partial<TaskDeliverable>) => {
      const previous = data.taskDeliverables;
      const next = data.taskDeliverables.map((deliverable) => deliverable.id === deliverableId ? { ...deliverable, ...updates } : deliverable);
      setData({ ...data, taskDeliverables: next });
      try {
        await updateTaskDeliverable(deliverableId, updates);
      } catch (error) {
        setData({ ...data, taskDeliverables: previous });
        throw error;
      }
    },
    remove: async (deliverableId: string) => {
      const previous = data.taskDeliverables;
      const next = data.taskDeliverables.filter((deliverable) => deliverable.id !== deliverableId);
      setData({ ...data, taskDeliverables: next });
      try {
        await deleteTaskDeliverable(deliverableId);
      } catch (error) {
        setData({ ...data, taskDeliverables: previous });
        throw error;
      }
    },
    toggleVisibility: async (deliverableId: string, isVisibleToClient: boolean) => {
      const next = data.taskDeliverables.map((deliverable) => deliverable.id === deliverableId ? { ...deliverable, isVisibleToClient } : deliverable);
      setDeliverables(next);
      await toggleClientVisibility(deliverableId, isVisibleToClient);
    }
  };
}

