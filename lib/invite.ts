export function extractInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Accept UUID-ish code directly
  if (/^[0-9a-fA-F-]{8,}$/.test(trimmed) && trimmed.includes("-")) return trimmed;

  // Accept full URL containing ?invite=CODE or /invite/CODE
  try {
    const url = new URL(trimmed);
    const qp = url.searchParams.get("invite");
    if (qp) return qp;
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "invite");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]!;
  } catch {
    // not a URL
  }

  return null;
}

