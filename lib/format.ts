/** Formatting helpers — ported 1:1 from the Streamlit app so labels match. */

export function money(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3).toLocaleString("en-US")}K`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

export function dollars(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function pct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}

export function count(v: number): string {
  return v.toLocaleString("en-US");
}

export function axisMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

export function axisCount(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}K`;
  return `${v}`;
}

/** "2015-01" → "Jan '15" for the monthly trend axis. */
export function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1]} '${y.slice(2)}`;
}

/** Truncate long category / product names so y-axis ticks never collide. */
export function clipLabel(s: string, max = 26): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
