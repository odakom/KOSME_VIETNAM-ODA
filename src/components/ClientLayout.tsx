import { LogOut } from "lucide-react";
import { Brand } from "./Brand";
import type { MenuItem } from "./Layout";

interface Props {
  page: string;
  menu: MenuItem[];
  onPageChange: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function ClientLayout({ page, menu, onPageChange, onLogout, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 p-5"><Brand /></div>
        <nav className="p-3">
          {menu.map((item) => (
            <button key={item.id} onClick={() => onPageChange(item.id)} className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium ${page === item.id ? "bg-public text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="lg:hidden"><Brand /></div>
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm lg:hidden" value={page} onChange={(event) => onPageChange(event.target.value)}>
              {menu.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 sm:ml-auto" onClick={onLogout}>
              <LogOut size={16} /> 나가기
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</div>
      </main>
    </div>
  );
}
