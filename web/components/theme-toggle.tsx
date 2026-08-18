"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Plate or paper. The choice is stored, and an inline script in the layout
 * applies it before first paint so neither theme ever flashes.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("aval-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to the engraving plate" : "Switch to the paper"}
      title={theme === "light" ? "Plate" : "Paper"}
      className="inline-flex size-8 items-center justify-center border border-rule text-ink-dim transition-colors hover:border-rule-bright hover:text-ink"
    >
      {/* Both icons render until hydration settles, so the button never jumps. */}
      {theme === "light" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
    </button>
  );
}
