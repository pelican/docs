'use client';

import type { ReactNode } from 'react';
import { useStoredValue } from './store';
import type { TextField } from './fields';

/**
 * A spot in a code block that shows the reader's own value once they've set
 * it, and the original text (e.g. `<domain>`) until then.
 */
export function SetupValue({ field, children }: { field: TextField; children: ReactNode }) {
  const value = useStoredValue(`setup:${field}`);

  if (!value) return <span data-setup={field}>{children}</span>;
  return (
    <span data-setup={field} data-filled="">
      {value}
    </span>
  );
}
