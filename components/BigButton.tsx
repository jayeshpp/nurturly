"use client";

import type { ComponentProps } from "react";

type Props = ComponentProps<"button"> & {
  label: string;
  subLabel?: string;
};

export function BigButton({ label, subLabel, className, ...props }: Props) {
  return (
    <button
      {...props}
      className={[
        "ripple ripple-light w-full rounded-3xl bg-white px-5 py-5 text-left text-black",
        "active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100",
        className ?? "",
      ].join(" ")}
    >
      <div className="text-2xl font-semibold leading-7">{label}</div>
      {subLabel ? (
        <div className="mt-1 text-sm font-medium text-zinc-600">{subLabel}</div>
      ) : null}
    </button>
  );
}

