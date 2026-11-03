import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ArrowRight,
  BookOpen,
  Code,
  Database,
  GitBranch,
  Heart,
  KeyRound,
  Layers,
  MessageCircle,
  Play,
  Plug,
  ShieldCheck,
} from 'lucide-react';
import { HeroConsole } from './hero-console';
import { EggFinder, type FinderGame } from './egg-finder';
import { FeaturePanel } from './feature-panel';
import { PluginStage } from './plugin-stage';
import { DomainCta } from './domain-cta';
import { GameIcon } from './game-art';
import { SponsorWall } from './sponsor-wall';
import { DiscordIcon, GitHubIcon } from '@/components/icons';
import { links } from '@/lib/links';
import { highlights, project, topContributors } from '@/lib/home-data';
import { eggCount, eggIndex, FEATURED, gameBySlug, gameCount } from '@/lib/eggs';

const fmt = new Intl.NumberFormat('en');
const repo = 'https://github.com/pelican/panel';
const ICONS = { layers: Layers, plug: Plug, key: KeyRound, database: Database, code: Code, shield: ShieldCheck };

/** The example fleet in Features: one panel, three kinds of machine, a few game servers each (egg slugs). */
const FLEET = [
  { machine: 'Old PC', where: 'At home', games: ['minecraft', 'valheim'] },
  { machine: 'Rented VPS', where: 'In the cloud', games: ['palworld', 'factorio'] },
  { machine: 'Dedicated server', where: 'In a datacenter', games: ['rust', 'counter-strike-2', 'minecraft'] },
];

