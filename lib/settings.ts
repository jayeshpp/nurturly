import { db } from "@/lib/db";
import { nowIsoUtc } from "@/lib/time";

export type AppMode = "offline" | "online";

export async function getSetting(key: string) {
  return (await db.settings.get(key))?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value, updated_at: nowIsoUtc() });
}

export async function setSettingJson<T>(key: string, value: T) {
  await setSetting(key, JSON.stringify(value));
}

export async function getSettingJson<T>(key: string): Promise<T | null> {
  const raw = await getSetting(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function isOnboardingComplete() {
  return (await getSetting("onboarding_complete")) === "true";
}

