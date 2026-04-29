export const todayIso = () => new Date().toISOString().slice(0, 10);

export function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

export function percentElapsed(startIso: string, endIso: string) {
  const total = Math.max(daysBetween(startIso, endIso), 1);
  const elapsed = Math.min(Math.max(daysBetween(startIso, todayIso()), 0), total);
  return Math.round((elapsed / total) * 100);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}
