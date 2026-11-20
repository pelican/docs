'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookCopy, Check, Copy, X } from 'lucide-react';
import { ViewOptionsPopover } from 'fumadocs-ui/layouts/docs/page';
import { WEBSERVERS } from '@/components/setup/fields';
import { useStoredValue } from '@/components/setup/store';

/**
 * Under each docs page's title: copy the page (or every page) as Markdown for an AI
 * assistant, or open the page in one. The Markdown comes from the build (lib/llms.ts):
 * /docs/md/<page>.md for one page, /llms-full.txt for all of them.
 */
export function PageActions({ markdownUrl, githubUrl }: { markdownUrl: string; githubUrl: string }) {
  const setupNote = useSetupNote();
  return (
    <div className="dt-actions not-prose" role="group" aria-label="Use this page with an AI assistant">
      <CopyButton url={markdownUrl} prefix={setupNote} icon={<Copy />} title="Copy this page as Markdown, to paste into an AI assistant">
        Copy page
      </CopyButton>
      <CopyButton url="/llms-full.txt" icon={<BookCopy />} title="Copy every docs page as one Markdown file (about 60,000 tokens)">
        Copy all docs
      </CopyButton>
      <ViewOptionsPopover className="dt-action" markdownUrl={markdownUrl} githubUrl={githubUrl}>
        Open in…
      </ViewOptionsPopover>
    </div>
  );
}

type State = 'idle' | 'busy' | 'done' | 'failed';

function CopyButton({
  url,
  prefix,
  icon,
  title,
  children,
}: {
  url: string;
  prefix?: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    setState('busy');
    try {
      const text = fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return (prefix ?? '') + (await response.text());
      });
      // Safari only allows a clipboard write started by the click itself, so the
      // ClipboardItem is made now and given the text when the download finishes.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setState('done');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2500);
  }

  return (
    <button type="button" className="dt-action" onClick={copy} disabled={state === 'busy'} title={title}>
      {state === 'done' ? <Check aria-hidden /> : state === 'failed' ? <X aria-hidden /> : icon}
      <span aria-live="polite">{state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : children}</span>
    </button>
  );
}

/**
 * What the reader entered in "Your setup", as a line to put above a copied page, so the
 * assistant answers for their install. Empty when nothing was entered. Values stay in the
 * page text untouched: only this note is added.
 */
function useSetupNote(): string {
  const domain = useStoredValue('setup:domain');
  const path = useStoredValue('setup:path');
  const php = useStoredValue('setup:php');
  const webserver = useStoredValue('tabs:webserver');
  const ssl = useStoredValue('tabs:ssl');

  const parts = [
    domain && `domain \`${domain}\``,
    webserver && `web server ${WEBSERVERS.find((item) => item.value === webserver)?.label ?? webserver}`,
    ssl && (ssl === 'http' ? 'HTTP only' : 'HTTPS (SSL)'),
    php && `PHP ${php}`,
    path && `install folder \`${path}\``,
  ].filter(Boolean);
  return parts.length ? `> My setup (from the docs' "Your setup" box): ${parts.join(', ')}.\n\n` : '';
}
