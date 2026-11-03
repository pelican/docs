/**
 * Open Graph share images (1200×630 PNG) in the V12 "B v3" style, rendered at
 * build time by the route handlers under app/og. Satori draws them, so every
 * box with more than one child needs display: flex, and the fonts are loaded
 * from files: next/font doesn't work inside ImageResponse.
 *
 * Each image has one picture built from the page's real content: the home
 * console, the featured games' icons, the three plans, real FAQ questions, and
 * for docs a few lines copied from the page (lib/og-motifs.ts).
 *
 * Fonts (all SIL Open Font License 1.1, licence texts next to the files):
 * - Bricolage Grotesque ExtraBold, app/og/_fonts/OFL-BricolageGrotesque.txt
 * - Instrument Sans Regular/SemiBold/Bold, app/og/_fonts/OFL-InstrumentSans.txt
 * - JetBrains Mono Medium, app/og/_fonts/OFL-JetBrainsMono.txt
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { FlowMotif, Motif } from './og-motifs';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const SKY = '#38BDF8';
const SKY_DEEP = '#0B79AD';
const SKY_LIGHT = '#C8ECFC';
const NAVY = '#04121C';
const NAVY_2 = '#0A1F2E';
const EDGE = '#2E4756';
const WHITE = '#FFFFFF';
const PAPER = '#F3F7F9';
const LINE = '#E3EDF2';
const MUTED = '#3C5866';
const SOFT = '#B9CCD6';
const DANGER = '#BE123C';

const DISPLAY = 'Bricolage Grotesque';
const TEXT = 'Instrument Sans';
const MONO = 'JetBrains Mono';

const ROOT = process.cwd();
const FONT_DIR = join(ROOT, 'app/og/_fonts');

/* ---- Measuring text ------------------------------------------------------------ */

/** Width in px of `text` at `size`, plus `tracking` px after each character. */
type Measure = (text: string, size: number, tracking?: number) => number;

/**
 * Reads advance widths straight from a TrueType font (cmap format 4 + hmtx), so
 * titles can be sized before Satori lays them out. Kerning is left out; the
 * fitting below keeps a few percent of slack for it.
 */
function measurer(font: Buffer): Measure {
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    tables.set(font.toString('latin1', at, at + 4), font.readUInt32BE(at + 8));
  }
  const table = (tag: string) => {
    const at = tables.get(tag);
    if (at === undefined) throw new Error(`OG font has no ${tag} table`);
    return at;
  };
  const unitsPerEm = font.readUInt16BE(table('head') + 18);
  const hMetrics = font.readUInt16BE(table('hhea') + 34);
  const hmtx = table('hmtx');
  const cmap = table('cmap');

  let sub = -1;
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + i * 8;
    const offset = cmap + font.readUInt32BE(at + 4);
    if (font.readUInt16BE(at) === 3 && font.readUInt16BE(at + 2) === 1 && font.readUInt16BE(offset) === 4) sub = offset;
  }
  if (sub < 0) throw new Error('OG font has no Unicode BMP cmap');
  const segments = font.readUInt16BE(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;

  const glyph = (code: number) => {
    for (let i = 0; i < segments; i++) {
      if (font.readUInt16BE(ends + i * 2) < code) continue;
      const start = font.readUInt16BE(starts + i * 2);
      if (start > code) return 0;
      const delta = font.readUInt16BE(deltas + i * 2);
      const range = font.readUInt16BE(ranges + i * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const id = font.readUInt16BE(ranges + i * 2 + range + 2 * (code - start));
      return id === 0 ? 0 : (id + delta) & 0xffff;
    }
    return 0;
  };

  const widths = new Map<number, number>();
  return (text, size, tracking = 0) => {
    let units = 0;
    let count = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      let w = widths.get(code);
      if (w === undefined) {
        w = font.readUInt16BE(hmtx + 4 * Math.min(glyph(code), hMetrics - 1));
        widths.set(code, w);
      }
      units += w;
      count += 1;
    }
    return (units / unitsPerEm) * size + tracking * count;
  };
}

/** Lines `text` takes when wrapped at word gaps in `width`; Infinity if one word alone is wider. */
function wrapLines(measure: Measure, text: string, size: number, width: number, tracking: number) {
  const space = measure(' ', size, tracking);
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = measure(word, size, tracking);
    if (w > width) return Infinity;
    if (used === 0) used = w;
    else if (used + space + w <= width) used += space + w;
    else {
      lines += 1;
      used = w;
    }
  }
  return lines;
}

/** Display type is tracked in by 2% of its size. */
const TIGHT = -0.02;

