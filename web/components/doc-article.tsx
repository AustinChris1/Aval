"use client";

import { useEffect, useRef } from "react";

// Renders a docs article; mermaid fences become diagrams themed with the site palette, imported lazily.
export function DocArticle({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blocks = Array.from(root.querySelectorAll("pre code.language-mermaid"));
    if (blocks.length === 0) return;

    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      const paper = document.documentElement.dataset.theme === "light";

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "var(--font-sans)",
        themeVariables: paper
          ? {
              background: "transparent",
              primaryColor: "#fffdf8",
              primaryTextColor: "#171310",
              primaryBorderColor: "#c2ad87",
              lineColor: "#8a6a33",
              secondaryColor: "#f3e6d1",
              tertiaryColor: "#f8eedf",
              noteBkgColor: "#f3e6d1",
              noteTextColor: "#3f372e",
              actorBorder: "#c2ad87",
              actorBkg: "#fffdf8",
              actorTextColor: "#171310",
              signalColor: "#6e6452",
              signalTextColor: "#3f372e",
              labelBoxBkgColor: "#f3e6d1",
              labelTextColor: "#171310",
            }
          : {
              background: "transparent",
              primaryColor: "#151110",
              primaryTextColor: "#f8eedf",
              primaryBorderColor: "#3e3327",
              lineColor: "#e8c999",
              secondaryColor: "#1d1815",
              tertiaryColor: "#0f0c0a",
              noteBkgColor: "#1d1815",
              noteTextColor: "#d9cdba",
              actorBorder: "#7a5f36",
              actorBkg: "#151110",
              actorTextColor: "#f8eedf",
              signalColor: "#9c907c",
              signalTextColor: "#d9cdba",
              labelBoxBkgColor: "#1d1815",
              labelTextColor: "#f8eedf",
            },
      });

      for (const [i, code] of blocks.entries()) {
        if (cancelled) return;
        const src = code.textContent ?? "";
        try {
          const { svg } = await mermaid.render(`doc-diagram-${i}`, src);
          if (cancelled) return;
          const fig = document.createElement("div");
          fig.className = "mermaid-figure";
          fig.innerHTML = svg;
          code.closest("pre")?.replaceWith(fig);
        } catch {
          // A diagram that fails to parse stays visible as its source text.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <article
      ref={ref}
      className="prose-letter min-w-0 max-w-[76ch]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
