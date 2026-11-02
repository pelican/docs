'use client';

import { useSyncExternalStore } from 'react';

/**
 * Small values the reader picks (setup fields, tab groups), kept in
 * localStorage under `pelican-docs:<key>` so they carry across pages and
 * visits. Nothing leaves the browser.
 *
 *   pelican-docs:setup:domain  -> "panel.example.com"
 *   pelican-docs:setup:php     -> "8.4"
 *   pelican-docs:setup:path    -> "/var/www/pelican"
 *   pelican-docs:tabs:webserver -> "caddy"
 */
const PREFIX = 'pelican-docs:';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    // Storage can be blocked (private mode, strict cookie settings).
    return null;
  }
}

export function setStoredValue(key: string, value: string | null) {
  try {
    if (value === null || value === '') localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Still update this page even if the value can't be saved.
  }
  for (const listener of listeners) listener();
}

/** The stored value, or null. Always null while server-rendering. */
export function useStoredValue(key: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  );
}
