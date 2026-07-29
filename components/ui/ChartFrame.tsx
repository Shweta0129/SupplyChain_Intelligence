"use client";

import { useEffect, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Recharts measures its parent, so it cannot render on the server. This frame
 * reserves the exact final height during SSR and on the first paint, which
 * keeps the page from reflowing when the charts mount.
 */
export default function ChartFrame({
  height,
  children,
}: {
  height: number;
  children: ReactElement;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center"
        aria-hidden
      >
        <span className="text-[11px] text-muted">Rendering…</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}
