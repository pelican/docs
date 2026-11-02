/**
 * Open Graph share images (1200×630 PNG) in the V12 "B v3" style, rendered at
 * build time by the route handlers under app/og. Satori draws them, so every
 * box with more than one child needs display: flex, and the fonts are loaded
 * from files: next/font doesn't work inside ImageResponse.
 *
 * Fonts (both SIL Open Font License 1.1, licence texts next to the files):
 * - Bricolage Grotesque ExtraBold, app/og/_fonts/OFL-BricolageGrotesque.txt
 * - Instrument Sans Regular/SemiBold/Bold, app/og/_fonts/OFL-InstrumentSans.txt
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const SKY = '#38BDF8';
const NAVY = '#04121C';
const WHITE = '#FFFFFF';
const PAPER = '#F3F7F9';
const MUTED = '#3A4D5A';

const DISPLAY = 'Bricolage Grotesque';
const TEXT = 'Instrument Sans';

const FONT_DIR = join(process.cwd(), 'app/og/_fonts');

type Assets = {
  fonts: { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: 'normal' }[];
  logo: string;
};

let assets: Promise<Assets> | undefined;

/** Fonts and the logo, read once per build. */
function loadAssets(): Promise<Assets> {
  assets ??= (async () => {
    const font = (file: string) => readFile(join(FONT_DIR, file));
    const [display, regular, semibold, bold, logo] = await Promise.all([
      font('BricolageGrotesque-ExtraBold.ttf'),
      font('InstrumentSans-Regular.ttf'),
      font('InstrumentSans-SemiBold.ttf'),
      font('InstrumentSans-Bold.ttf'),
      readFile(join(process.cwd(), 'public/img/logo.png')),
    ]);
    return {
      fonts: [
        { name: DISPLAY, data: display, weight: 800, style: 'normal' },
        { name: TEXT, data: regular, weight: 400, style: 'normal' },
        { name: TEXT, data: semibold, weight: 600, style: 'normal' },
        { name: TEXT, data: bold, weight: 700, style: 'normal' },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    };
  })();
  return assets;
}

async function render(draw: (logo: string) => ReactElement) {
  const { fonts, logo } = await loadAssets();
  return new ImageResponse(draw(logo), { ...OG_SIZE, fonts });
}

/* ---- Title fitting ----------------------------------------------------------- */

/**
 * Rough advance width of a character in Bricolage Grotesque ExtraBold, in em.
 * Satori can't measure for us, so this errs on the wide side; the title box
 * also clamps, so a bad guess cuts with an ellipsis instead of overflowing.
 */
function charEm(ch: string) {
  if (ch === ' ') return 0.24;
  if (/[iljtfrI1!.,:;'|]/.test(ch)) return 0.34;
  if (/[mwMW]/.test(ch)) return 0.88;
  if (/[A-Z&]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.6;
  return 0.56;
}

function lineCount(text: string, size: number, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const space = charEm(' ') * size;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = [...word].reduce((n, ch) => n + charEm(ch) * size, 0);
    if (w > width) return Infinity; // a single word wider than the box
    if (used === 0) used = w;
    else if (used + space + w <= width) used += space + w;
    else {
      lines += 1;
      used = w;
    }
  }
  return lines;
}

/** The largest size from `sizes` that sets `text` in at most `maxLines` lines. */
export function fitTitle(text: string, width: number, maxLines: number, sizes: number[]) {
  for (const size of sizes) {
    const lines = lineCount(text, size, width);
    if (lines <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: maxLines };
}

/* ---- Shared pieces ---------------------------------------------------------- */

function Brand({ logo, size = 56, color = NAVY }: { logo: string; size?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={size} height={size} alt="" />
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.62, color, letterSpacing: -0.5 }}>
        Pelican
      </span>
    </div>
  );
}

function Chip({ children, bg = SKY, color = NAVY, border = NAVY }: { children: ReactNode; bg?: string; color?: string; border?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: bg,
        color,
        border: `3px solid ${border}`,
        fontFamily: TEXT,
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

/** One line of text that ends in an ellipsis instead of overflowing. */
function OneLine({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', ...style }}>
      {children}
    </div>
  );
}

/** The navy strip at the foot of every card: the page address and a tag. */
function Footer({ url, tag }: { url: string; tag: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '0 48px',
        height: 78,
        background: NAVY,
        color: WHITE,
        fontFamily: TEXT,
      }}
    >
      <OneLine style={{ fontWeight: 600, fontSize: 28, maxWidth: 820 }}>{url}</OneLine>
      <div style={{ display: 'flex', fontWeight: 700, fontSize: 22, letterSpacing: 2, color: SKY, textTransform: 'uppercase' }}>
        {tag}
      </div>
    </div>
  );
}

/** The paper background with one bordered card and its hard shadow. */
function Frame({ children, bg = PAPER, cardBg = WHITE, shadow = NAVY }: { children: ReactNode; bg?: string; cardBg?: string; shadow?: string }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: bg, padding: '36px 50px 50px 36px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: cardBg,
          border: `3px solid ${NAVY}`,
          boxShadow: `14px 14px 0 ${shadow}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---- Docs pages -------------------------------------------------------------- */

export type DocsImage = {
  /** "Panel", "Panel / Advanced", "Guides"… */
  section: string;
  title: string;
  description?: string;
  /** Shown in the footer, without the scheme: pelican.dev/docs/panel/update */
  url: string;
};

// The card's inner width is 1200 - 36 - 50 - 6 (borders) = 1108; text sits 56px in on each side.
const DOCS_TEXT_WIDTH = 1108 - 112;

export function docsImage({ section, title, description, url }: DocsImage) {
  const maxLines = description ? 2 : 3;
  // With a description under it the title starts a step smaller, so the card keeps some air.
  const sizes = description ? [100, 92, 84, 76, 68, 60, 54] : [112, 100, 88, 78, 68, 60, 54];
  const { size } = fitTitle(title, DOCS_TEXT_WIDTH, maxLines, sizes);

  return render((logo) => (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 56px 0' }}>
        <Chip>{section}</Chip>
        <Brand logo={logo} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, padding: '0 56px', gap: 22 }}>
        <div
          style={{
            display: 'block',
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: -size * 0.02,
            color: NAVY,
            lineClamp: maxLines,
          }}
        >
          {title}
        </div>
        {description && (
          <div style={{ display: 'block', fontFamily: TEXT, fontWeight: 400, fontSize: 30, lineHeight: 1.3, color: MUTED, lineClamp: 2 }}>
            {description}
          </div>
        )}
      </div>
      <Footer url={url} tag="Docs" />
    </Frame>
  ));
}

/* ---- Site pages -------------------------------------------------------------- */

export function homeImage() {
  const lines: [string, string][] = [
    ['Your servers.', WHITE],
    ['Your community.', SKY],
    ['Your control.', WHITE],
  ];
  return render((logo) => (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: NAVY, padding: '56px 64px 48px' }}>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex' }}>
            <Chip bg={SKY} border={WHITE}>Free · Open source</Chip>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {lines.map(([text, color]) => (
              <div key={text} style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 1.02, letterSpacing: -2, color }}>
                {text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 30, color: '#B9CCD8' }}>The free, open-source game server panel.</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 300,
            height: 300,
            background: SKY,
            border: `3px solid ${WHITE}`,
            boxShadow: `14px 14px 0 ${WHITE}`,
            marginRight: 14,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={230} height={232} alt="" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${SKY}`, paddingTop: 22 }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 36, color: WHITE }}>Pelican</div>
        <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 28, color: WHITE }}>pelican.dev</div>
      </div>
    </div>
  ));
}