/**
 * The largest size in `sizes` that sets `text` in at most `maxLines` lines of
 * `width`. Measures 4% narrow to leave room for kerning and rounding; if even
 * the smallest size doesn't fit, the caller's lineClamp cuts the rest.
 */
function fit(measure: Measure, text: string, width: number, maxLines: number, sizes: number[]) {
  const lines = (size: number) => wrapLines(measure, text, size, width * 0.96, size * TIGHT);
  const first = sizes.findIndex((size) => lines(size) <= maxLines);
  if (first < 0) return sizes[sizes.length - 1];
  // Three lines with one short word each ("Migrating / from / Pterodactyl") read worse
  // than two slightly smaller ones, so give up to ~15% of size for a line less.
  const size = sizes[first];
  const fewer = sizes.slice(first + 1).find((s) => s >= size * 0.85 && lines(s) < lines(size));
  return fewer ?? size;
}

/* ---- Assets ---------------------------------------------------------------------- */

type Assets = {
  fonts: { name: string; data: Buffer; weight: 400 | 500 | 600 | 700 | 800; style: 'normal' }[];
  logo: string;
  display: Measure;
  text: Measure;
};

let assets: Promise<Assets> | undefined;

/** Fonts and the logo, read once per build. */
function loadAssets(): Promise<Assets> {
  assets ??= (async () => {
    const font = (file: string) => readFile(join(FONT_DIR, file));
    const [display, regular, semibold, bold, mono, logo] = await Promise.all([
      font('BricolageGrotesque-ExtraBold.ttf'),
      font('InstrumentSans-Regular.ttf'),
      font('InstrumentSans-SemiBold.ttf'),
      font('InstrumentSans-Bold.ttf'),
      font('JetBrainsMono-Medium.ttf'),
      readFile(join(ROOT, 'public/img/logo.png')),
    ]);
    return {
      fonts: [
        { name: DISPLAY, data: display, weight: 800, style: 'normal' },
        { name: TEXT, data: regular, weight: 400, style: 'normal' },
        { name: TEXT, data: semibold, weight: 600, style: 'normal' },
        { name: TEXT, data: bold, weight: 700, style: 'normal' },
        { name: MONO, data: mono, weight: 500, style: 'normal' },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
      display: measurer(display),
      text: measurer(semibold),
    };
  })();
  return assets;
}

/**
 * A game icon from public/ (WebP or SVG) as a PNG data URL, since Satori can't
 * decode WebP. Scaled up once here so the small Steam icons stay smooth.
 * Remote icons are skipped: the build must not depend on the network.
 */
async function iconPng(icon: string | null, size: number): Promise<string | null> {
  if (!icon?.startsWith('/')) return null;
  const png = await sharp(join(ROOT, 'public', icon), { density: 300 })
    .resize(size, size, { fit: 'cover', kernel: icon.endsWith('.svg') ? 'nearest' : 'lanczos3' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Draws one image and re-encodes it as a 256-colour PNG: the flat colours and
 * text look the same, and the files come out 3-4 times smaller (eggs.png, with
 * its game icons, goes from ~165 KB to ~45 KB).
 */
async function render(draw: (a: Assets) => ReactElement) {
  const a = await loadAssets();
  const png = Buffer.from(await new ImageResponse(draw(a), { ...OG_SIZE, fonts: a.fonts }).arrayBuffer());
  const small = await sharp(png).png({ palette: true, quality: 95, compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(small), { headers: { 'Content-Type': 'image/png' } });
}

/* ---- Shared pieces ------------------------------------------------------------- */

function Brand({ logo, size = 52, color = NAVY }: { logo: string; size?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={size} height={size} alt="" />
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.66, color, letterSpacing: -0.5 }}>Pelican</span>
    </div>
  );
}

function Chip({ children, bg = SKY, color = NAVY, style }: { children: ReactNode; bg?: string; color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 48,
        padding: '0 16px',
        background: bg,
        color,
        border: `3px solid ${NAVY}`,
        fontFamily: TEXT,
        fontWeight: 700,
        fontSize: 21,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** One line that ends in an ellipsis instead of overflowing. */
function OneLine({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', ...style }}>
      {children}
    </div>
  );
}

type StageTheme = { bg: string; shadow: string; ink: string };

/**
 * A coloured page with one white card on it (3px navy border, hard shadow) and
 * the page address under the card. The card clips its children, so a picture
 * can run off its edge on purpose.
 */
function Stage({ theme, url, tag, children }: { theme: StageTheme; url: string; tag: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '30px 44px 0 30px',
        background: theme.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 520,
          background: WHITE,
          border: `3px solid ${NAVY}`,
          boxShadow: `14px 14px 0 ${theme.shadow}`,
        }}
      >
        {/* Satori clips a box with a shadow to the shadow's edge, so the clipping happens on this inner box. */}
        <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>{children}</div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexGrow: 1,
          paddingTop: 14,
          paddingRight: 4,
          color: theme.ink,
          fontFamily: TEXT,
        }}
      >
        <OneLine style={{ fontWeight: 600, fontSize: 25, maxWidth: 900 }}>{url}</OneLine>
        <div style={{ display: 'flex', fontWeight: 700, fontSize: 20, letterSpacing: 3, textTransform: 'uppercase' }}>{tag}</div>
      </div>
    </div>
  );
}

/** The chip and logo row along the top of a card. */
function TopRow({ logo, children }: { logo: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'absolute',
        top: 32,
        left: 44,
        right: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{children}</div>
      <Brand logo={logo} />
    </div>
  );
}

/** A window with a title bar, as used for code, tables and the console. */
function Window({
  label,
  children,
  style,
  body = NAVY,
  shadow = SKY,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
  body?: string;
  shadow?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        background: body,
        border: `3px solid ${NAVY}`,
        boxShadow: `10px 10px 0 ${shadow}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 20px', background: NAVY, borderBottom: `3px solid ${EDGE}` }}>
        <div style={{ display: 'flex', width: 14, height: 14, background: SKY }} />
        <div style={{ display: 'flex', width: 14, height: 14, background: WHITE }} />
        <div style={{ display: 'flex', width: 14, height: 14, background: EDGE }} />
        <div style={{ display: 'flex', marginLeft: 10, fontFamily: MONO, fontWeight: 500, fontSize: 19, color: SOFT }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

/* ---- Section glyphs ------------------------------------------------------------- */

export type DocsSection = 'Panel' | 'Wings' | 'Eggs' | 'Guides' | 'Project';

/** Small line drawings on a 24px grid, one per docs section. */
function Glyph({ section, size, color }: { section: DocsSection | 'Docs'; size: number; color: string }) {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const };
  const shapes: Record<DocsSection | 'Docs', ReactNode> = {
    // A browser window with a sidebar.
    Panel: (
      <>
        <rect x="3" y="4" width="18" height="16" {...stroke} />
        <path d="M3 9h18M9 9v11" {...stroke} />
      </>
    ),
    // Two stacked server units.
    Wings: (
      <>
        <rect x="3" y="4" width="18" height="7" {...stroke} />
        <rect x="3" y="13" width="18" height="7" {...stroke} />
        <path d="M7 7.5h2M7 16.5h2" {...stroke} />
      </>
    ),
    Eggs: <path d="M12 3C8.5 3 5.5 8.8 5.5 13.5a6.5 6.5 0 0 0 13 0C18.5 8.8 15.5 3 12 3z" {...stroke} />,
    // An open book.
    Guides: <path d="M3 5h6a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H3zM21 5h-6a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H21z" {...stroke} />,
    // A branch: the project's repositories and releases.
    Project: (
      <>
        <circle cx="6" cy="5" r="2.2" {...stroke} />
        <circle cx="6" cy="19" r="2.2" {...stroke} />
        <circle cx="18" cy="7" r="2.2" {...stroke} />
        <path d="M6 7.2v9.6M18 9.2c0 5-12 3-12 7.6" {...stroke} />
      </>
    ),
    // A page with lines.
    Docs: (
      <>
        <path d="M5 3h10l4 4v14H5z" {...stroke} />
        <path d="M9 11h6M9 15h6" {...stroke} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {shapes[section]}
    </svg>
  );
}

/* ---- Docs pages ----------------------------------------------------------------- */

type SectionStyle = StageTheme & { chip: string; chipInk: string; accent: string };

/** Each docs section gets its own page colour, so a feed of links shows which part of the docs it is. */
const SECTIONS: Record<DocsSection, SectionStyle> = {
  Panel: { bg: SKY, shadow: NAVY, ink: NAVY, chip: SKY, chipInk: NAVY, accent: SKY },
  Wings: { bg: NAVY, shadow: SKY, ink: WHITE, chip: NAVY, chipInk: WHITE, accent: SKY },
  Eggs: { bg: SKY_LIGHT, shadow: NAVY, ink: NAVY, chip: SKY_LIGHT, chipInk: NAVY, accent: SKY },
  Guides: { bg: PAPER, shadow: NAVY, ink: NAVY, chip: PAPER, chipInk: NAVY, accent: SKY },
  Project: { bg: SKY_DEEP, shadow: NAVY, ink: WHITE, chip: WHITE, chipInk: NAVY, accent: SKY },
};

export type DocsImage = {
  section: DocsSection;
  /** Folders under the section, like ["Advanced"]. */
  trail: string[];
  title: string;
  description?: string;
  /** Shown under the card, without the scheme: pelican.dev/docs/panel/update */
  url: string;
  motif?: Motif;
};

// Inside the card (1120×514) the text column starts 44px in; the picture sits to its right
// and runs off the card's bottom edge.
const DOCS_TITLE_WIDTH = 568;
const DOCS_PICTURE_LEFT = 652;
const DOCS_PICTURE_WIDTH = 1120 - DOCS_PICTURE_LEFT - 44;
/** Height the title and description may take together (the column runs from y=104 to y=484). */
const DOCS_TEXT_HEIGHT = 372;
const DOCS_TITLE_SIZES = [96, 88, 80, 72, 66, 60, 54];
const DOCS_TITLE_LEADING = 0.98;
const DOCS_DESC_LEADING = 1.32;
const DOCS_GAP = 22;

/**
 * Sizes for a docs title and description that fit the column without clamping:
 * up to three title lines and four description lines, the title as big as possible. A size up to 15% smaller
 * wins if it saves the title a line.
 */
function docsTextLayout(display: Measure, text: Measure, title: string, description?: string) {
  const options: { size: number; titleLines: number; descSize: number; descLines: number }[] = [];
  for (const size of DOCS_TITLE_SIZES) {
    const titleLines = wrapLines(display, title, size, DOCS_TITLE_WIDTH * 0.96, size * TIGHT);
    if (titleLines > 3) continue;
    for (const descSize of [26, 24, 22]) {
      const descLines = description ? wrapLines(text, description, descSize, DOCS_TITLE_WIDTH * 0.97, 0) : 0;
      if (descLines > 4) continue;
      const height = titleLines * size * DOCS_TITLE_LEADING + (description ? DOCS_GAP + descLines * descSize * DOCS_DESC_LEADING : 0);
      if (height <= DOCS_TEXT_HEIGHT) {
        options.push({ size, titleLines, descSize, descLines });
        break;
      }
    }
  }
  const best = options[0];
  // Nothing fits (a very long title or description): smallest sizes, and lineClamp cuts the rest.
  if (!best) return { size: DOCS_TITLE_SIZES[DOCS_TITLE_SIZES.length - 1], titleLines: 3, descSize: 22, descLines: 3 };
  return options.find((o) => o.size >= best.size * 0.85 && o.titleLines < best.titleLines) ?? best;
}

function SectionChip({ section, trail }: { section: DocsSection; trail: string[] }) {
  const s = SECTIONS[section];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Chip bg={s.chip} color={s.chipInk} style={{ paddingLeft: 12 }}>
        <Glyph section={section} size={26} color={s.chipInk} />
        {section}
      </Chip>
      {trail.length > 0 && (
        <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 21, letterSpacing: 2.5, textTransform: 'uppercase', color: MUTED }}>
          {`/ ${trail.join(' / ')}`}
        </div>
      )}
    </div>
  );
}

function CodeLines({ motif }: { motif: Extract<Motif, { kind: 'code' }> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 24px' }}>
      {motif.lines.map((line, i) => {
        const comment = line.trim().startsWith('#');
        const prompt = motif.lang === 'sh' && !comment;
        // The indent is a fixed gap, so a wrapped line continues under its own first character.
        const indent = line.length - line.trimStart().length;
        // Long commands wrap like they would in a narrow terminal; the window's bottom edge crops the rest.
        return (
          <div key={i} style={{ display: 'flex', fontFamily: MONO, fontWeight: 500, fontSize: 20, lineHeight: 1.35, color: comment ? SOFT : WHITE }}>
            {prompt && <span style={{ display: 'flex', flexShrink: 0, width: 26, color: SKY }}>$</span>}
            {indent > 0 && <span style={{ display: 'flex', flexShrink: 0, width: indent * 12 }} />}
            <span style={{ display: 'flex', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line.trimStart()}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The picture on the right of a docs card. It runs off the card's right and bottom edges. */
function DocsPicture({ section, motif }: { section: DocsSection; motif?: Motif }) {
  const box: CSSProperties = { left: DOCS_PICTURE_LEFT, top: 124, width: DOCS_PICTURE_WIDTH, height: 460 };
  const accent = SECTIONS[section].accent;

  if (!motif) {
    // No lines from the page: the section's own drawing, big.
    return (
      <div style={{ display: 'flex', position: 'absolute', alignItems: 'center', justifyContent: 'center', ...box, background: SKY, border: `3px solid ${NAVY}`, boxShadow: `10px 10px 0 ${NAVY}` }}>
        <Glyph section={section} size={240} color={NAVY} />
      </div>
    );
  }

  switch (motif.kind) {
    case 'code':
      return (
        <Window label={motif.label} style={box} shadow={accent}>
          <CodeLines motif={motif} />
        </Window>
      );
    case 'rows':
      return (
        <Window label={motif.label} style={box} body={WHITE} shadow={accent}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {motif.rows.map((row) => (
              <div
                key={row.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: row.note ? '10px 24px' : '13px 24px',
                  background: row.mark ? SKY : WHITE,
                  borderBottom: `3px solid ${row.mark ? NAVY : LINE}`,
                }}
              >
                <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 26, color: NAVY }}>{row.name}</span>
                {row.note && <span style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 18, color: row.mark ? NAVY : MUTED }}>{row.note}</span>}
              </div>
            ))}
          </div>
        </Window>
      );
    case 'notice':
      return (
        <Window label={motif.label.toLowerCase()} style={box} body={WHITE} shadow={accent}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: 26, padding: '20px 24px', borderLeft: `8px solid ${DANGER}`, background: '#FFF1F2' }}>
            <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 20, letterSpacing: 2.5, textTransform: 'uppercase', color: DANGER }}>
              {motif.label}
            </div>
            {motif.lines.map((line) => (
              <div key={line} style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 30, lineHeight: 1.2, color: NAVY }}>
                {line}
              </div>
            ))}
          </div>
        </Window>
      );
    case 'semver':
      return (
        <Window label="MAJOR.MINOR.PATCH" style={box} shadow={accent}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '28px 28px' }}>
            {motif.rows.map((row, i) => (
              <div key={row.version} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ display: 'flex', flexShrink: 0, fontFamily: MONO, fontWeight: 500, fontSize: 36 }}>
                  {row.version.split('.').map((part, j) => (
                    <span key={j} style={{ color: j === i ? SKY : j < i ? SOFT : EDGE }}>
                      {j > 0 ? `.${part}` : part}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 21, lineHeight: 1.2, color: WHITE }}>{row.note}</div>
              </div>
            ))}
          </div>
        </Window>
      );
    case 'flow':
      return <Flow motif={motif} style={box} />;
  }
}

export function docsImage({ section, trail, title, description, url, motif }: DocsImage) {
  const s = SECTIONS[section];
  return render(({ logo, display, text }) => {
    const { size, titleLines, descSize, descLines } = docsTextLayout(display, text, title, description);
    return (
      <Stage theme={s} url={url} tag="Docs">
        <TopRow logo={logo}>
          <SectionChip section={section} trail={trail} />
        </TopRow>
        <DocsPicture section={section} motif={motif} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: DOCS_GAP,
            position: 'absolute',
            left: 44,
            top: 104,
            bottom: 30,
            width: DOCS_TITLE_WIDTH,
          }}
        >
          <div
            style={{
              display: 'block',
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: size,
              lineHeight: DOCS_TITLE_LEADING,
              letterSpacing: size * TIGHT,
              color: NAVY,
              lineClamp: Math.max(titleLines, 1),
            }}
          >
            {title}
          </div>
          {description && (
            <div style={{ display: 'block', fontFamily: TEXT, fontWeight: 400, fontSize: descSize, lineHeight: DOCS_DESC_LEADING, color: MUTED, lineClamp: Math.max(descLines, 1) }}>
              {description}
            </div>
          )}
        </div>
      </Stage>
    );
  });
}

/* ---- Docs index --------------------------------------------------------------------- */

/** The "Example Setup" chart from the docs introduction: the Panel, two machines running Wings, their servers. */
function Flow({ motif, style }: { motif: FlowMotif; style?: CSSProperties }) {
  const col = 232;
  const gap = 28;
  const box = (bg: string, color: string): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    background: bg,
    color,
    border: `3px solid ${NAVY}`,
    fontFamily: TEXT,
    fontWeight: 700,
    fontSize: 22,
  });
  const stem = (h: number) => <div style={{ display: 'flex', alignSelf: 'center', width: 3, height: h, background: NAVY }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', width: col * 2 + gap, ...style }}>
      <div style={{ ...box(SKY, NAVY), alignSelf: 'center', width: 300, height: 58, fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, boxShadow: `6px 6px 0 ${NAVY}` }}>
        {motif.root}
      </div>
      {stem(16)}
      {/* The fork down to both machines. */}
      <div style={{ display: 'flex', alignSelf: 'center', width: col + gap + 3, height: 16, borderTop: `3px solid ${NAVY}`, borderLeft: `3px solid ${NAVY}`, borderRight: `3px solid ${NAVY}` }} />
      <div style={{ display: 'flex', gap }}>
        {motif.nodes.map((node) => (
          <div key={node.name} style={{ display: 'flex', flexDirection: 'column', width: col }}>
            <div style={box(WHITE, NAVY)}>{node.name}</div>
            {stem(12)}
            <div style={{ ...box(NAVY, WHITE), fontFamily: DISPLAY, fontWeight: 800, fontSize: 24 }}>{node.service}</div>
            {stem(12)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {node.apps.map((app) => (
                <div key={app} style={{ display: 'flex', alignItems: 'center', height: 36, padding: '0 14px', background: PAPER, border: `3px solid ${NAVY}`, fontFamily: TEXT, fontWeight: 600, fontSize: 19, color: NAVY }}>
                  {app}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function docsIndexImage({ sections, flow }: { sections: { name: DocsSection; pages: number }[]; flow?: FlowMotif }) {
  return render(({ logo }) => (
    <Stage theme={{ bg: NAVY, shadow: SKY, ink: WHITE }} url="pelican.dev/docs" tag="Docs">
      <TopRow logo={logo}>
        <Chip bg={SKY} style={{ paddingLeft: 12 }}>
          <Glyph section="Docs" size={26} color={NAVY} />
          Documentation
        </Chip>
      </TopRow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, position: 'absolute', left: 44, top: 128, width: 540 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: DISPLAY, fontWeight: 800, fontSize: 124, lineHeight: 0.92, letterSpacing: -124 * 0.025, color: NAVY }}>
          <span>Pelican</span>
          <span style={{ color: SKY_DEEP }}>docs</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {sections.map(({ name, pages }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 14px 0 10px', border: `3px solid ${NAVY}`, background: SECTIONS[name].bg }}>
              <Glyph section={name} size={24} color={SECTIONS[name].ink} />
              <span style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 21, color: SECTIONS[name].ink }}>{name}</span>
              <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 18, color: SECTIONS[name].ink === WHITE ? SOFT : MUTED }}>{pages}</span>
            </div>
          ))}
        </div>
      </div>
      {flow ? (
        <Flow motif={flow} style={{ left: 596, top: 116 }} />
      ) : (
        <DocsPicture section="Panel" />
      )}
    </Stage>
  ));
}

/* ---- Home ------------------------------------------------------------------------- */

// The first state of the homepage console (components/home/hero-console.tsx).
const CONSOLE = {
  name: 'survival-smp',
  meta: 'play.example.net:25565 · Paper 1.21.4',
  stats: [
    { label: 'CPU', value: '23.4%', of: '/ 400%', share: 23.4 / 400 },
    { label: 'Memory', value: '2.1 GiB', of: '/ 6 GiB', share: 2.1 / 6 },
    { label: 'Players', value: '2', of: '/ 20', share: 2 / 20 },
  ],
  log: [
    ['12:04:30', 'Done (8.912s)! For help, type "help"'],
    ['12:06:02', 'Steve joined the game'],
    ['12:06:45', '<Steve> anyone up for the nether?'],
    ['12:07:10', 'Alex joined the game'],
  ],
};

export function homeImage() {
  const lines: [string, string][] = [
    ['Your servers.', WHITE],
    ['Your community.', SKY],
    ['Your control.', WHITE],
  ];
  return render(({ logo, display }) => {
    const width = 620;
    const size = Math.min(...lines.map(([t]) => fit(display, t, width, 1, [96, 92, 88, 84, 80, 76, 72])));
    return (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          background: NAVY,
        }}
      >
        {/* The console, cropped by the right and bottom edges. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            left: 720,
            top: 70,
            width: 600,
            height: 640,
            background: NAVY_2,
            border: `3px solid ${WHITE}`,
            boxShadow: `14px 14px 0 ${SKY}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '24px 28px 20px', borderBottom: `3px solid ${EDGE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', background: SKY, fontFamily: TEXT, fontWeight: 700, fontSize: 16, letterSpacing: 2, color: NAVY, textTransform: 'uppercase' }}>
                <div style={{ display: 'flex', width: 10, height: 10, background: NAVY }} />
                Running
              </div>
              <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 30, color: WHITE }}>{CONSOLE.name}</div>
            </div>
            <div style={{ display: 'flex', fontFamily: MONO, fontWeight: 500, fontSize: 17, color: SOFT }}>{CONSOLE.meta}</div>
          </div>
          <div style={{ display: 'flex', gap: 18, padding: '18px 28px', borderBottom: `3px solid ${EDGE}` }}>
            {CONSOLE.stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 156 }}>
                <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: SOFT, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 25, color: WHITE }}>{s.value}</span>
                  <span style={{ fontFamily: TEXT, fontSize: 15, color: SOFT }}>{s.of}</span>
                </div>
                <div style={{ display: 'flex', height: 8, background: EDGE }}>
                  <div style={{ display: 'flex', width: `${Math.max(6, s.share * 100)}%`, background: SKY }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 28px' }}>
            {CONSOLE.log.map(([time, text]) => (
              <div key={time} style={{ display: 'flex', fontFamily: MONO, fontWeight: 500, fontSize: 18, whiteSpace: 'pre', color: WHITE }}>
                {/* A no-break space: Satori drops a plain trailing one when the line runs off the console. */}
                <span style={{ flexShrink: 0, color: SOFT }}>{`[${time}\u00A0`}</span>
                <span style={{ flexShrink: 0, color: SKY }}>INFO</span>
                <span style={{ flexShrink: 0, color: SOFT }}>]:</span>
                <span style={{ marginLeft: 11 }}>{text}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, height: 48, padding: '0 16px', border: `3px solid ${EDGE}`, fontFamily: MONO, fontSize: 18, color: SOFT }}>
              <span style={{ color: SKY, fontSize: 22 }}>›</span>
              list
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'absolute', left: 64, top: 52, bottom: 50, width }}>
          <Brand logo={logo} size={60} color={WHITE} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lines.map(([t, color]) => (
                <div key={t} style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: size * TIGHT, color }}>
                  {t}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Chip bg={SKY} style={{ height: 42, border: `3px solid ${SKY}` }}>
                Free
              </Chip>
              <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 26, color: WHITE }}>Open source under AGPLv3</div>
            </div>
          </div>
          <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 26, color: SOFT }}>pelican.dev</div>
        </div>
      </div>
    );
  });
}

/* ---- Eggs ------------------------------------------------------------------------- */

export type EggTile = { name: string; icon: string | null; eggs: number };

export async function eggsImage({ eggs, games, tiles }: { eggs: number; games: number; tiles: EggTile[] }) {
  const ICON = 112;
  const icons = await Promise.all(tiles.map((t) => iconPng(t.icon, ICON * 2)));
  const fmt = new Intl.NumberFormat('en');
  return render(({ logo }) => (
    <Stage theme={{ bg: SKY, shadow: NAVY, ink: NAVY }} url="pelican.dev/eggs" tag="Egg index">
      <TopRow logo={logo}>
        <Chip bg={SKY_LIGHT} style={{ paddingLeft: 12 }}>
          <Glyph section="Eggs" size={26} color={NAVY} />
          Eggs
        </Chip>
      </TopRow>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 44, top: 120, width: 440 }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 200, lineHeight: 0.9, letterSpacing: -6, color: NAVY }}>{fmt.format(eggs)}</div>
        <div style={{ display: 'flex', marginTop: 8, fontFamily: DISPLAY, fontWeight: 800, fontSize: 54, lineHeight: 1, letterSpacing: -1, color: NAVY }}>
          community eggs
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontFamily: TEXT, fontWeight: 400, fontSize: 27, lineHeight: 1.3, color: MUTED }}>
          {`For ${fmt.format(games)} games and plenty more besides. Every egg, in one place.`}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 24px', position: 'absolute', left: 540, top: 112, width: 3 * 172 + 2 * 24 }}>
        {tiles.slice(0, 6).map((tile, i) => (
          <div key={tile.name} style={{ display: 'flex', flexDirection: 'column', width: 172 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: ICON + 6,
                height: ICON + 6,
                background: WHITE,
                border: `3px solid ${NAVY}`,
                boxShadow: `6px 6px 0 ${NAVY}`,
              }}
            >
              {icons[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icons[i]} width={ICON} height={ICON} alt="" />
              ) : (
                <Glyph section="Eggs" size={80} color={NAVY} />
              )}
            </div>
            <OneLine style={{ marginTop: 12, fontFamily: TEXT, fontWeight: 700, fontSize: 20, color: NAVY, width: 172 }}>{tile.name}</OneLine>
            <div style={{ display: 'flex', fontFamily: MONO, fontWeight: 500, fontSize: 16, color: MUTED }}>{`${tile.eggs} ${tile.eggs === 1 ? 'egg' : 'eggs'}`}</div>
          </div>
        ))}
      </div>
    </Stage>
  ));
}

/* ---- Support ----------------------------------------------------------------------- */

export type SupportPlan = { name: string; price: number; detail: string };

export function supportImage({ plans }: { plans: SupportPlan[] }) {
  const looks = [
    { bg: PAPER, ink: NAVY, sub: MUTED, height: 250 },
    { bg: SKY, ink: NAVY, sub: NAVY, height: 318 },
    { bg: NAVY, ink: WHITE, sub: SOFT, height: 386 },
  ];
  return render(({ logo }) => (
    <Stage theme={{ bg: PAPER, shadow: SKY, ink: NAVY }} url="pelican.dev/support" tag="Sponsor">
      <TopRow logo={logo}>
        <Chip bg={SKY}>Support</Chip>
      </TopRow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'absolute', left: 44, top: 140, width: 380 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: DISPLAY, fontWeight: 800, fontSize: 100, lineHeight: 0.94, letterSpacing: -2, color: NAVY }}>
          <span>Support</span>
          <span>Pelican</span>
        </div>
        <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 400, fontSize: 27, lineHeight: 1.3, color: MUTED }}>
          Pelican is free and always will be. Sponsors pay the people who build it.
        </div>
      </div>
      {/* The plans stand on the card's bottom edge, taller as they cost more. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, position: 'absolute', right: 44, bottom: -3 }}>
        {plans.slice(0, 3).map((plan, i) => {
          const look = looks[i];
          return (
            <div
              key={plan.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: 192,
                height: look.height,
                padding: '20px 20px',
                background: look.bg,
                border: `3px solid ${NAVY}`,
                boxShadow: `8px 0 0 ${NAVY}`,
              }}
            >
              <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 700, fontSize: 20, letterSpacing: 2.5, textTransform: 'uppercase', color: look.ink }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 6 }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 62, letterSpacing: -2, color: look.ink }}>{`$${plan.price}`}</span>
              </div>
              <div style={{ display: 'flex', fontFamily: TEXT, fontWeight: 600, fontSize: 19, color: look.sub }}>per month</div>
              <div style={{ display: 'flex', marginTop: 14, fontFamily: TEXT, fontWeight: 600, fontSize: 19, lineHeight: 1.25, color: look.ink }}>{plan.detail}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  ));
}

/* ---- FAQ ---------------------------------------------------------------------------- */

export function faqImage({ title, items }: { title: string; items: { question: string; answer: string }[] }) {
  return render(({ logo, display, text }) => {
    const titleSize = fit(display, title, 380, 3, [84, 78, 72, 66, 60]);
    // The first question is shown open with its answer; under it, the next ones that fit on one line.
    const [open, ...rest] = items;
    const fitsOneLine = (q: string) => text(q, 24) * 1.06 <= QUESTION_WIDTH;
    const closed = rest.filter((q) => fitsOneLine(q.question)).slice(0, open && fitsOneLine(open.question) ? 3 : 2);
    return (
      <Stage theme={{ bg: NAVY, shadow: SKY, ink: WHITE }} url="pelican.dev/faq" tag="FAQ">
        <TopRow logo={logo}>
          <Chip bg={SKY}>FAQ</Chip>
        </TopRow>
        <div
          style={{
            display: 'block',
            position: 'absolute',
            left: 44,
            top: 150,
            width: 380,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 0.98,
            letterSpacing: titleSize * TIGHT,
            color: NAVY,
            lineClamp: 3,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, position: 'absolute', left: 462, top: 100, bottom: 24, width: 616 }}>
          {open && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 18px 16px', background: SKY_LIGHT, border: `3px solid ${NAVY}`, boxShadow: `6px 6px 0 ${NAVY}` }}>
              <Question text={open.question} sign="–" lines={2} />
              <div style={{ display: 'block', paddingLeft: 58, fontFamily: TEXT, fontWeight: 400, fontSize: 21, lineHeight: 1.35, color: NAVY, lineClamp: 3 }}>{open.answer}</div>
            </div>
          )}
          {closed.map((q) => (
            <div key={q.question} style={{ display: 'flex', padding: '11px 18px', background: WHITE, border: `3px solid ${NAVY}` }}>
              <Question text={q.question} sign="+" />
            </div>
          ))}
        </div>
      </Stage>
    );
  });
}

const QUESTION_WIDTH = 520;

function Question({ text, sign, lines = 1 }: { text: string; sign: string; lines?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 42,
          height: 42,
          background: sign === '+' ? PAPER : NAVY,
          color: sign === '+' ? NAVY : WHITE,
          border: `3px solid ${NAVY}`,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 28,
        }}
      >
        {sign}
      </div>
      {lines === 1 ? (
        <OneLine style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 24, color: NAVY, width: QUESTION_WIDTH }}>{text}</OneLine>
      ) : (
        <div style={{ display: 'block', width: QUESTION_WIDTH, fontFamily: TEXT, fontWeight: 700, fontSize: 24, lineHeight: 1.2, color: NAVY, lineClamp: lines }}>{text}</div>
      )}
    </div>
  );
}
