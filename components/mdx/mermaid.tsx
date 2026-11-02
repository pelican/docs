'use client';

import { useEffect, useId, useState } from 'react';

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
        theme: dark ? 'dark' : 'default',
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
