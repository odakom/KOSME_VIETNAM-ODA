import { LogOut, ShieldCheck, UserCheck } from "lucide-react";
import { Brand } from "./Brand";
import type { Role } from "../types";

export interface MenuItem {
  id: string;
  label: string;
}

interface Props {
  role: Role;
  page: string;
  menu: MenuItem[];
  onRoleChange: (role: Role) => void;
  onPageChange: (page: string) => void;
  onReset?: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export function Layout({ role, page, menu, onRoleChange, onPageChange, onReset, onLogout, children }: Props) {
  void onReset;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 p-5">
          <Brand />
        </div>
        <nav className="h-[calc(100vh-88px)] overflow-y-auto p-3">
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                page === item.id ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="lg:hidden">
              <Brand />
            </div>
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm lg:hidden" value={page} onChange={(event) => onPageChange(event.target.value)}>
              {menu.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <button className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${role === "admin" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => onRoleChange("admin")}>
                <ShieldCheck size={16} /> 내부관리자
              </button>
              <button className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${role === "client" ? "bg-public text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => onRoleChange("client")}>
                <UserCheck size={16} /> 발주처
              </button>
              {onLogout ? (
                <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200" onClick={onLogout}>
                  <LogOut size={16} /> 로그아웃
                </button>
              ) : null}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</div>
      </main>
    </div>
  );
}
