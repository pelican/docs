import { ArrowRight, Search } from 'lucide-react';
import { GameIcon } from './game-art';

/** A featured game, as its tile shows it. */
export interface FinderGame {
  slug: string;
  name: string;
  icon: string | null;
  /** How many eggs the game really has. */
  total: number;
}

const plural = (n: number) => `${n} ${n === 1 ? 'egg' : 'eggs'}`;

/**
 * The navy games strip: popular games as tiles that open their eggs on /eggs, a search
 * for any other game, and a link to the whole list. Plain links and a plain form, so it
 * needs no JavaScript.
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
          <form className="pl-games__search" role="search" action="/eggs/" method="get">
            <label htmlFor="games-q" className="sr-only">
              Find any game
            </label>
            <Search size={18} aria-hidden />
            <input
              id="games-q"
              name="q"
              type="search"
              placeholder="Find any game"
              autoComplete="off"
              spellCheck={false}
              list="games-q-list"
              enterKeyHint="search"
            />
            <datalist id="games-q-list">
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

      <ul className="pl-games__tiles" aria-label="Popular games">
        {games.map((game) => (
          <li key={game.slug}>
            <a href={`/eggs/?q=${encodeURIComponent(game.name)}`} className="pl-gtile">
              <GameIcon name={game.name} icon={game.icon} size={48} />
              <span className="pl-gtile__name">{game.name}</span>
              <span className="pl-gtile__count">
                {plural(game.total)} <ArrowRight size={15} aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
