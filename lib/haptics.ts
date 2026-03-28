export function hapticLight() {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(10);
  } catch {
    // no-op
  }
}

