import { execFileSync } from 'node:child_process';

/**
 * When a docs page was first committed, from git, for the article's datePublished. Follows
 * renames (pages moved from the Docusaurus layout). Undefined when git isn't there or the
 * clone is shallow (CI checks out the whole history, see .github/workflows), so a wrong date
 * is never published.
 */
let shallow: boolean | undefined;
const cache = new Map<string, Date | undefined>();

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function firstCommitDate(file: string): Date | undefined {
  if (cache.has(file)) return cache.get(file);
  let date: Date | undefined;
  try {
    shallow ??= git(['rev-parse', '--is-shallow-repository']) === 'true';
    if (!shallow) {
      const oldest = git(['log', '--follow', '--diff-filter=A', '--format=%aI', '--', file]).split('\n').at(-1);
      if (oldest) date = new Date(oldest);
    }
  } catch {
    date = undefined;
  }
  cache.set(file, date);
  return date;
}
