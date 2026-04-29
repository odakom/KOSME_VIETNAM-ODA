import { useCallback } from "react";
import type { AppData, ClientComment } from "../types";
import { addComment, getComments, getCommentsByTarget, saveComments } from "./commentService";

function debugLog(message: string, meta?: unknown) {
  if (!import.meta.env.DEV) return;
  if (meta === undefined) console.log(message);
  else console.log(message, meta);
}

function debugError(message: string, error: unknown) {
  if (import.meta.env.DEV) console.error(message, error);
}

export function useComments(data: AppData, setData: (data: AppData) => void) {
  const persistComments = useCallback(async (comments: ClientComment[]) => {
    setData({ ...data, comments });
    await saveComments(comments);
  }, [data, setData]);

  const setComments = useCallback((comments: ClientComment[]) => {
    persistComments(comments).catch((error) => {
      debugLog("Comments save failed. App data fallback is preserved.", error);
    });
  }, [persistComments]);

  return {
    comments: data.comments,
    getByTarget: (targetType: ClientComment["targetType"], targetId: string) => getCommentsByTarget(targetType, targetId, data.comments),
    setComments,
    add: async (comment: ClientComment) => {
      try {
        const comments = await addComment(comment);
        setData({ ...data, comments });
        return comments;
      } catch (error) {
        debugError("Failed to save comment:", error);
        window.alert(`?섍껄 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎. ${error instanceof Error ? error.message : "Supabase comments ?뚯씠釉붽낵 沅뚰븳 ?ㅼ젙???뺤씤??二쇱꽭??"}`);
        throw error;
      }
    },
    refresh: async () => {
      const comments = await getComments();
      setData({ ...data, comments });
      return comments;
    },
    update: async (commentId: string, updates: Partial<ClientComment>) => {
      const now = new Date().toISOString();
      const next = data.comments.map((comment) => comment.id === commentId ? { ...comment, ...updates, updatedAt: now } : comment);
      await persistComments(next);
    },
    remove: async (commentId: string) => {
      const next = data.comments.filter((comment) => comment.id !== commentId);
      await persistComments(next);
    },
    updateStatus: async (commentId: string, status: ClientComment["status"]) => {
      const now = new Date().toISOString();
      const next = data.comments.map((comment) => comment.id === commentId ? { ...comment, status, updatedAt: now } : comment);
      await persistComments(next);
    }
  };
}