/* ---- Hero ------------------------------------------------------------------- */
export function HeroSection() {
  return (
    <section className="pl-hero" aria-labelledby="hero-title">
      <div className="pl-wrap pl-hero__grid">
        <div className="pl-hero__copy">
          <p className="pl-badge">
            <span>Free</span> Open source under AGPLv3
          </p>
          <h1 id="hero-title" className="d pl-hero__title">
            {['Your servers.', 'Your community.', 'Your control.'].map((line, i) => (
              <span key={line} className="pl-line">
                <span style={{ '--i': i } as CSSProperties}>{line}</span>
              </span>
            ))}
          </h1>
          <p className="pl-hero__lede">
            Pelican is a free, self-hosted panel for running game servers. Each server lives in its own Docker
            container, and you can extend the panel with plugins.
          </p>
          <div className="pl-hero__actions">
            <Link href={links.install} className="pl-btn pl-btn--ink pl-btn--big">
              Install Pelican <ArrowRight size={20} aria-hidden />
            </Link>
            <a href={links.demo} className="pl-btn pl-btn--white pl-btn--big">
              <Play size={18} aria-hidden fill="currentColor" /> Try the live demo
            </a>
          </div>
        </div>

        <div className="pl-hero__stage">
          <div className="pl-window">
            <div className="pl-window__bar">
              <span aria-hidden className="pl-window__dots">
                <i />
                <i />
                <i />
              </span>
              your-panel.example / server / console
            </div>
            <HeroConsole />
          </div>
          <p className="pl-hero__caption">
            This console works: press Stop, or type <kbd>help</kbd>. <a href={links.demo}>See the real panel in the demo</a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---- Games strip (navy) --------------------------------------------------------- */
export function GamesSection() {
  // The featured games' tiles; each opens that game's eggs on /eggs.
  const games: FinderGame[] = FEATURED.flatMap((slug) => {
    const game = gameBySlug(slug);
    return game ? [{ slug, name: game.name, icon: game.icon, total: game.eggs.length }] : [];
  });
  const names = eggIndex.games.filter((g) => g.category === 'games' || g.category === 'minecraft').map((g) => g.name);

  return (
    <section className="pl-games on-ink" aria-labelledby="games-title">
      <EggFinder games={games} names={names} totalEggs={eggCount} totalGames={gameCount} />
    </section>
  );
}

/* ---- Section index ----------------------------------------------------------------- */
const JUMPS = [
  ['why', 'Why Pelican'],
  ['features', 'Features'],
  ['plugins', 'Plugins'],
  ['activity', 'Activity'],
  ['install', 'Install'],
];

export function JumpNav() {
  return (
    <nav className="pl-jump" aria-label="On this page">
      <ol className="pl-wrap">
        {JUMPS.map(([id, label], i) => (
          <li key={id}>
            <a href={`#${id}`}>
              <span>0{i + 1}</span> {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---- 01 Why Pelican ------------------------------------------------------------------ */
export function WhySection() {
  return (
    <section id="why" className="pl-why" aria-labelledby="why-title">
      <div className="pl-wrap pl-why__grid">
        <div className="pl-why__copy pl-in">
          <p className="pl-kicker">01 · Why Pelican</p>
          <h2 id="why-title" className="d pl-why__title">
            Built to last.
          </h2>
          <p className="pl-why__lede">
            A modern panel for how game servers are run today, and it keeps getting better. Each line links to the
            change that shipped it.
          </p>
          <p className="pl-why__links">
            <a href={links.demo}>Try the live demo</a>
            <Link href="/faq/">Read the FAQ</Link>
          </p>
        </div>
        <ol className="pl-idx">
          {highlights.map((item, i) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS];
            return (
              <li key={item.title} className="pl-in" style={{ '--d': i } as CSSProperties}>
                <a href={`${repo}/pull/${item.prs[0]}`} className="pl-idx__row">
                  <span className="pl-idx__n">0{i + 1}</span>
                  <Icon className="pl-idx__ico" size={26} strokeWidth={2} aria-hidden />
                  <span className="pl-idx__title">{item.title}</span>
                  <span className="pl-idx__ref">
                    {item.ref} · {item.prs.map((p) => `#${p}`).join(' ')}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ---- 02 Features -------------------------------------------------------------------- */
export function FeaturesSection() {
  return (
    <section id="features" className="pl-features" aria-labelledby="features-title">
      <div className="pl-wrap">
        <p className="pl-kicker">02 · Features</p>
        <h2 id="features-title" className="d pl-h2 pl-in">
          Everything you need to run the next server.
        </h2>
        <FeaturePanel />
        <ul className="pl-features__more">
          {['Subusers', 'REST API', 'Webhooks', 'Passkeys', 'Databases', 'Activity log'].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="pl-fleet">
          <h3 className="d pl-fleet__title">One box or a whole fleet.</h3>
          <p className="pl-fleet__lede">
            One panel runs every machine you have. Install Wings on a machine and it becomes a node; each game server
            on it gets its own Docker container.
          </p>
          <div className="pl-fleet__map">
            <div className="pl-fleet__panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/logo.png" alt="" width={44} height={44} />
              <span>
                <strong>Panel</strong> Web UI + API
              </span>
            </div>
            <ul className="pl-fleet__nodes" aria-label="Example nodes">
              {FLEET.map((node) => (
                <li key={node.machine} className="pl-node">
                  <p className="pl-node__head">
                    <strong>{node.machine}</strong>
                    <span>{node.where}</span>
                  </p>
                  <p className="pl-node__wings">Wings</p>
                  <ul className="pl-node__servers" aria-label={`Game servers on ${node.machine}`}>
                    {node.games.flatMap((slug) => {
                      const game = gameBySlug(slug);
                      return game
                        ? [
                            <li key={slug}>
                              <GameIcon name={game.name} icon={game.icon} size={24} />
                              {game.name}
                            </li>,
                          ]
                        : [];
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          <p className="pl-fine">
            An example setup. Wings runs on any Linux machine with Docker, amd64 or arm64: a Raspberry Pi, an old PC, a
            rack of servers.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---- 03 Plugins ------------------------------------------------------------------------ */
export function PluginsSection() {
  return (
    <section id="plugins" className="pl-plugins" aria-labelledby="plugins-title">
      <div className="pl-wrap">
        <p className="pl-kicker">03 · Plugins</p>
        <div className="pl-plugins__head">
          <div>
            <h2 id="plugins-title" className="d pl-h2 pl-in">
              Bolt on what you need.
            </h2>
            <p className="pl-plugins__lede">
              Plugins add features without editing panel core. Some are made by the team, most by the community.
            </p>
          </div>
          <div className="pl-plugins__actions">
            <a href={`${links.hub}/plugins`} className="pl-btn pl-btn--sky">
              Browse {project.plugins} plugins
            </a>
            <Link href="/docs/panel/advanced/plugins/" className="pl-textlink">
              Write your own
            </Link>
          </div>
        </div>
        <PluginStage />
        <p className="pl-fine">
          Three of the most-downloaded plugins on the Hub. Screenshots by each plugin&apos;s author, from its Hub
          page; download counts from the Hub, {project.asOf}. Licences vary by plugin; check each listing.
        </p>
      </div>
    </section>
  );
}

/* ---- 04 Activity (sky) --------------------------------------------------------------------- */
export function ActivitySection() {
  const stats = [
    [String(project.releasesInYear), 'releases in 12 months'],
    [fmt.format(project.contributors), 'people have contributed'],
    [String(project.plugins), 'plugins on the Hub'],
    [String(eggCount), 'eggs for games and apps'],
    [`${(project.stars / 1000).toFixed(1)}k`, 'GitHub stars'],
  ];
  return (
    <section id="activity" className="pl-activity" aria-labelledby="activity-title">
      <div className="pl-wrap">
        <p className="pl-kicker">04 · Activity</p>
        <div className="pl-activity__head">
          <h2 id="activity-title" className="d pl-activity__title pl-in">
            Shipped in public, every month.
          </h2>
          <a href={`${repo}/releases`} className="pl-btn pl-btn--white">
            All releases
          </a>
        </div>
        <dl className="pl-stats">
          {stats.map(([n, label]) => (
            <div key={label} className="pl-in">
              <dt className="d">{n}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <p className="pl-activity__latest">
          Latest release:{' '}
          <a href={`${repo}/releases/tag/v${project.version}`}>
            {project.version}, {project.released}
          </a>
        </p>
        <div className="pl-thanks pl-in">
          <div className="pl-thanks__head">
            <div>
              <h3 className="d">Thank you to our top contributors</h3>
              <p>By commits to the panel since Pelican began in March 2024.</p>
            </div>
            <a href={`${repo}/graphs/contributors`}>Everyone who has contributed →</a>
          </div>
          <ol className="pl-thanks__list">
            {topContributors.map(({ login, commits }) => (
              <li key={login}>
                <a href={`https://github.com/${login}`} className="pl-thanks__person">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://avatars.githubusercontent.com/${login}?s=88`}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    <strong>{login}</strong>
                    <span>{fmt.format(commits)} commits</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---- 05 Install ------------------------------------------------------------------------------ */
const STEPS = [
  {
    title: 'Check requirements',
    body: 'A Linux server with a web server, PHP 8.4 or newer and a database. The guide lists exact versions.',
    href: '/docs/panel/getting-started/',
    link: 'Requirements',
  },
  {
    title: 'Install the Panel',
    body: 'The web interface and API that you and your players use.',
    href: links.install,
    link: 'Panel guide',
  },
  {
    title: 'Add Wings to a node',
    body: 'The daemon that runs game servers in Docker on each machine.',
    href: links.wings,
    link: 'Wings guide',
  },
  {
    title: 'Create your first server',
    body: 'Pick an egg for your game and launch it from the panel.',
    href: links.eggs,
    link: 'Browse eggs',
  },
];

export function InstallSection() {
  return (
    <section id="install" className="pl-install" aria-labelledby="install-title">
      <div className="pl-wrap">
        <p className="pl-kicker">05 · Install</p>
        <div className="pl-install__head">
          <h2 id="install-title" className="d pl-h2 pl-in">
            Up and running in four steps.
          </h2>
          <Link href={links.install} className="pl-btn pl-btn--ink">
            Read the install guide
          </Link>
        </div>
        <ol className="pl-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="pl-step pl-in" style={{ '--d': i } as CSSProperties}>
              <span className="pl-step__n d">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <Link href={s.href}>{s.link} →</Link>
            </li>
          ))}
        </ol>
        <DomainCta />
      </div>
    </section>
  );
}

/* ---- Community (navy) --------------------------------------------------------------------------- */
export function CommunitySection() {
  const cards = [
    { icon: BookOpen, title: 'Documentation', body: 'Install guides, FAQ, comparison', href: '/docs/' },
    { icon: Plug, title: 'Pelican Hub', body: 'Plugins, themes and eggs', href: links.hub },
    { icon: MessageCircle, title: 'Discord', body: 'Get help, help others', href: links.discord },
    { icon: GitBranch, title: 'GitHub', body: 'Code, issues, translations', href: links.github },
  ];
  return (
    <section id="community" className="pl-community on-ink" aria-labelledby="sponsor-title">
      <div className="pl-wrap">
        <div className="pl-community__grid">
          <div>
            <h2 id="sponsor-title" className="d pl-h2 pl-in">
              Free to use. <span className="pl-sky">Kept alive by people who care.</span>
            </h2>
            <p className="pl-community__lede">
              You never have to pay to run Pelican. Sponsors and donors keep the project going.
            </p>
            <div className="pl-community__actions">
              <Link href="/support/" className="pl-btn pl-btn--sky pl-btn--on-ink">
                <Heart size={18} aria-hidden fill="currentColor" /> Sponsor Pelican
              </Link>
              <Link href="/support/" className="pl-textlink pl-textlink--ink">
                How support helps
              </Link>
            </div>
          </div>
          <SponsorWall />
        </div>
        <ul className="pl-res">
          {cards.map(({ icon: Icon, title, body, href }) => (
            <li key={title}>
              <a href={href} className="pl-res__card pl-in">
                <Icon size={24} aria-hidden />
                <strong className="d">{title}</strong>
                <span>{body}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---- Footer -------------------------------------------------------------------------------------- */
export function SiteFooterNav() {
  const cols = [
    {
      title: 'Product',
      items: [
        ['Documentation', '/docs/'],
        ['Install guide', links.install],
        ['Live demo', links.demo],
        ['Plugin Hub', links.hub],
      ],
    },
    {
      title: 'Community',
      items: [
        ['Discord', links.discord],
        ['GitHub', links.github],
        ['Contributors', '/docs/contributors/'],
        ['Translate', '/docs/guides/translating/'],
      ],
    },
    {
      title: 'Project',
      items: [
        ['FAQ', '/faq/'],
        ['Sponsor', '/support/'],
        ['Versioning', '/docs/versioning/'],
        ['Comparison', '/docs/comparison/'],
      ],
    },
  ];
  return (
    <footer className="pl-footer on-ink">
      <div className="pl-wrap">
        <div className="pl-footer__grid">
          <div>
            <Link href="/" className="pl-nav__brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/logo.png" alt="" width={40} height={40} />
              <span className="d">Pelican</span>
            </Link>
            <p className="pl-footer__tag">A free, open-source game server panel, built by its community.</p>
            <p className="pl-footer__social">
              <a href={links.github} aria-label="GitHub">
                <GitHubIcon width={22} height={22} />
              </a>
              <a href={links.discord} aria-label="Discord">
                <DiscordIcon width={22} height={22} />
              </a>
            </p>
          </div>
          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="pl-footer__head">{col.title}</p>
              <ul>
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="pl-footer__legal">
          © 2024–{new Date().getFullYear()} Pelican · {project.license} · Latest release{' '}
          <a href={`${repo}/releases/tag/v${project.version}`}>{project.version}</a>, {project.released}
        </p>
      </div>
    </footer>
  );
}
