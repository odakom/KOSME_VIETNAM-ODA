import type { AppData, Contract } from "../types";
import { daysBetween, formatCurrency, percentElapsed, todayIso } from "../utils/date";

const fields: Array<{ key: keyof Contract; label: string; type?: string }> = [
  { key: "name", label: "계약명" },
  { key: "client", label: "발주처" },
  { key: "contractor", label: "계약상대자" },
  { key: "amount", label: "계약금액", type: "number" },
  { key: "periodStart", label: "계약 시작일", type: "date" },
  { key: "periodEnd", label: "계약 종료일", type: "date" },
  { key: "deliveryDue", label: "납품기한", type: "date" },
  { key: "paymentMethod", label: "지급방법" },
  { key: "delayPenaltyRate", label: "지체상금률" },
  { key: "guaranteeDeposit", label: "계약보증금" },
  { key: "inspectionAgency", label: "검사기관" },
  { key: "acceptanceAgency", label: "검수기관" },
  { key: "contractType", label: "계약구분" },
  { key: "specialNotes", label: "특기사항" }
];

export function ContractPage({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const dday = daysBetween(todayIso(), data.contract.deliveryDue);
  const elapsed = percentElapsed(data.contract.periodStart, data.contract.periodEnd);
  const unfinished = data.tasks.filter((task) => !["완료", "보고서 반영", "발주처 확인"].includes(task.status)).length;
  const risk = dday < 0 ? "지연 발생" : dday <= 14 && unfinished > 0 ? "높음" : dday <= 30 ? "주의" : "정상";

  const update = (key: keyof Contract, value: string | number) => {
    setData({ ...data, contract: { ...data.contract, [key]: value } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">계약관리</h1>
        <p className="mt-1 text-sm text-slate-500">계약기간과 납품기한 기준으로 지연 위험을 자동 계산합니다.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">계약금액</div><div className="mt-2 text-xl font-semibold text-ink">{formatCurrency(data.contract.amount)}</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">기간 경과율</div><div className="mt-2 text-xl font-semibold text-ink">{elapsed}%</div></div>
        <div className={`rounded-lg border p-4 shadow-sm ${risk === "정상" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="text-sm text-slate-600">지연 위험</div><div className="mt-2 text-xl font-semibold text-ink">{risk}</div></div>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className={field.key === "specialNotes" || field.key === "name" ? "md:col-span-2" : ""}>
              <span className="mb-1 block text-sm font-semibold text-slate-600">{field.label}</span>
              {field.key === "specialNotes" ? (
                <textarea className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-odakom" value={String(data.contract[field.key])} onChange={(event) => update(field.key, event.target.value)} />
              ) : (
                <input className="w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-odakom" type={field.type ?? "text"} value={String(data.contract[field.key])} onChange={(event) => update(field.key, field.type === "number" ? Number(event.target.value) : event.target.value)} />
              )}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
