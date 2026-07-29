import Dashboard from "@/components/Dashboard";
import aggregates from "@/public/data/aggregates.json";
import meta from "@/public/data/meta.json";
import type { Aggregates, Meta } from "@/lib/types";

/**
 * Fully static. The unfiltered aggregates were computed at build time by
 * scripts/aggregate.py, so the first paint is a plain HTML document with every
 * number already in it — no dataset fetch, no query, no cold start.
 */
export default function Page() {
  return (
    <Dashboard
      initial={aggregates as unknown as Aggregates}
      meta={meta as unknown as Meta}
    />
  );
}
