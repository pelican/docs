'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
// Not '@/lib/eggs': that module imports the whole catalogue, which would then ship in this page's JavaScript.
import { FEATURES, RUNTIMES, runtimeOf, searchWords, USUAL_PORTS, type EggGame, type RuntimeId } from '@/lib/egg-helpers';
import { GameArt } from './game-art';
import { CopyUrl, EggDetailDialog } from './egg-detail';

/** One egg as the /eggs page sends it: empty fields left out, variable names joined by spaces. */
export interface IndexEgg {
  id: string;
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
  /** Installs over the game's eggs. */
  installs: number;
  /** Newest update among the game's eggs. */
  updated: string;
}

interface Row {
  p: Prepared;
  shown: PreparedEgg[];
  rest: PreparedEgg[];
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

function rowOrder(sort: SortId) {
  return (a: Prepared, b: Prepared) =>
    sort === 'popular'
      ? b.installs - a.installs || byName(a.game, b.game)
      : sort === 'updated'
        ? b.updated.localeCompare(a.updated) || byName(a.game, b.game)
        : byName(a.game, b.game);
}

function prepare(game: IndexGame): Prepared {
  let installs = 0;
  let updated = '';
  for (const egg of game.eggs) {
    installs += egg.installs ?? 0;
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
const RUNTIME_LABEL = new Map<string, string>(RUNTIMES.map((r) => [r.id, r.label]));
const FEATURE_IDS = new Set<string>(FEATURES.map((f) => f.id));
const listParam = (params: URLSearchParams, key: string, valid: Set<string>) =>
  (params.get(key) ?? '').split(',').filter((v) => valid.has(v));
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
const fmt = new Intl.NumberFormat('en');
const plural = (n: number, word: string) => `${fmt.format(n)} ${word}${n === 1 ? '' : 's'}`;
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const day = (iso: string) => shortDate.format(new Date(iso));

/** A search or filter showing this many games or fewer opens them all. */
const AUTO_OPEN = 6;
/** An open game shows this many eggs before "Show all". */
const FIRST_EGGS = 10;

/**
 * Searchable, filterable, sortable list of every egg: one row per game, which
 * opens to that game's eggs; an egg opens its details in a dialog.
 * ?q=, ?category=, ?sort=, ?runtime=, ?feature= and ?egg= set the start.
 */
export function EggIndexList({ games, categories }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortId>('popular');
  const [runtimes, setRuntimes] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Games opened or closed by hand; the rest follow AUTO_OPEN. Cleared when the search changes. */
  const [opened, setOpened] = useState<Map<string, boolean>>(() => new Map());
  const [eggId, setEggId] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const listRef = useRef<HTMLUListElement>(null);
  /** What gets focus back when the dialog closes. */
  const returnFocus = useRef<HTMLElement | null>(null);
  /** The next address change adds a history entry (opening an egg), so Back closes it. */
  const pushNext = useRef(false);

  const prepared = useMemo(() => games.map(prepare), [games]);
  const byId = useMemo(() => {
    const map = new Map<string, { egg: IndexEgg; game: IndexGame }>();
    for (const game of games) for (const egg of game.eggs) map.set(egg.id, { egg, game });
    return map;
  }, [games]);

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
    const e = params.get('egg');
    if (e && byId.has(e)) setEggId(e);

    // Back and Forward open and close an egg.
    function onPop() {
      const next = new URLSearchParams(window.location.search).get('egg');
      const valid = next && byId.has(next) ? next : null;
      setEggId(valid);
      // Closed by Back: the dialog goes without a close event, so hand focus back here.
      const target = returnFocus.current;
      if (!valid && target?.isConnected) {
        returnFocus.current = null;
        requestAnimationFrame(() => target.focus());
      }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [byId]);

  // Keep the address in step, so a search or an egg can be shared.
  useEffect(() => {
    const params = new URLSearchParams();
    if (deferred) params.set('q', deferred);
    if (category !== 'all') params.set('category', category);
    if (sort !== 'popular') params.set('sort', sort);
    if (runtimes.length) params.set('runtime', runtimes.join(','));
    if (features.length) params.set('feature', features.join(','));
    if (eggId) params.set('egg', eggId);
    const qs = params.toString().replace(/%2C/g, ',').replace(/%2F/g, '/');
    const push = pushNext.current;
    pushNext.current = false;
    if ((qs ? `?${qs}` : '') === window.location.search) return;
    const url = qs ? `?${qs}` : window.location.pathname;
    if (push) window.history.pushState({ egg: eggId }, '', url);
    else window.history.replaceState(window.history.state, '', url);
  }, [deferred, category, sort, runtimes, features, eggId]);

  const words = searchWords(deferred);
  const wordsKey = words.join(' ');
  const filterKey = [wordsKey, category, runtimes.join(), features.join()].join('|');

  // A new search starts from the automatic open/closed state.
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    if (opened.size) setOpened(new Map());
  }

  const view = useMemo(() => {
    const words = wordsKey ? wordsKey.split(' ') : [];
    const runtimeSet = new Set(runtimes);
    const featureSet = new Set(features);
    const counts = { category: new Map<string, number>(), runtime: new Map<string, number>(), feature: new Map<string, number>() };
    const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
    const rows: Row[] = [];
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
      rows.push({ p, shown: shown.sort(order), rest: rest.sort(order) });
    }
    const sortRows = rowOrder(sort);
    rows.sort((a, b) => sortRows(a.p, b.p));
    return { rows, counts, matched };
  }, [prepared, wordsKey, category, sort, runtimes, features]);

  const filtering = words.length > 0 || runtimes.length > 0 || features.length > 0;
  const filterCount = runtimes.length + features.length;
  const { rows, counts, matched } = view;
  const autoOpen = filtering && rows.length <= AUTO_OPEN;
  const isOpen = (slug: string) => opened.get(slug) ?? autoOpen;

  function setOpen(slug: string, open: boolean) {
    setOpened((map) => new Map(map).set(slug, open));
  }

  function clearAll() {
    setQuery('');
    setCategory('all');
    setRuntimes([]);
    setFeatures([]);
  }

  function openEgg(next: string, trigger: HTMLElement) {
    returnFocus.current = trigger;
    pushNext.current = true;
    setEggId(next);
  }

  function closeEgg() {
    const closing = eggId;
    setEggId(null);
    // Opened from this page: step back over the entry it added, so Back doesn't reopen it.
    if (closing && window.history.state?.egg === closing) window.history.back();
    let target = returnFocus.current;
    returnFocus.current = null;
    if (!target?.isConnected && closing) {
      // Opened from a link: show the egg's game and put focus on it.
      const slug = byId.get(closing)?.game.slug;
      if (slug) {
        setOpen(slug, true);
        target = document.getElementById(`game-${slug}`);
        target?.scrollIntoView({ block: 'center' });
      }
    }
    target?.focus();
  }

  // Arrow keys move between games, like the rows of a table.
  function onRowKey(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.pl-ei__row') ?? [])];
    const at = buttons.indexOf(event.currentTarget);
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: buttons.length - 1 };
    const to = moves[event.key];
    if (to === undefined || !buttons[to]) return;
    event.preventDefault();
    buttons[to].focus();
  }

