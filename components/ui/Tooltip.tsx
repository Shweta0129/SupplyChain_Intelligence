"use client";

import type { ReactNode } from "react";

export type TipRow = { label: string; value: string; color?: string };

/** One tooltip shell for every chart — same shadow, same type scale. */
export function TipBox({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: TipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="pointer-events-none rounded-xl border border-line bg-card px-3 py-2 shadow-[0_10px_30px_rgba(11,20,55,0.16)]">
      <div className="mb-1 text-[11.5px] font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11.5px]">
          {r.color && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: r.color }}
            />
          )}
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto font-semibold text-ink tabular-nums">
            {r.value}
          </span>
        </div>
      ))}
      {footer && <div className="mt-1 text-[10.5px] text-muted">{footer}</div>}
    </div>
  );
}

export const tooltipCursor = (fill: string) => ({ fill, fillOpacity: 0.35 });
