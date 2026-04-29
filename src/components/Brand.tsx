export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-md bg-[#fbf7ec]">
        <img className="h-9 w-9 object-contain" src="/odakom-logo.png" alt="ODAKOM" />
      </div>
      <div>
        <div className="text-xl font-bold tracking-normal text-ink">odakom</div>
        <div className="text-xs font-medium text-slate-500">ODA 평가용역 통합관리</div>
      </div>
    </div>
  );
}
