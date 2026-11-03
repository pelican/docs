import type { DecorationItem, ShikiTransformer } from 'shiki';

/**
 * Parts of a code block that depend on the reader's install. Each one is
 * wrapped in `<span data-setup="…">` at build time; components/setup then swaps
 * in what the reader entered in a <SetupPanel />.
 *
 * Only blocks marked `setup` are touched, e.g. ```nginx setup title="…"
 * so a page like "Upgrading PHP" keeps its literal versions.
 */
const PATTERNS: { field: string; pattern: RegExp; group?: number }[] = [
  { field: 'domain', pattern: /<domain>/g },
  { field: 'path', pattern: /\/var\/www\/pelican/g },
  // Only the version in php8.5-fpm.sock / a2enmod php8.5, not the word "php".
  { field: 'php', pattern: /php(\d+\.\d+)/g, group: 1 },
];

export function hasSetupFlag(meta: string | undefined): boolean {
  return /(^|\s)setup(\s|$)/.test(meta ?? '');
}

export function transformerSetup(): ShikiTransformer {
  return {
    name: 'pelican:setup',
    preprocess(code, options) {
      const meta = (options.meta as { __raw?: string } | undefined)?.__raw;
      if (!hasSetupFlag(meta)) return;

      const decorations: DecorationItem[] = [];
      for (const { field, pattern, group } of PATTERNS) {
        for (const match of code.matchAll(pattern)) {
          const text = group ? match[group] : match[0];
          const start = match.index + (group ? match[0].indexOf(text) : 0);
          decorations.push({
            start,
            end: start + text.length,
            properties: { 'data-setup': field },
          });
        }
      }

      options.decorations = [...(options.decorations ?? []), ...decorations];
    },
  };
}
