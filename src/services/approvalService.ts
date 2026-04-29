import { isSupabaseConfigured, requireSupabase } from "../lib/supabaseClient";
import type { Approval } from "../types";

const toApproval = (row: Record<string, unknown>): Approval => ({
  id: String(row.id),
  targetType: row.target_type as Approval["targetType"],
  targetId: String(row.target_id),
  approvedBy: String(row.approved_by ?? ""),
  approvedAt: String(row.approved_at ?? ""),
  status: row.status as Approval["status"],
  note: String(row.note ?? "")
});

const fromApproval = (approval: Approval) => ({
  id: approval.id,
  target_type: approval.targetType,
  target_id: approval.targetId,
  approved_by: approval.approvedBy,
  approved_at: approval.approvedAt || null,
  status: approval.status,
  note: approval.note
});

export async function loadApprovalsFromSupabase() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await requireSupabase().from("approvals").select("*").order("approved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toApproval);
}

export async function saveApprovalsToSupabase(approvals: Approval[]) {
  if (!isSupabaseConfigured) return;
  const { error } = await requireSupabase().from("approvals").upsert(approvals.map(fromApproval), { onConflict: "id" });
  if (error) throw error;
}
