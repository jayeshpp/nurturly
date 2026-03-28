export function nowIsoUtc() {
  return new Date().toISOString();
}

export function msSince(isoUtc: string) {
  return Date.now() - Date.parse(isoUtc);
}

