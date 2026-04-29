export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-public" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}
