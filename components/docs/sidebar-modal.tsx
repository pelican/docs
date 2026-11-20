'use client';

import { useEffect, useRef } from 'react';
import { useSidebar } from 'fumadocs-ui/layouts/docs/slots/sidebar';

const DRAWER = 'nd-sidebar-mobile';

/**
 * Makes Fumadocs' phone sidebar (#nd-sidebar-mobile) behave as the modal dialog it looks
 * like: Escape closes it, everything behind it is `inert` (Tab can't reach the hidden page,
 * screen readers don't read it), focus moves into it when it opens and back to the
 * "Open Sidebar" button when it closes. Renders nothing; it only follows the sidebar's state.
 */
export function SidebarModal() {
  const { open, setOpen, mode } = useSidebar();
  const active = open && mode === 'drawer';
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      if (wasActive.current) {
        wasActive.current = false;
        // Back to the button that opened it, unless focus already went somewhere on purpose.
        const focused = document.activeElement;
        if (!focused || focused === document.body || focused.closest(`#${DRAWER}`)) {
          document.querySelector<HTMLElement>(`[aria-controls="${DRAWER}"]:not(#${DRAWER} *)`)?.focus();
        }
      }
      return;
    }
    wasActive.current = true;

    let undo: (() => void) | undefined;
    // The drawer mounts with this render; wait a frame for it.
    const frame = requestAnimationFrame(() => {
      const drawer = document.getElementById(DRAWER);
      if (!drawer) return;
      undo = makeModal(drawer);
      drawer.querySelector<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      undo?.();
    };
  }, [active, setOpen]);

  return null;
}

/**
 * Marks the drawer as a modal dialog and makes everything else on the page inert: each
 * sibling of the drawer and of its ancestors, except the backdrop (a click on it closes the
 * drawer). Returns a function that undoes it.
 */
function makeModal(drawer: HTMLElement): () => void {
  const backdrop = drawer.previousElementSibling?.hasAttribute('data-state') ? drawer.previousElementSibling : null;
  const made: Element[] = [];
  for (let node: HTMLElement | null = drawer; node && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement?.children ?? [])) {
      if (sibling === node || sibling === backdrop || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      made.push(sibling);
    }
  }
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Docs navigation');
  return () => {
    for (const element of made) element.removeAttribute('inert');
    drawer.removeAttribute('aria-modal');
  };
}
