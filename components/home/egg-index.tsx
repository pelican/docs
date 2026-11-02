'use client';

import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Search, SlidersHorizontal } from 'lucide-react';
// Not '@/lib/eggs': that module imports the whole catalogue, which would then ship in this page's JavaScript.
import {
  eggSourceUrl,
  FEATURES,
  RUNTIMES,
  runtimeOf,
  searchWords,
  USUAL_PORTS,
  type EggGame,
  type RuntimeId,
} from '@/lib/egg-helpers';
import { GameArt } from './game-art';

/** One egg as the /eggs page sends it: empty fields left out, variable names joined by spaces. */
export interface IndexEgg {
  name: string;
  description: string;
  url: string;
  image: string | null;
  imageNote?: string;
  features?: string[];
  vars?: string;
  hubUrl?: string;
  installs?: number;
  /** YYYY-MM-DD */
  updatedAt?: string;
}

export interface IndexGame extends Pick<EggGame, 'slug' | 'name' | 'category' | 'steamAppId' | 'art'> {
  eggs: IndexEgg[];
}

interface Props {
  games: IndexGame[];
  categories: { id: string; name: string; count: number }[];
}

type SortId = 'popular' | 'name' | 'updated';
const SORTS: { id: SortId; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'name', label: 'A–Z' },
  { id: 'updated', label: 'Recently updated' },
];

interface PreparedEgg {
  egg: IndexEgg;
  /** Everything a search looks through, lower-cased. */
  text: string;
  runtime: RuntimeId;
}

