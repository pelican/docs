'use client';

import { useRef } from 'react';
import type { SharedProps } from 'fumadocs-ui/contexts/search';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search';
import { useStaticSearch } from 'fumadocs-core/search/client/orama-static';

/**
 * Fumadocs' default search dialog (components/dialog/search-default), with three fixes for
 * keyboard and screen reader users:
 *   - on close, focus goes back to what opened it (a search button), not to <body>;
 *   - "N results" is announced in a live region while results show;
 *   - the input has a visible focus ring (app/global.css).
 * The index is the static file built with the site (app/docs/search.json).
 */
export function DocsSearchDialog({ open, onOpenChange }: SharedProps) {
  const search = useStaticSearch({ from: '/docs/search.json' });
  const opener = useRef<HTMLElement | null>(null);

  return (
    <SearchDialog open={open} onOpenChange={onOpenChange} {...search}>
      <SearchDialogOverlay />
      <SearchDialogContent
        // Called before focus moves into the dialog, so the focused element is still the opener.
        onOpenAutoFocus={() => {
          const focused = document.activeElement;
          // Opened with ⌘K/Ctrl K, or a click that didn't focus the button (Safari): use a visible search button.
          opener.current =
            focused instanceof HTMLElement && focused !== document.body
              ? focused
              : (Array.from(document.querySelectorAll<HTMLElement>('[data-search-full], [data-search]')).find(
                  (button) => button.offsetParent !== null,
                ) ?? null);
        }}
        onCloseAutoFocus={(event) => {
          if (!opener.current?.isConnected) return;
          event.preventDefault();
          opener.current.focus();
        }}
      >
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
        <p role="status" className="sr-only">
          {resultsMessage(search.search, search.isLoading, search.data?.items)}
        </p>
      </SearchDialogContent>
    </SearchDialog>
  );
}

function resultsMessage(query: string, isLoading: boolean, items: { type: string; rows?: unknown[] }[] | undefined) {
  if (!query.trim() || isLoading || !items) return '';
  const count = items.reduce((n, item) => n + (item.type === 'table' ? (item.rows?.length ?? 0) : 1), 0);
  return count === 0 ? 'No results' : `${count} result${count === 1 ? '' : 's'}`;
}
