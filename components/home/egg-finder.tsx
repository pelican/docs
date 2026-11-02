'use client';

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Search } from 'lucide-react';
import { GameIcon } from './game-art';

/** One egg, with only what the strip shows. */
export interface FinderEgg {
  name: string;
  description: string;
  /** Raw egg file: the URL a panel imports. */
  url: string;
  /** The same file on GitHub, for reading. */
  sourceUrl: string;
  image: string | null;
}

/** A featured game, with its first few eggs. */
export interface FinderGame {
  slug: string;
  name: string;
  icon: string | null;
  /** How many eggs the game really has. */
  total: number;
  port?: string;
  eggs: FinderEgg[];
}

const plural = (n: number) => `${n} ${n === 1 ? 'egg' : 'eggs'}`;

/**
 * The navy games strip. Tiles are tabs (arrow keys move between them); the
 * panel under them shows that game's real eggs. Searching any other game opens
 * the full egg index at /eggs (a plain form, so it works before scripts load).
 */
export function EggFinder({
  games,
  names,
  totalEggs,
  totalGames,
}: {
  games: FinderGame[];
  names: string[];
  totalEggs: number;
  totalGames: number;
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = games[active] ?? games[0];

  function select(index: number) {
    const next = (index + games.length) % games.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>, from: number) {
    const moves: Record<string, number> = {
      ArrowRight: from + 1,
      ArrowDown: from + 1,
      ArrowLeft: from - 1,
      ArrowUp: from - 1,
      Home: 0,
      End: games.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  }

  // A featured game opens its tile; anything else goes on to /eggs/?q=…
  function search(event: FormEvent<HTMLFormElement>) {
    const q = new FormData(event.currentTarget).get('q')?.toString().trim().toLowerCase() ?? '';
    const hit = games.findIndex((g) => g.name.toLowerCase() === q);
    if (hit < 0) return;
    event.preventDefault();
    select(hit);
  }

  return (
    <div className="pl-games__inner">
      <div className="pl-games__head">
        <div className="pl-games__heading">
          <p className="pl-games__kicker">
            {totalEggs} eggs · {totalGames} games
          </p>
          <h2 id="games-title" className="d pl-games__title">
            Runs the games your community plays
          </h2>
        </div>
        <div className="pl-games__tools">
          <form className="pl-games__search" role="search" action="/eggs/" method="get" onSubmit={search}>
            <label htmlFor={`${id}-q`} className="sr-only">
              Find any game
            </label>
            <Search size={18} aria-hidden />
            <input
              id={`${id}-q`}
              name="q"
              type="search"
              placeholder="Find any game"
              autoComplete="off"
              spellCheck={false}
              list={`${id}-list`}
              enterKeyHint="search"
            />
            <datalist id={`${id}-list`}>
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </form>
          <a href="/eggs/" className="pl-btn pl-btn--sky pl-btn--small pl-games__all">
            All {totalEggs} eggs <ArrowRight size={16} aria-hidden />
          </a>
        </div>
      </div>

      <div className="pl-games__tiles" role="tablist" aria-label="Popular games">
        {games.map((game, i) => (
          <button
            key={game.slug}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            tabIndex={i === active ? 0 : -1}
            className="pl-gtile"
            onClick={() => setActive(i)}
            onKeyDown={(event) => onKey(event, i)}
          >
            <GameIcon name={game.name} icon={game.icon} size={48} />
            <span className="pl-gtile__name">{game.name}</span>
            <span className="pl-gtile__count">{plural(game.total)}</span>
          </button>
        ))}
      </div>

      <div className="pl-gpanel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`}>
        <div className="pl-gpanel__head">
          <p className="pl-gpanel__meta">
            <strong>{current.name}</strong>
            <span>
              {plural(current.total)}
              {current.port ? ` · usual port ${current.port}` : ''}
            </span>
          </p>
          <a href={`/eggs/?q=${encodeURIComponent(current.name)}`} className="pl-gpanel__all">
            {current.total > current.eggs.length ? `See all ${current.total}` : 'Open in the egg list'}{' '}
            <ArrowRight size={16} aria-hidden />
          </a>
        </div>
        <ul className="pl-gpanel__eggs" key={current.slug}>
          {current.eggs.map((egg) => (
            <EggCard key={egg.url} egg={egg} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function EggCard({ egg }: { egg: FinderEgg }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(egg.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the file link next to it still works */
    }
  }

  return (
    <li className="pl-egg">
      <h3 className="pl-egg__name">{egg.name}</h3>
      {egg.image && (
        <p className="pl-egg__image">
          <span>Image</span>
          <code>
            {/* Break only after a slash, never inside "pelican-eggs". */}
            {egg.image.split('/').map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 && (
                  <>
                    /<wbr />
                  </>
                )}
              </span>
            ))}
          </code>
        </p>
      )}
      <p className="pl-egg__desc">{egg.description || 'No description yet.'}</p>
      <div className="pl-egg__actions">
        <a href={egg.sourceUrl} className="pl-egg__file">
          Egg file <ArrowUpRight size={15} aria-hidden />
        </a>
        <button type="button" className="pl-egg__copy" onClick={copy} aria-label={`Copy the import URL for ${egg.name}`}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy URL'}</span>
        </button>
      </div>
    </li>
  );
}
