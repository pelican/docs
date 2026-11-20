import type { ComponentProps } from 'react';
import { isTextField } from './fields';
import { SetupValue } from './setup-value';

/**
 * Replaces <span> in MDX. Code-block spans tagged by lib/shiki-setup.ts become
 * a client <SetupValue />; every other span stays a plain server-rendered span,
 * so ordinary code blocks ship no extra JavaScript.
 */
export function SetupAwareSpan(props: ComponentProps<'span'> & { 'data-setup'?: string }) {
  const field = props['data-setup'];
  if (isTextField(field)) return <SetupValue field={field}>{props.children}</SetupValue>;
  return <span {...props} />;
}