interface Prepared {
  game: IndexGame;
  eggs: PreparedEgg[];
  /** Installs over the card's eggs (an egg listed twice, as JSON and YAML, counts once). */
  installs: number;
  /** Newest update among the card's eggs. */
  updated: string;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en');

function eggOrder(sort: SortId) {
  return (a: PreparedEgg, b: PreparedEgg) =>
    sort === 'popular'
      ? (b.egg.installs ?? 0) - (a.egg.installs ?? 0) || byName(a.egg, b.egg)
      : sort === 'updated'
        ? (b.egg.updatedAt ?? '').localeCompare(a.egg.updatedAt ?? '') || byName(a.egg, b.egg)
        : byName(a.egg, b.egg);
}

function cardOrder(sort: SortId) {
  return (a: Prepared, b: Prepared) =>
    sort === 'popular'
      ? b.installs - a.installs || byName(a.game, b.game)
      : sort === 'updated'
        ? b.updated.localeCompare(a.updated) || byName(a.game, b.game)
        : byName(a.game, b.game);
}

function prepare(game: IndexGame): Prepared {
  const counted = new Set<string>();
  let installs = 0;
  let updated = '';
  for (const egg of game.eggs) {
    if (egg.installs && egg.hubUrl && !counted.has(egg.hubUrl)) {
      counted.add(egg.hubUrl);
      installs += egg.installs;
    }
    if (egg.updatedAt && egg.updatedAt > updated) updated = egg.updatedAt;
  }
  return {
    game,
    installs,
    updated,
    eggs: game.eggs.map((egg) => ({
      egg,
      runtime: runtimeOf(egg.image),
      text: [game.name, egg.name, egg.description, egg.image, egg.vars].join(' ').toLowerCase(),
    })),
  };
}

const RUNTIME_IDS = new Set<string>(RUNTIMES.map((r) => r.id));
const FEATURE_IDS = new Set<string>(FEATURES.map((f) => f.id));
const listParam = (params: URLSearchParams, key: string, valid: Set<string>) =>
  (params.get(key) ?? '').split(',').filter((v) => valid.has(v));
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Searchable, filterable, sortable list of every egg. ?q=, ?category=, ?sort=, ?runtime= and ?feature= set the start. */
export function EggIndexList({ games, categories }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortId>('popular');
  const [runtimes, setRuntimes] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const deferred = useDeferredValue(query);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) setQuery(params.get('q')!);
    if (params.get('category')) setCategory(params.get('category')!);
    const s = params.get('sort');
    if (SORTS.some((o) => o.id === s)) setSort(s as SortId);
    // Only set what the address has: in development React runs this twice, after the address was already rewritten.
    const r = listParam(params, 'runtime', RUNTIME_IDS);
    if (r.length) setRuntimes(r);
    const f = listParam(params, 'feature', FEATURE_IDS);
    if (f.length) setFeatures(f);
  }, []);

  // Keep the address in step, so a search can be shared.
  useEffect(() => {
    const params = new URLSearchParams();
    if (deferred) params.set('q', deferred);
    if (category !== 'all') params.set('category', category);
    if (sort !== 'popular') params.set('sort', sort);
    if (runtimes.length) params.set('runtime', runtimes.join(','));
    if (features.length) params.set('feature', features.join(','));
    const qs = params.toString().replace(/%2C/g, ',');
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [deferred, category, sort, runtimes, features]);

  const prepared = useMemo(() => games.map(prepare), [games]);
  const words = searchWords(deferred);
  const wordsKey = words.join(' ');

  const view = useMemo(() => {
    const words = wordsKey ? wordsKey.split(' ') : [];
    const runtimeSet = new Set(runtimes);
    const featureSet = new Set(features);
    const counts = { category: new Map<string, number>(), runtime: new Map<string, number>(), feature: new Map<string, number>() };
    const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
    const cards: { p: Prepared; shown: PreparedEgg[]; rest: PreparedEgg[] }[] = [];
    const order = eggOrder(sort);
    let matched = 0;

    for (const p of prepared) {
      const inCategory = category === 'all' || p.game.category === category;
      const shown: PreparedEgg[] = [];
      const rest: PreparedEgg[] = [];
      for (const pe of p.eggs) {
        const q = words.every((w) => pe.text.includes(w));
        const r = !runtimeSet.size || runtimeSet.has(pe.runtime);
        const f = !featureSet.size || (pe.egg.features ?? []).some((x) => featureSet.has(x));
        // Each group's counts follow every choice except its own (choices within a group add up).
        if (q && r && f) {
          add(counts.category, p.game.category);
          add(counts.category, 'all');
        }
        if (inCategory && q && f) add(counts.runtime, pe.runtime);
        if (inCategory && q && r) for (const x of pe.egg.features ?? []) add(counts.feature, x);
        if (inCategory && q && r && f) shown.push(pe);
        else rest.push(pe);
      }
      if (!shown.length) continue;
      matched += shown.length;
      cards.push({ p, shown: shown.sort(order), rest: rest.sort(order) });
    }
    const cardSort = cardOrder(sort);
    cards.sort((a, b) => cardSort(a.p, b.p));
    return { cards, counts, matched };
  }, [prepared, wordsKey, category, sort, runtimes, features]);

  const filtering = words.length > 0 || runtimes.length > 0 || features.length > 0;
  const filterCount = runtimes.length + features.length;
  const { cards, counts, matched } = view;

  function clearAll() {
    setQuery('');
    setCategory('all');
    setRuntimes([]);
    setFeatures([]);
  }

  return (
    <>
      <div className="pl-ei__controls">
        <label className="pl-ei__search" htmlFor={`${id}-q`}>
          <Search size={22} aria-hidden />
          <span className="sr-only">Search eggs</span>
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games, eggs, images, variables…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="pl-ei__filters" role="radiogroup" aria-label="Category">
          {[{ id: 'all', name: 'Everything' }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              className="pl-ei__filter"
              onClick={() => setCategory(c.id)}
            >
              {c.name} <span>{counts.category.get(c.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pl-ei__bar">
        <button
          type="button"
          className="pl-ei__filter pl-ei__paneltoggle"
          aria-expanded={panelOpen}
          aria-controls={`${id}-panel`}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <SlidersHorizontal size={16} aria-hidden /> Filters{filterCount ? ` (${filterCount})` : ''}
        </button>
        <div className="pl-ei__sort" role="radiogroup" aria-label="Sort by">
          <span className="pl-ei__label" aria-hidden>
            Sort
          </span>
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={sort === s.id}
              className="pl-ei__filter"
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pl-ei__panel" id={`${id}-panel`} data-open={panelOpen}>
        <fieldset className="pl-ei__group">
          <legend className="pl-ei__label">Runs on</legend>
          <div className="pl-ei__chips">
            {RUNTIMES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={runtimes.includes(r.id)}
                className="pl-ei__filter"
                onClick={() => setRuntimes((list) => toggle(list, r.id))}
              >
                {r.label} <span>{counts.runtime.get(r.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="pl-ei__group">
          <legend className="pl-ei__label">Panel helps with</legend>
          <div className="pl-ei__chips">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={features.includes(f.id)}
                className="pl-ei__filter"
                title={f.hint}
                onClick={() => setFeatures((list) => toggle(list, f.id))}
              >
                {f.label} <span>{counts.feature.get(f.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="pl-ei__hint">
          &ldquo;Panel helps with&rdquo; marks eggs that turn on a panel feature: it spots a known problem in the
          console and offers a fix.
          {filterCount > 0 && (
            <>
              {' '}
              <button
                type="button"
                className="pl-ei__clear"
                onClick={() => {
                  setRuntimes([]);
                  setFeatures([]);
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </p>
      </div>

      <p className="pl-ei__count" aria-live="polite">
        {plural(matched, filtering ? 'matching egg' : 'egg')} in {plural(cards.length, 'group')}
        {sort === 'popular' && (
          <span className="pl-ei__sortnote"> · Popular counts installs from Pelican Hub</span>
        )}
      </p>

      <ul className="pl-ei__grid">
        {cards.map(({ p, shown, rest }) => (
          <GameCard key={p.game.slug} game={p.game} shown={shown} rest={rest} filtering={filtering} sort={sort} />
        ))}
      </ul>
      {cards.length === 0 && (
        <div className="pl-ei__empty">
          <p>
            No egg matches {deferred ? <>&ldquo;{deferred}&rdquo;</> : 'these filters'}. Eggs are community-made;{' '}
            <a href="https://github.com/pelican-eggs/eggs">ask for one or add your own</a>.
          </p>
          <button type="button" className="pl-ei__clear" onClick={clearAll}>
            Clear search and filters
          </button>
        </div>
      )}
    </>
  );
}

function GameCard({
  game,
  shown,
  rest,
  filtering,
  sort,
}: {
  game: IndexGame;
  shown: PreparedEgg[];
  rest: PreparedEgg[];
  filtering: boolean;
  sort: SortId;
}) {
  const port = USUAL_PORTS[game.slug];
  // Filtering: every match shows, and the others fold away. Otherwise: the first 8, then "N more".
  const visible = filtering ? shown : shown.slice(0, 8);
  const hidden = filtering ? rest : shown.slice(8);
  const total = game.eggs.length;
  return (
    <li className="pl-ei__card" id={game.slug}>
      <div className="pl-ei__art">
        <GameArt game={game} />
      </div>
      <div className="pl-ei__body">
        <h2 className="pl-ei__name">{game.name}</h2>
        <p className="pl-ei__meta">
          {filtering && shown.length < total ? `${shown.length} of ${total} eggs` : plural(total, 'egg')}
          {port ? ` · usual port ${port}` : ''}
          {game.steamAppId ? (
            <>
              {' · '}
              <a href={`https://store.steampowered.com/app/${game.steamAppId}/`}>Steam</a>
            </>
          ) : null}
        </p>
        <ul className="pl-ei__eggs">
          {visible.map(({ egg }) => (
            <EggRow key={egg.url} egg={egg} sort={sort} />
          ))}
        </ul>
        {hidden.length > 0 && (
          <details className="pl-ei__more">
            <summary>{filtering ? plural(hidden.length, 'other egg') : `${hidden.length} more`}</summary>
            <ul className="pl-ei__eggs">
              {hidden.map(({ egg }) => (
                <EggRow key={egg.url} egg={egg} sort={sort} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function EggRow({ egg, sort }: { egg: IndexEgg; sort: SortId }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(egg.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the links next to it still work */
    }
  }

  const stats = [
    egg.imageNote && `Choice of ${egg.imageNote}`,
    egg.installs && plural(egg.installs, 'install'),
    sort === 'updated' && egg.updatedAt && `Updated ${shortDate.format(new Date(egg.updatedAt))}`,
  ].filter(Boolean);

  return (
    <li className="pl-ei__egg">
      <a href={eggSourceUrl(egg.url)} className="pl-ei__eggname" title="The egg file on GitHub">
        {egg.name} <ExternalLink size={13} aria-hidden />
      </a>
      <div className="pl-ei__actions">
        {egg.hubUrl && (
          <a href={egg.hubUrl} className="pl-ei__copy" aria-label={`Details for ${egg.name} on Pelican Hub`}>
            Details
          </a>
        )}
        <button type="button" className="pl-ei__copy" onClick={copy} aria-label={`Copy the import URL for ${egg.name}`}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? 'Copied' : 'URL'}
        </button>
      </div>
      {egg.description && <p className="pl-ei__desc">{egg.description}</p>}
      {egg.image && <code className="pl-ei__image">{egg.image.replace(/^ghcr\.io\//, '')}</code>}
      {stats.length > 0 && <p className="pl-ei__stats">{stats.join(' · ')}</p>}
    </li>
  );
}
