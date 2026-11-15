'use client';

import { useEffect, useId, useState } from 'react';

// Colours from ui/tokens.css (--pl-card, --pl-fg, --pl-edge, --pl-muted, --pl-ground).
// The text face by name (next/font registers it under its real name): Mermaid measures the labels
// with it, which a CSS variable can't do.
const FONT = '"Instrument Sans", "Instrument Sans Fallback", sans-serif';
const LIGHT = {
  fontFamily: FONT,
  background: '#f3f7f9',
  primaryColor: '#ffffff',
  primaryTextColor: '#04121c',
  primaryBorderColor: '#04121c',
  lineColor: '#04121c',
  edgeLabelBackground: '#f3f7f9',
};
const DARK = {
  fontFamily: FONT,
  darkMode: true,
  background: '#071926',
  primaryColor: '#0a1e2b',
  primaryTextColor: '#e3ecf1',
  primaryBorderColor: '#b9ccd6',
  lineColor: '#b9ccd6',
  edgeLabelBackground: '#071926',
};

/** ```mermaid code blocks, drawn in the browser and redrawn on theme change. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let drawnDark: boolean | undefined;
    let renders = 0;

    async function render() {
      const dark = document.documentElement.classList.contains('dark');
      // Other class changes on <html> aren't a theme change: keep the current drawing.
      if (dark === drawnDark) return;
      drawnDark = dark;
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        // The site's cards: white (dark: navy card) boxes with square 2px edges, navy lines.
        // "classic": square boxes; Mermaid 12's default "neo" look adds round corners and shadows.
        look: 'classic',
        theme: 'base',
        themeVariables: dark ? DARK : LIGHT,
        themeCSS: '.node rect, .node polygon, .node circle { stroke-width: 2px; }',
      });
      // A fresh id each time: mermaid removes any element that already has the id it's given,
      // which would take the diagram on the page with it.
      const result = await mermaid.render(`mermaid-${id}-${++renders}`, chart);
      if (!cancelled) setSvg(result.svg);
    }

    void render();
    const observer = new MutationObserver(() => void render());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [chart, id]);

  if (!svg) {
    // Until mermaid has drawn it, hold the diagram's space so the page doesn't jump when it
    // appears. Mermaid can't size a diagram without a browser, so this is a typical flowchart's
    // shape (3:1, like the docs home one); a much taller diagram still settles once, on load.
    // Without JavaScript the source is shown instead.
    return (
      <div className="my-6">
        <div aria-hidden className="w-full" style={{ aspectRatio: '3 / 1' }} />
        <noscript>
          <pre className="text-sm">{chart}</pre>
        </noscript>
      </div>
    );
  }
  // Mermaid output for our own content, rendered with securityLevel 'strict'.
  return <div className="my-6 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}
