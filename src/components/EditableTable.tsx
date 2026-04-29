import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export type FieldType = "text" | "number" | "date" | "boolean" | "textarea" | "select";

export interface Field<T> {
  key: keyof T & string;
  label: string;
  type?: FieldType;
  options?: string[];
  wide?: boolean;
}

interface Props<T extends { id: string }> {
  rows: T[];
  fields: Field<T>[];
  onChange: (rows: T[]) => void;
  createRow: () => T;
  title?: string;
  description?: string;
  readOnly?: boolean;
  rowActions?: (row: T) => ReactNode;
  rowActionsLabel?: string;
}

export function EditableTable<T extends { id: string }>({ rows, fields, onChange, createRow, title, description, readOnly, rowActions, rowActionsLabel = "작업" }: Props<T>) {
  const update = (id: string, key: keyof T & string, value: string | number | boolean) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const remove = (id: string) => {
    if (window.confirm("선택한 행을 삭제하시겠습니까?")) onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || description || !readOnly) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {!readOnly ? (
            <button className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={() => onChange([...rows, createRow()])}>
              <Plus size={16} /> 행 추가
            </button>
          ) : null}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {fields.map((field) => (
                <th key={field.key} className="min-w-36 px-3 py-3 text-left font-semibold text-slate-600">
                  {field.label}
                </th>
              ))}
              {rowActions ? <th className="min-w-32 px-3 py-3 text-left font-semibold text-slate-600">{rowActionsLabel}</th> : null}
              {!readOnly ? <th className="w-12 px-3 py-3" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                {fields.map((field) => {
                  const value = row[field.key] as string | number | boolean;
                  const common = "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-odakom";
                  return (
                    <td key={field.key} className={field.wide ? "min-w-72 px-3 py-3" : "px-3 py-3"}>
                      {readOnly ? (
                        <span className="whitespace-pre-wrap text-slate-700">{field.type === "boolean" ? (value ? "확인" : "미확인") : String(value ?? "")}</span>
                      ) : field.type === "textarea" ? (
                        <textarea className={`${common} min-h-20`} value={String(value ?? "")} onChange={(event) => update(row.id, field.key, event.target.value)} />
                      ) : field.type === "select" ? (
                        <select className={common} value={String(value ?? "")} onChange={(event) => update(row.id, field.key, event.target.value)}>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "boolean" ? (
                        <input className="h-5 w-5 accent-odakom" type="checkbox" checked={Boolean(value)} onChange={(event) => update(row.id, field.key, event.target.checked)} />
                      ) : (
                        <input className={common} type={field.type ?? "text"} value={String(value ?? "")} onChange={(event) => update(row.id, field.key, field.type === "number" ? Number(event.target.value) : event.target.value)} />
                      )}
                    </td>
                  );
                })}
                {rowActions ? <td className="px-3 py-3">{rowActions(row)}</td> : null}
                {!readOnly ? (
                  <td className="px-3 py-3">
                    <button aria-label="삭제" className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => remove(row.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
