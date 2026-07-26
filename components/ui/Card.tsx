"use client";

import type { ReactNode } from "react";

export default function Card({
  title,
  sub,
  children,
  className = "",
  bodyClassName = "",
  action,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`surface card-hover fade-up flex flex-col rounded-[20px] ${className}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-1">
        <div className="min-w-0">
          <h2 className="text-[14.5px] leading-tight font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-[11.5px] text-muted">{sub}</p>}
        </div>
        {action}
      </header>
      <div className={`min-w-0 flex-1 px-1 pt-1 pb-2 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
