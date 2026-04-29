import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  interactive?: boolean;
}

export function StatCard({ label, value, hint, interactive }: Props) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition ${interactive ? "cursor-pointer hover:-translate-y-0.5 hover:border-odakom hover:shadow-md" : ""}`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </section>
  );
}
