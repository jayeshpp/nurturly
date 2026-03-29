export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function dayRangeUtcIso(date: Date) {
  const start = startOfLocalDay(date);
  const end = endOfLocalDay(date);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function formatTimeLocal(isoUtc: string) {
  const d = new Date(isoUtc);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDurationMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const totalMin = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (totalMin > 0) return `${totalMin}m ${s}s`;
  return `${s}s`;
}

