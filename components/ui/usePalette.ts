"use client";

import { useEffect, useState } from "react";
import { darkPalette, lightPalette, type Palette } from "@/lib/palette";

/**
 * Charts need real colour values, not CSS variables — Recharts writes them into
 * SVG attributes. So the theme has to be readable in JS.
 *
 * The server always renders the light palette, which matches the light-first
 * design; the dark steps swap in after hydration if the OS asks for them.
 */
export function usePalette(): Palette {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return dark ? darkPalette : lightPalette;
}
