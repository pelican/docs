'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { ownedSiteTab } from '@/lib/owned-sites';

/** sessionStorage flag ("1") set by "Don't ask again during this visit". */
const SKIP_KEY = 'pelican-docs:leave-ok';

/**
 * Names for places people go to often, so the dialog can say where they're
 * headed. (Pelican's own GitHub, raw files and Discord never reach the dialog;
 * GitHub here means someone else's profile or repo.)
 */
function describe(url: URL): string {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'github.com') return 'GitHub';
  if (host.endsWith('steampowered.com')) return 'the Steam store';
  return host;
}

/**
 * Opens a Pelican-owned link in a new tab the browser's own way: mark the
 * anchor target="_blank" rel="noopener noreferrer" just for this click, then
 * put its attributes back so a later href change isn't affected.
 */
function openInNewTabNatively(link: HTMLAnchorElement) {
  const target = link.getAttribute('target');
  const rel = link.getAttribute('rel');
  const relTokens = new Set((rel ?? '').split(/\s+/).filter(Boolean));
  relTokens.add('noopener');
  relTokens.add('noreferrer');
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', [...relTokens].join(' '));
  // The browser follows the link right after this click event finishes.
  setTimeout(() => {
    if (target === null) link.removeAttribute('target');
    else link.setAttribute('target', target);
    if (rel === null) link.removeAttribute('rel');
    else link.setAttribute('rel', rel);
  }, 0);
}

/**
 * Site-wide policy for clicks on links (checked at click time, so it also
 * covers links rendered or changed later; Enter on a focused link is a click):
 *
 * 1. This site, pelican.dev and *.pelican.dev (hub, …): no dialog, normal
 *    same-tab navigation.
 * 2. The live demo (demo.pelican.dev, `newTabSubdomains`) and Pelican's places
 *    on other domains (its GitHub orgs, raw files, the eggs site, image
 *    storage, the official Discord invite; `ownedElsewhere`): no dialog,
 *    opens in a new tab. Both lists are in lib/owned-sites.ts.
 * 3. Any other website: asks first, "You're leaving pelican.dev". Continue
 *    opens it in a new tab; "Don't ask again during this visit" skips the
 *    dialog for the rest of the session.
 *
 * Left alone: middle clicks, links with `download`, and links marked
 * `data-no-leave-check`. Ctrl/Cmd/Shift/Alt-clicks on Pelican-owned links go
 * to the browser as usual; on other websites they still ask first.
 */
export function ExternalLinkGuard() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<URL | null>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute('download') || link.dataset.noLeaveCheck !== undefined) return;

      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      // 1. This site, or a Pelican site that opens in the same tab: navigate as usual.
      if (url.host === window.location.host) return;
      const owned = ownedSiteTab(url);
      if (owned === 'same-tab') return;

      // 2. Pelican-owned, opens in a new tab: no dialog.
      if (owned === 'new-tab') {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        openInNewTabNatively(link);
        return;
      }

      // 3. Someone else's website: ask first, unless told not to this visit.
      try {
        if (sessionStorage.getItem(SKIP_KEY) === '1') {
          event.preventDefault();
          window.open(url.href, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch {
        /* storage blocked: always ask */
      }

      event.preventDefault();
      setRemember(false);
      setTarget(url);
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (target && !el.open) el.showModal();
    if (!target && el.open) el.close();
  }, [target]);

  function go() {
    if (!target) return;
    if (remember) {
      try {
        sessionStorage.setItem(SKIP_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    window.open(target.href, '_blank', 'noopener,noreferrer');
    setTarget(null);
  }

  return (
    <dialog
      ref={dialog}
      className="xl-dialog"
      aria-labelledby="xl-title"
      aria-describedby="xl-desc"
      onClose={() => setTarget(null)}
      onClick={(event) => {
        // A click on the backdrop (outside the box) closes it.
        if (event.target === dialog.current) setTarget(null);
      }}
    >
      {target && (
        <div className="xl-dialog__box">
          <button type="button" className="xl-dialog__close" onClick={() => setTarget(null)} aria-label="Stay on pelican.dev">
            <X size={20} aria-hidden />
          </button>
          <p className="xl-dialog__kicker">Leaving pelican.dev</p>
          <h2 id="xl-title" className="xl-dialog__title">
            You&apos;re going to {describe(target)}.
          </h2>
          <p id="xl-desc" className="xl-dialog__desc">
            This link opens another website in a new tab. Pelican doesn&apos;t control what&apos;s there.
          </p>
          <p className="xl-dialog__url">{target.href}</p>
          <label className="xl-dialog__remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Don&apos;t ask again during this visit
          </label>
          <div className="xl-dialog__actions">
            <button type="button" className="xl-btn xl-btn--go" onClick={go} autoFocus>
              Continue <ArrowUpRight size={18} aria-hidden />
            </button>
            <button type="button" className="xl-btn" onClick={() => setTarget(null)}>
              Stay here
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
