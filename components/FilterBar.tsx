"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterKey, Filters, Meta } from "@/lib/types";

type Group = { key: FilterKey; label: string; options: string[] };

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = selected.length
    ? selected.length === 1
      ? selected[0]
      : `${selected.length} selected`
    : `All ${label.toLowerCase()}s`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-left text-[12px] transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="label-xs shrink-0 !tracking-[0.06em]">{label}</span>
        <span
          className={`ml-auto truncate ${selected.length ? "font-semibold text-ink" : "text-muted"}`}
        >
          {summary}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
          <path
            d="M1 3l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="thin-scroll absolute z-40 mt-1.5 max-h-64 w-full min-w-[190px] overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-[0_18px_40px_rgba(11,20,55,0.18)]"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-brand hover:bg-brand/8"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] hover:bg-[var(--chip)]"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])
                  }
                  className="h-3.5 w-3.5 accent-[var(--brand)]"
                />
                <span className={on ? "font-semibold text-ink" : "text-ink2"}>{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  meta,
  filters,
  onChange,
  ready,
  loading,
  matched,
}: {
  meta: Meta;
  filters: Filters;
  onChange: (next: Filters) => void;
  ready: boolean;
  loading: boolean;
  matched: number;
}) {
  const groups: Group[] = [
    { key: "market", label: "Market", options: meta.dims.market },
    { key: "segment", label: "Segment", options: meta.dims.segment },
    { key: "shipMode", label: "Ship mode", options: meta.dims.shipMode },
    { key: "dept", label: "Department", options: meta.dims.dept },
    { key: "year", label: "Year", options: meta.years.map(String) },
    { key: "status", label: "Status", options: meta.dims.status },
  ];

  const active = Object.values(filters).some((v) => v.length > 0);

  return (
    <div className="surface fade-up rounded-[18px] p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {groups.map((g) => (
          <MultiSelect
            key={g.key}
            label={g.label}
            options={g.options}
            selected={filters[g.key]}
            disabled={!ready}
            onChange={(next) => onChange({ ...filters, [g.key]: next })}
          />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted">
        {!ready && !loading && <span>Filters warming up…</span>}
        {loading && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Loading the 180K-row slice engine…
          </span>
        )}
        {ready && (
          <span>
            <b className="font-semibold text-ink">{matched.toLocaleString("en-US")}</b>{" "}
            of {meta.rows.toLocaleString("en-US")} orders match
          </span>
        )}
        {active && (
          <button
            type="button"
            onClick={() =>
              onChange({ market: [], segment: [], shipMode: [], dept: [], year: [], status: [] })
            }
            className="font-semibold text-brand hover:underline"
          >
            Reset all filters
          </button>
        )}
      </div>
    </div>
  );
}
