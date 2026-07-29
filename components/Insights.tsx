"use client";

import type { Insight } from "@/lib/types";

const TONE: Record<Insight["tone"], string> = {
  brand: "var(--brand)",
  mint: "var(--mint)",
  amber: "var(--amber)",
  red: "var(--red)",
};

/**
 * The auto-written findings from the Streamlit app. The text is generated with
 * <b> emphasis around the numbers; it is produced entirely by our own
 * aggregation code, never from user input.
 */
export default function Insights({ items }: { items: Insight[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((ins) => (
        <div
          key={ins.label}
          className="surface fade-up rounded-2xl px-4 py-3.5"
          style={{ borderLeft: `4px solid ${TONE[ins.tone]}` }}
        >
          <div className="label-xs mb-1.5">{ins.label}</div>
          <p
            className="text-[12.5px] leading-[1.45] text-ink2 [&_b]:font-semibold [&_b]:text-ink"
            dangerouslySetInnerHTML={{ __html: ins.text }}
          />
        </div>
      ))}
    </div>
  );
}
