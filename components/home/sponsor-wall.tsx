import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { sponsors } from '@/lib/support';

/**
 * Company sponsors as large logo cards, then a card that says how to get on the wall.
 * Sits on navy (homepage community section, /support), so the logos are the light ones.
 */
export function SponsorWall({ label = 'Sponsored by' }: { label?: string }) {
  return (
    <div className="pl-swall">
      <p className="pl-swall__label">{label}</p>
      <ul className="pl-swall__list">
        {sponsors.map((s) => (
          <li key={s.name}>
            <a href={s.href} className="pl-swall__card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo} alt={s.name} width={s.width} height={s.height} loading="lazy" decoding="async" />
              <span className="pl-swall__visit">
                Visit {s.name} <ArrowUpRight size={16} aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Link href="/support/#plans" className="pl-swall__you">
        <span>
          <strong>Your logo here.</strong> Company sponsors get their logo on Pelican&apos;s websites.
        </span>
        <ArrowRight size={18} aria-hidden />
      </Link>
    </div>
  );
}
