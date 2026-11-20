import { Callout, type CalloutType } from 'fumadocs-ui/components/callout';
import type { ReactNode } from 'react';

// Docusaurus admonition types, mapped to Fumadocs callout colours.
// Kept in step with the `:::` typeMap in source.config.ts.
const TYPES: Record<string, CalloutType> = {
  note: 'info',
  info: 'info',
  tip: 'success',
  success: 'success',
  idea: 'idea',
  caution: 'warning',
  warning: 'warning',
  warn: 'warning',
  danger: 'error',
  error: 'error',
};

export function Admonition({
  type = 'note',
  title,
  children,
}: {
  type?: string;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Callout type={TYPES[type] ?? 'info'} title={title}>
      {children}
    </Callout>
  );
}
