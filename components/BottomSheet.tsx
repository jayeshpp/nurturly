"use client";

import { type ReactNode, useEffect } from "react";

export function BottomSheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-zinc-950 px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
        <div className="mb-3 text-base font-semibold text-white">{title}</div>
        <div className="grid gap-2">{children}</div>
      </div>
    </div>
  );
}