  const current = eggId ? byId.get(eggId) : undefined;

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
        {plural(matched, filtering ? 'matching egg' : 'egg')} in {plural(rows.length, 'group')}
        {sort === 'popular' && <span className="pl-ei__sortnote"> · Popular counts installs from Pelican Hub</span>}
      </p>

      {rows.length > 0 && (
        <div className="pl-ei__table">
          <div className="pl-ei__head" aria-hidden>
            <span>Game</span>
            <span>Eggs</span>
            <span>Installs</span>
            <span>Updated</span>
          </div>
          <ul className="pl-ei__rows" ref={listRef}>
            {rows.map((row) => (
              <GameRow
                key={row.p.game.slug}
                row={row}
                open={isOpen(row.p.game.slug)}
                filtering={filtering}
                onToggle={(open) => setOpen(row.p.game.slug, open)}
                onKey={onRowKey}
                onOpenEgg={openEgg}
              />
            ))}
          </ul>
        </div>
      )}
      {rows.length === 0 && (
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

      {current && <EggDetailDialog key={current.egg.id} egg={current.egg} game={current.game} onClose={closeEgg} />}
    </>
  );
}

function GameRow({
  row: { p, shown, rest },
  open,
  filtering,
  onToggle,
  onKey,
  onOpenEgg,
}: {
  row: Row;
  open: boolean;
  filtering: boolean;
  onToggle: (open: boolean) => void;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onOpenEgg: (id: string, trigger: HTMLElement) => void;
}) {
  const [all, setAll] = useState(false);
  const { game } = p;
  const total = game.eggs.length;
  const port = USUAL_PORTS[game.slug];
  const single = total === 1 ? game.eggs[0] : null;
  // Under the name: the eggs it has, or (for a game with one egg) what that egg is.
  const names = shown.map((pe) => pe.egg.name);
  const peek = single
    ? single.description
    : names.slice(0, 4).join(' · ') + (names.length > 4 ? ` · +${names.length - 4} more` : '');
  // Searching: the matches, then the others on request. Otherwise: the first ten, then the rest on request.
  const first = filtering ? shown : shown.slice(0, FIRST_EGGS);
  const more = filtering ? rest : shown.slice(FIRST_EGGS);
  const visible = all ? [...first, ...more] : first;
  const partial = filtering && shown.length < total;
  const installs = partial ? shown.reduce((n, pe) => n + (pe.egg.installs ?? 0), 0) : p.installs;

  return (
    <li className="pl-ei__game" data-open={open || undefined}>
      <h2 className="pl-ei__gh">
        <button
          type="button"
          id={`game-${game.slug}`}
          className="pl-ei__row"
          aria-expanded={open}
          aria-controls={`eggs-${game.slug}`}
          onClick={() => onToggle(!open)}
          onKeyDown={onKey}
        >
          <span className="pl-ei__thumb">
            <GameArt game={game} />
          </span>
          <span className="pl-ei__who">
            <span className="pl-ei__name">{game.name}</span>
            {peek && (
              <span className="pl-ei__peek" aria-hidden>
                {peek}
              </span>
            )}
          </span>
          <span className="pl-ei__cells">
            <span className="pl-ei__cell">
              {partial ? `${shown.length} of ${plural(total, 'egg')}` : plural(total, 'egg')}
            </span>
            <Stats installs={installs} updated={p.updated} />
          </span>
          <ChevronDown className="pl-ei__chev" size={22} aria-hidden />
        </button>
      </h2>
      <div id={`eggs-${game.slug}`} className="pl-ei__drawer" hidden={!open}>
        {open && (
          <>
            {(port || game.steamAppId) && (
              <p className="pl-ei__gamefacts">
                {port && <span>Usual port {port}</span>}
                {game.steamAppId ? (
                  <a href={`https://store.steampowered.com/app/${game.steamAppId}/`}>{game.name} on Steam</a>
                ) : null}
              </p>
            )}
            <ul className="pl-ei__eggs">
              {visible.map((pe) => (
                <EggRow key={pe.egg.id} pe={pe} dim={partial && !shown.includes(pe)} onOpen={onOpenEgg} />
              ))}
            </ul>
            {more.length > 0 && (
              <button type="button" className="pl-ei__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                {all
                  ? 'Show fewer'
                  : filtering
                    ? `Show ${plural(more.length, 'other egg')} for ${game.name}`
                    : `Show all ${plural(total, 'egg')}`}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function EggRow({ pe, dim, onOpen }: { pe: PreparedEgg; dim: boolean; onOpen: (id: string, trigger: HTMLElement) => void }) {
  const { egg, runtime } = pe;
  return (
    <li className="pl-ei__egg" data-dim={dim || undefined}>
      <div className="pl-ei__eggmain">
        <button type="button" className="pl-ei__eggname" aria-haspopup="dialog" onClick={(e) => onOpen(egg.id, e.currentTarget)}>
          {egg.name}
          <span className="sr-only">: details</span>
        </button>
        {egg.description && <p className="pl-ei__desc">{egg.description}</p>}
      </div>
      <span className="pl-ei__cells">
        <span className="pl-ei__cell">{egg.imageNote ?? RUNTIME_LABEL.get(runtime)}</span>
        <Stats installs={egg.installs} updated={egg.updatedAt} />
      </span>
      <div className="pl-ei__eggact">
        <CopyUrl url={egg.url} name={egg.name} className="pl-ei__copy" />
        <ChevronRight className="pl-ei__go" size={20} aria-hidden />
      </div>
    </li>
  );
}

/** The Installs and Updated columns; on phones they join one line under the name. */
function Stats({ installs, updated }: { installs?: number; updated?: string }) {
  return (
    <>
      <span className={`pl-ei__cell${installs ? '' : ' pl-ei__cell--none'}`}>
        {installs ? plural(installs, 'install') : <span aria-hidden>–</span>}
      </span>
      <span className={`pl-ei__cell${updated ? '' : ' pl-ei__cell--none'}`}>
        {updated ? (
          <>
            <span className="pl-ei__updl">Updated </span>
            {day(updated)}
          </>
        ) : (
          <span aria-hidden>–</span>
        )}
      </span>
    </>
  );
}
