'use client';

import { useState } from 'react';
import { releases } from '@/lib/home-data';

const repo = 'https://github.com/pelican/panel';
const HEADLINES: Record<string, string> = {
  'v1.0.0-rc.2': 'Crash-safe plugins, power webhooks',
  'v1.0.0-rc.1': 'Webhook plugins, S3 multipart, PHP 8.4',
  'v1.0.0-beta38': 'Auto-generated API docs',
  'v1.0.0-beta37': 'SFTP button in the file list',
  'v1.0.0-beta36': 'Passkeys and backup hosts',
};

/** The white release-log card: one row per release; open one to see what changed. */
export function ReleaseLog() {
  const [open, setOpen] = useState<string | null>(releases[0].tag);
  const most = Math.max(...releases.map((r) => r.total));

  return (
    <div className="pl-log pl-card">
      <div className="pl-log__head">
        <h3>Release log</h3>
        <span>changes</span>
      </div>
      <ul>
        {releases.map((r) => {
          const isOpen = open === r.tag;
          return (
            <li key={r.tag} className="pl-log__item" data-open={isOpen || undefined}>
              <button
                type="button"
                className="pl-log__row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.tag)}
              >
                <span className="pl-log__ver">
                  <strong>{r.label}</strong>
                  <em>{r.date}</em>
                </span>
                <span className="pl-log__what">{HEADLINES[r.tag]}</span>
                <span className="pl-log__bar" aria-hidden>
                  <span style={{ width: `${(r.total / most) * 100}%` }} />
                </span>
                <span className="pl-log__n">{r.total}</span>
              </button>
              {isOpen && (
                <ul className="pl-log__changes">
                  {r.changes.map((c) => (
                    <li key={c.pr}>
                      <a href={`${repo}/pull/${c.pr}`}>#{c.pr}</a>
                      <span>{c.title}</span>
                      <em>{c.authors.join(', ')}</em>
                    </li>
                  ))}
                  <li className="pl-log__full">
                    <a href={`${repo}/releases/tag/${r.tag}`}>Full notes for {r.label} →</a>
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