export function eggsImage({ eggs, games, categories }: { eggs: number; games: number; categories: string[] }) {
  return render((logo) => (
    <Frame bg={SKY}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 56px 0' }}>
        <Chip bg={PAPER}>Eggs</Chip>
        <Brand logo={logo} />
      </div>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', gap: 48, padding: '0 56px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 330,
            height: 270,
            background: SKY,
            border: `3px solid ${NAVY}`,
            boxShadow: `10px 10px 0 ${NAVY}`,
          }}
        >
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: -4, color: NAVY }}>
            {eggs}
          </div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 28, letterSpacing: 3, textTransform: 'uppercase', color: NAVY }}>
            eggs
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 560 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: DISPLAY, fontWeight: 800, fontSize: 70, lineHeight: 1.02, letterSpacing: -1.5, color: NAVY }}>
            <span>Every egg,</span>
            <span>in one place.</span>
          </div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 28, lineHeight: 1.3, color: MUTED }}>
            {`Community eggs for ${games} games, plus bots, databases and more.`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {categories.slice(0, 4).map((c) => (
              <div key={c} style={{ display: 'flex', padding: '4px 12px', border: `3px solid ${NAVY}`, fontFamily: TEXT, fontWeight: 600, fontSize: 20, color: NAVY }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer url="pelican.dev/eggs" tag="Eggs" />
    </Frame>
  ));
}

export function supportImage({ plans }: { plans: { name: string; price: number }[] }) {
  return render((logo) => (
    <Frame shadow={SKY}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 56px 0' }}>
        <Chip>Support</Chip>
        <Brand logo={logo} />
      </div>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 520 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 0.98, letterSpacing: -2, color: NAVY }}>
            Support Pelican
          </div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontSize: 28, lineHeight: 1.3, color: MUTED }}>
            Free and always will be. Sponsors pay the people who build it.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {plans.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: 400,
                padding: '14px 22px',
                background: i === 1 ? SKY : i === 2 ? NAVY : PAPER,
                color: i === 2 ? WHITE : NAVY,
                border: `3px solid ${NAVY}`,
                boxShadow: `6px 6px 0 ${NAVY}`,
              }}
            >
              <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 28 }}>{p.name}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>{`$${p.price}`}</span>
                <span style={{ fontFamily: TEXT, fontSize: 20 }}>/mo</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <Footer url="pelican.dev/support" tag="Sponsor" />
    </Frame>
  ));
}

export function faqImage({ questions }: { questions: string[] }) {
  return render((logo) => (
    <Frame bg={NAVY} shadow={SKY}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 56px 0' }}>
        <Chip>FAQ</Chip>
        <Brand logo={logo} />
      </div>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', gap: 40 }}>
        <div style={{ display: 'flex', width: 420, fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, letterSpacing: -2, color: NAVY }}>
          Frequently asked questions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {questions.slice(0, 3).map((q) => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 16, width: 520, padding: '12px 16px', background: PAPER, border: `3px solid ${NAVY}` }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  background: SKY,
                  border: `3px solid ${NAVY}`,
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: 26,
                  color: NAVY,
                }}
              >
                ?
              </div>
              <div style={{ display: 'block', fontFamily: TEXT, fontWeight: 600, fontSize: 24, lineHeight: 1.2, color: NAVY, lineClamp: 2 }}>{q}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer url="pelican.dev/faq" tag="FAQ" />
    </Frame>
  ));
}
