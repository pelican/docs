'use client';

import { useEffect, useId, useState } from 'react';

/** ```mermaid code blocks, drawn in the browser and redrawn on theme change. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import('mermaid');
      const dark = document.documentElement.classList.contains('dark');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: dark ? 'dark' : 'default',
      });
      const result = await mermaid.render(`mermaid-${id}-${dark ? 'd' : 'l'}`, chart);
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

  if (!svg) return <pre className="text-sm">{chart}</pre>;
  // Mermaid output for our own content, rendered with securityLevel 'strict'.
  return <div className="my-6 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}
