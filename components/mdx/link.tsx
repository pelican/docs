import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/** Docusaurus-style <Link to="…">, kept so existing pages work unchanged. */
export function Link({ to, href, ...props }: ComponentProps<'a'> & { to?: string }) {
  return <NextLink href={to ?? href ?? '#'} {...props} />;
}
