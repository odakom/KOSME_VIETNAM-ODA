import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { loadApprovalsFromSupabase, saveApprovalsToSupabase } from "./approvalService";
import { getComments, getInitialLocalComments, saveComments } from "./commentService";
import { getInitialLocalTaskDeliverables, getTaskDeliverables, saveTaskDeliverables } from "./deliverableService";
import { localStorageRepository } from "./storage";
import { getInitialLocalTasks, getTasks } from "./taskService";
import type { AppData } from "../types";
import { logDataError, validateTasks } from "../utils/dataSafety";

function debugLog(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  if (meta === undefined) console.log(message);
  else console.log(message, meta);
}

function debugError(message: string, error: unknown) {
  if (import.meta.env.DEV) console.error(message, error);
}

export function usePersistentData() {
  const repository = useMemo(() => localStorageRepository, []);
  const [supabaseError, setSupabaseError] = useState(isSupabaseConfigured ? "" : "Supabase ?섍꼍蹂?섍? ?ㅼ젙?섏? ?딆븯?듬땲??");
  const [data, setData] = useState<AppData>(() => ({
    ...repository.load(),
    tasks: isSupabaseConfigured ? [] : getInitialLocalTasks(),
    taskDeliverables: isSupabaseConfigured ? [] : getInitialLocalTaskDeliverables(),
    comments: isSupabaseConfigured ? [] : getInitialLocalComments()
  }));
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(isSupabaseConfigured);

  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSupabaseError("Supabase ?섍꼍蹂?섍? ?ㅼ젙?섏? ?딆븯?듬땲??");
      return;
    }

    let nextError = "";
    setIsSupabaseLoading(true);
    setSupabaseError("");
    const nextData: Partial<AppData> = {};

    try {
      const tasks = await getTasks();
      if (tasks) nextData.tasks = tasks;
    } catch (error) {
      debugError("Supabase tasks load failed. Keeping current tasks.", error);
      logDataError("tasks.load", error);
      nextError = "?곗씠??濡쒕뱶 ?ㅽ뙣: Supabase tasks瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??";
    }

    try {
      const taskDeliverables = await getTaskDeliverables();
      if (taskDeliverables) nextData.taskDeliverables = taskDeliverables;
    } catch (error) {
      debugError("Supabase task deliverables load failed. Keeping current deliverables.", error);
      logDataError("deliverables.load", error);
      nextError ||= "?곗씠??濡쒕뱶 ?ㅽ뙣: Supabase task_deliverables瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??";
    }

    try {
      const comments = await getComments();
      if (comments) nextData.comments = comments;
    } catch (error) {
      debugError("Supabase comments load failed. Keeping current comments.", error);
      logDataError("comments.load", error);
      nextError ||= "?곗씠??濡쒕뱶 ?ㅽ뙣: Supabase comments瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??";
    }

    try {
      const approvals = await loadApprovalsFromSupabase();
      if (approvals) nextData.approvals = approvals;
    } catch (error) {
      debugError("Supabase approvals load failed. Keeping current approvals.", error);
      logDataError("approvals.load", error);
      nextError ||= "?곗씠??濡쒕뱶 ?ㅽ뙣: Supabase approvals瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??";
    }

    setData((current) => ({ ...current, ...nextData }));
    if (nextError) setSupabaseError(nextError);
    setIsSupabaseLoading(false);
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && data.tasks.length === 0) return;
    repository.save(data);
  }, [data, repository]);

  useEffect(() => {
    refreshFromSupabase();
  }, [refreshFromSupabase]);

  useEffect(() => {
    const handleStorage = () => {
      if (isSupabaseConfigured) return;
      setData({ ...repository.load(), tasks: getInitialLocalTasks(), taskDeliverables: getInitialLocalTaskDeliverables(), comments: getInitialLocalComments() });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [repository]);

  const saveData = useCallback((nextData: AppData) => {
    validateTasks(nextData.tasks);
    repository.save(nextData);
    setData(nextData);
    saveTaskDeliverables(nextData.taskDeliverables).catch((error) => {
      debugLog("Task deliverables save failed. App data fallback is preserved.", error);
    });
    saveComments(nextData.comments).catch((error) => {
      debugLog("Comments save failed. App data fallback is preserved.", error);
    });
    if (isSupabaseConfigured) {
      Promise.all([
        saveApprovalsToSupabase(nextData.approvals)
      ]).catch((error) => {
        debugLog("Supabase save failed. localStorage fallback is preserved.", error);
      });
    }
  }, [repository]);

  const reset = async () => {
    window.alert("?곗씠???덉젙?깆쓣 ?꾪빐 ?붾㈃ 珥덇린??湲곕뒫? 鍮꾪솢?깊솕?덉뒿?덈떎. Supabase ?곗씠?곕뒗 蹂寃쎈릺吏 ?딆뒿?덈떎.");
  };

  return { data, setData: saveData, reset, supabaseError, refreshFromSupabase, isSupabaseLoading };
}

