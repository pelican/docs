'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import { eggDetailUrl, eggSourceUrl, FEATURES, USUAL_PORTS, type EggDetail } from '@/lib/egg-helpers';
import type { IndexEgg, IndexGame } from './egg-index';

const fmt = new Intl.NumberFormat('en');
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const plural = (n: number, word: string) => `${fmt.format(n)} ${word}${n === 1 ? '' : 's'}`;

// Fetched once per egg per visit; the files are static, so a reopen is instant.
const cache = new Map<string, Promise<EggDetail>>();
function loadDetail(id: string): Promise<EggDetail> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(eggDetailUrl(id)).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<EggDetail>;
    });
    p.catch(() => cache.delete(id)); // let a later open try again
    cache.set(id, p);
  }
  return p;
}

/** Copies an egg's raw file URL, the address a panel imports. */
export function CopyUrl({ url, name, className, label = 'Copy URL' }: { url: string; name: string; className: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the egg file link still works */
    }
  }
  return (
    <button type="button" className={className} onClick={copy} aria-label={`Copy the import URL for ${name}`}>
      {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

/** "{{SERVER_PORT}}" stands out in a command, so you can see what the panel fills in. */
function Command({ children }: { children: string }) {
  const parts = children.split(/(\{\{[^}]+\}\})/g);
  return (
    <pre className="pl-ed__cmd">
      <code>
        {parts.map((part, i) =>
          i % 2 ? (
            <span key={i} className="pl-ed__tok">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </code>
    </pre>
  );
}

function stopInWords(stop: string): string {
  if (stop === '^C') return 'Sends Ctrl+C (SIGINT), like pressing it in a terminal.';
  if (/^\^[A-Z\\]$/.test(stop)) return `Sends the ${stop} signal to the server.`;
  return 'Typed into the server console, like any console command.';
}

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`pl-ed__sec${wide ? ' pl-ed__sec--wide' : ''}`}>
      <h3 className="pl-ed__h">{title}</h3>
      {children}
    </section>
  );
}

/**
 * One egg, in a modal <dialog> on /eggs. The list already has the name, short
 * description, installs and links, so those show at once; the rest (images,
 * commands, variables, install script) comes from /data/eggs/<id>.json.
 */
export function EggDetailDialog({ egg, game, onClose }: { egg: IndexEgg; game: IndexGame; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{ id: string; detail?: EggDetail; failed?: boolean } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    loadDetail(egg.id).then(
      (detail) => live && setResult({ id: egg.id, detail }),
      () => live && setResult({ id: egg.id, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [egg.id]);

  const detail = result?.id === egg.id ? result.detail : undefined;
  const failed = result?.id === egg.id && result.failed;
  const repo = /\/pelican-eggs\/([^/]+)\//.exec(egg.url)?.[1];
  const titleId = `egg-title-${egg.id.replace(/\W/g, '-')}`;

  return (
    <dialog
      ref={ref}
      className="pl-ed"
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className="pl-ed__bar">
        <div className="pl-ed__titles">
          <p className="pl-ed__kicker">{game.name} egg</p>
          <h2 id={titleId} className="d pl-ed__title">
            {egg.name}
          </h2>
        </div>
        <button type="button" className="pl-ed__close" aria-label="Close egg details" onClick={() => ref.current?.close()}>
          <X size={22} aria-hidden />
        </button>
      </div>

      <div className="pl-ed__body">
        <div className="pl-ed__lead">
          <p className="pl-ed__desc">{detail?.description || egg.description || 'No description yet.'}</p>
          <p className="pl-ed__meta">
            {detail?.author && <span>By {detail.author}</span>}
            {egg.installs ? <span>{plural(egg.installs, 'install')} from Pelican Hub</span> : null}
            {egg.updatedAt && <span>Updated {longDate.format(new Date(egg.updatedAt))}</span>}
            {detail?.format && (
              <span>{detail.format.startsWith('PLCN') ? 'Pelican' : 'Pterodactyl'} egg format ({detail.format})</span>
            )}
          </p>
          <div className="pl-ed__actions">
            <CopyUrl url={egg.url} name={egg.name} className="pl-btn pl-btn--sky pl-btn--small" />
            <a href={eggSourceUrl(egg.url)} className="pl-btn pl-btn--small">
              Egg file on GitHub <ArrowUpRight size={16} aria-hidden />
            </a>
            {egg.hubUrl && (
              <a href={egg.hubUrl} className="pl-btn pl-btn--small">
                Install to Panel on Pelican Hub <ArrowUpRight size={16} aria-hidden />
              </a>
            )}
          </div>
          <p className="pl-ed__how">
            To add it, copy the URL and import it from your panel&apos;s Eggs page
            {egg.hubUrl ? ', or install it from Pelican Hub (that needs a Hub login).' : '.'}
          </p>
        </div>

        {failed && (
          <p className="pl-ed__note" role="status">
            The details didn&apos;t load. Try again later, or read the{' '}
            <a href={eggSourceUrl(egg.url)}>egg file on GitHub</a>.
          </p>
        )}
        {!detail && !failed && (
          <p className="pl-ed__note" role="status">
            Loading the egg&apos;s images, commands and variables…
          </p>
        )}
        {detail && <Details detail={detail} game={game} />}

        <p className="pl-ed__credit">
          Read from the egg file in{' '}
          {repo ? <a href={`https://github.com/pelican-eggs/${repo}`}>pelican-eggs/{repo}</a> : 'the pelican-eggs repositories'}
          {detail?.author ? `, by ${detail.author}` : ''}. The pelican-eggs repositories are shared under the MIT licence.
        </p>
      </div>
    </dialog>
  );
}

function Details({ detail, game }: { detail: EggDetail; game: IndexGame }) {
  const ports = detail.variables.filter((v) => /(^|_)PORT$/.test(v.env));
  const usesServerPort = detail.startup.some((s) => s.command.includes('{{SERVER_PORT}}'));
  const usual = USUAL_PORTS[game.slug];
  const lines = detail.install.script ? detail.install.script.split('\n').length : 0;

  return (
    <div className="pl-ed__grid">
      <Section title={detail.images.length === 1 ? 'Docker image' : `Docker images (${detail.images.length})`}>
        {detail.images.length ? (
          <ul className="pl-ed__images">
            {detail.images.map((img, i) => (
              <li key={img.image + i}>
                {(detail.images.length > 1 || img.label) && (
                  <span className="pl-ed__imgtag">
                    {img.label && <span className="pl-ed__label">{img.label}</span>}
                    {i === 0 && detail.images.length > 1 && <span className="pl-ed__badge">Default</span>}
                  </span>
                )}
                <code>{img.image}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pl-ed__muted">None listed.</p>
        )}
        {detail.images.length > 1 && <p className="pl-ed__muted">New servers get the default; you can switch on the server&apos;s Startup page.</p>}
      </Section>

      <Section title="Ports">
        <ul className="pl-ed__plain">
          <li>
            <strong>Main port:</strong> the allocation the panel gives each server
            {usesServerPort ? <> (passed in as <code>SERVER_PORT</code>)</> : null}
            {usual ? `, usually ${usual}` : ''}.
          </li>
          {ports.map((v) => (
            <li key={v.env}>
              <strong>{v.name}:</strong> <code>{v.env}</code>
              {v.default ? (
                <>
                  , default <code>{v.default}</code>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {!ports.length && <p className="pl-ed__muted">No other port variables in this egg.</p>}
      </Section>

      <Section title={detail.startup.length > 1 ? 'Startup commands' : 'Startup command'} wide>
        {detail.startup.length ? (
          detail.startup.map((s) => (
            <div key={s.label} className="pl-ed__startup">
              {detail.startup.length > 1 && <p className="pl-ed__label">{s.label}</p>}
              <Command>{s.command}</Command>
            </div>
          ))
        ) : (
          <p className="pl-ed__muted">None listed.</p>
        )}
      </Section>

      <Section title="Stop command">
        {detail.stop ? (
          <>
            <p>
              <code className="pl-ed__chip">{detail.stop}</code>
            </p>
            <p className="pl-ed__muted">{stopInWords(detail.stop)}</p>
          </>
        ) : (
          <p className="pl-ed__muted">None listed.</p>
        )}
      </Section>

      <Section title="Panel features">
        {detail.features.length ? (
          <ul className="pl-ed__plain">
            {detail.features.map((id) => {
              const known = FEATURES.find((f) => f.id === id);
              return (
                <li key={id}>
                  <strong>{known?.label ?? id}:</strong> {known ? `${known.hint[0].toLowerCase()}${known.hint.slice(1)}.` :'a panel feature this egg turns on.'}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pl-ed__muted">None. The panel runs it without extra console helpers.</p>
        )}
      </Section>

      <Section title={`Variables (${detail.variables.length})`} wide>
        {detail.variables.length ? (
          <ul className="pl-ed__vars">
            {detail.variables.map((v) => (
              <li key={v.env || v.name} className="pl-ed__var">
                <div className="pl-ed__varhead">
                  <strong>{v.name}</strong>
                  <code>{v.env}</code>
                  <span className={`pl-ed__access pl-ed__access--${v.editable && v.viewable ? 'edit' : v.viewable ? 'see' : 'hidden'}`}>
                    {v.viewable ? (v.editable ? 'Users can see and change' : 'Users can see, not change') : 'Hidden from users'}
                  </span>
                </div>
                {v.description && <p className="pl-ed__vardesc">{v.description}</p>}
                <dl className="pl-ed__varmeta">
                  <div>
                    <dt>Default</dt>
                    <dd>{v.default ? <code>{v.default}</code> : <span className="pl-ed__muted">empty</span>}</dd>
                  </div>
                  <div>
                    <dt>Rules</dt>
                    <dd>
                      {v.rules.length ? (
                        v.rules.map((r, i) => (
                          <code key={i} className="pl-ed__rule">
                            {r}
                          </code>
                        ))
                      ) : (
                        <span className="pl-ed__muted">none</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pl-ed__muted">This egg has no variables.</p>
        )}
      </Section>

      <Section title="Installation" wide>
        <p>
          {detail.install.container ? (
            <>
              The install script runs once, in <code className="pl-ed__chip">{detail.install.container}</code>
              {detail.install.entrypoint ? (
                <>
                  {' '}
                  with <code className="pl-ed__chip">{detail.install.entrypoint}</code>
                </>
              ) : null}
              , before the server first starts.
            </>
          ) : (
            'No install container listed.'
          )}
        </p>
        {detail.install.script ? (
          <details className="pl-ed__script">
            <summary>Show the install script ({plural(lines, 'line')})</summary>
            <pre>
              <code>{detail.install.script}</code>
            </pre>
          </details>
        ) : (
          <p className="pl-ed__muted">No install script.</p>
        )}
      </Section>
    </div>
  );
}
