import type { EggGame } from '@/lib/eggs';

const MARK_COLORS = ['#22C55E', '#EA580C', '#38BDF8', '#F59E0B', '#A855F7', '#E11D48', '#3B82F6'];

const initial = (name: string) => name.replace(/^the /i, '')[0];

/**
 * A game's wide picture for the /eggs cards: its Steam store artwork, an
 * original drawing or the icon built into its own egg, or (when there is
 * none) its first letter on a colour block.
 */
export function GameArt({ game }: { game: Pick<EggGame, 'name' | 'art'> }) {
  if (game.art) {
    const isIcon = !/^https?:/.test(game.art);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={game.art}
        alt=""
        className={`pl-art pl-art--card${isIcon ? ' pl-art--icon' : ''}`}
        width={231}
        height={87}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const color = MARK_COLORS[game.name.length % MARK_COLORS.length];
  return (
    <span className="pl-art pl-art--card pl-art--mark" style={{ background: color }} aria-hidden>
      {initial(game.name)}
    </span>
  );
}

/**
 * A game's square icon (the publisher's Steam icon, an original drawing, or
 * the icon in its own egg). Without one it gets a letter block, never a
 * borrowed picture.
 */
export function GameIcon({ name, icon, size }: { name: string; icon: string | null; size: number }) {
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        className={`pl-gicon${icon.endsWith('.svg') ? ' pl-gicon--pixel' : ''}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className="pl-gicon pl-gicon--mark" style={{ width: size, height: size, fontSize: size * 0.56 }} aria-hidden>
      {initial(name)}
    </span>
  );
}
