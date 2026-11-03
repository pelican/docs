/**
 * Everything the /support page says, in one place.
 *
 * Checked against the live sources on 2 November 2026. When the Hub changes,
 * change this file to match. The live pages win over anything written here:
 * - Plans and perks: https://hub.pelican.dev/sponsor (/donors redirects there)
 * - Billing, cancelling, refunds: https://hub.pelican.dev/tos ("Donations & Sponsorships")
 * - Payments and the donor wall: https://hub.pelican.dev/privacy
 * - One-time gifts: https://github.com/sponsors/pelican
 * - Bug bounty rules: https://github.com/pelican/panel/blob/main/bounties.md
 */

export const supportLinks = {
  /** Where every plan's button goes: sign in with Discord, then pick the plan. */
  hubSponsor: 'https://hub.pelican.dev/sponsor',
  wall: 'https://hub.pelican.dev/sponsor/wall',
  hubTerms: 'https://hub.pelican.dev/tos',
  hubTickets: 'https://hub.pelican.dev/tickets',
  oneTime: 'https://github.com/sponsors/pelican?frequency=one-time',
  bountyRules: 'https://github.com/pelican/panel/blob/main/bounties.md',
  bounties:
    'https://github.com/pelican/panel/issues?q=state%3Aopen%20is%3Aissue%20label%3A%22%F0%9F%92%B0%20fund%22',
  discord: 'https://discord.gg/pelican-panel',
  licensingFaq: '/faq/?faq=licensing',
} as const;

export type Benefit = {
  /** The perk in plain words. */
  label: string;
  /** One short line that explains it. */
  detail?: string;
};

export type Plan = {
  id: 'individual' | 'team' | 'company';
  name: string;
  /** Who the plan is for, in one line. */
  forWho: string;
  /** Per month, as the Hub shows it ("$19 / month"). The Hub doesn't name the currency. */
  price: number;
  /** Carried over from the plan before (or everything, for the first plan). */
  includes: Benefit[];
  /** New or better than the plan before. */
  adds: Benefit[];
  /** Name of the plan `adds` is compared with. */
  addsOver?: string;
};

// The Hub lists each plan's perks as "Includes" (same as the plan before) and
// "Plus" (new or upgraded). Member counts are totals: 1, 2 and 6.
export const plans: Plan[] = [
  {
    id: 'individual',
    name: 'Individual',
    forWho: 'For one person who runs Pelican and wants to keep it going.',
    price: 19,
    includes: [
      { label: 'Donor role on the Pelican Discord', detail: 'Added to your account automatically.' },
      { label: 'Covers 1 Discord account', detail: 'Yours.' },
      { label: 'Lounge channel', detail: 'A Discord channel for supporters.' },
      { label: 'Medium support priority', detail: 'When you ask for help.' },
    ],
    adds: [],
  },
  {
    id: 'team',
    name: 'Team',
    forWho: 'For a group or small business that runs Pelican together.',
    price: 99,
    includes: [{ label: 'Donor role on the Pelican Discord' }, { label: 'Lounge channel' }],
    addsOver: 'Individual',
    adds: [
      { label: 'Covers 2 Discord accounts', detail: 'You and one teammate get the perks.' },
      { label: 'High support priority', detail: 'When you ask for help.' },
      { label: 'Advertise on the Pelican Discord' },
    ],
  },
  {
    id: 'company',
    name: 'Company',
    forWho: 'For businesses that build on Pelican and want to be seen backing it.',
    price: 499,
    includes: [{ label: 'Advertise on the Pelican Discord' }],
    addsOver: 'Team',
    adds: [
      { label: 'Sponsor role on the Pelican Discord', detail: 'Instead of the Donor role.' },
      { label: 'Covers 6 Discord accounts' },
      { label: 'Sponsor Lounge channel', detail: 'A Discord channel for Company sponsors.' },
      { label: 'Highest support priority', detail: 'When you ask for help.' },
      { label: "Your logo on Pelican's websites", detail: 'Like DataForest and DreamHost on the pelican.dev homepage.' },
      { label: 'Commercial license', detail: 'See "What does the commercial license cover?" below.' },
      { label: 'A one-hour 1:1 call each month', detail: 'With the Pelican team.' },
    ],
  },
];

/** The side-by-side table under the cards. Values are short so four columns fit on a phone. */
export const compareRows: { label: string; values: [string, string, string] }[] = [
  { label: 'Price per month', values: ['$19', '$99', '$499'] },
  { label: 'Discord role', values: ['Donor', 'Donor', 'Sponsor'] },
  { label: 'Discord accounts covered', values: ['1', '2', '6'] },
  { label: 'Private channel', values: ['Lounge', 'Lounge', 'Sponsor Lounge'] },
  { label: 'Support priority', values: ['Medium', 'High', 'Highest'] },
  { label: 'Advertise on Discord', values: ['No', 'Yes', 'Yes'] },
  { label: "Logo on Pelican's websites", values: ['No', 'No', 'Yes'] },
  { label: 'Commercial license', values: ['No', 'No', 'Yes'] },
  { label: 'Monthly 1:1 call', values: ['No', 'No', '1 hour'] },
];

export const signupSteps: { title: string; body: string }[] = [
  {
    title: 'Sign in with Discord',
    body: 'Open the Sponsor page on Pelican Hub and sign in. Your sponsorship is tied to your Discord account.',
  },
  {
    title: 'Pick a plan and pay',
    body: 'Press Sponsor on the plan you want. Payments go through Stripe; Pelican never sees your card details.',
  },
  {
    title: 'Get your role',
    body: 'The matching Discord role is added automatically. Cancel any time from your Hub profile.',
  },
];

export type Sponsor = {
  name: string;
  href: string;
  /** Light-on-dark logo: sponsors are shown on navy in both themes. */
  logo: string;
  /** The logo file's own size, so the browser can reserve its space. */
  width: number;
  height: number;
};

/** Company sponsors, shown large on the homepage and on /support. */
export const sponsors: Sponsor[] = [
  {
    name: 'DataForest',
    href: 'https://cloud.dataforest.net/?mtm_campaign=pelican&mtm_kwd=main',
    logo: '/img/homepage/sponsor/df-cloud-logo-darkmode.svg',
    width: 310,
    height: 48,
  },
  {
    name: 'DreamHost',
    href: 'https://www.dreamhost.com/hosting/vps/pelican/',
    logo: '/img/homepage/sponsor/dreamhost-logo-darkmode.png',
    width: 1088,
    height: 233,
  },
];

export type HelpWay = {
  title: string;
  body: string;
  links: { label: string; href: string }[];
};

export const helpWays: HelpWay[] = [
  {
    title: 'Write code or docs',
    body: 'Fix a bug or build a feature in the panel, or improve these docs. Some issues carry a paid bounty.',
    links: [
      { label: 'Contributing guide', href: 'https://github.com/pelican/panel/blob/main/contributing.md' },
      { label: 'Issues with a bounty', href: supportLinks.bounties },
      { label: 'Docs on GitHub', href: 'https://github.com/pelican/docs' },
    ],
  },
  {
    title: 'Translate the panel',
    body: 'Put Pelican into your language on Crowdin. No coding needed, and whatever is approved ships.',
    links: [{ label: 'How translating works', href: '/docs/guides/translating/' }],
  },
  {
    title: 'Report bugs',
    body: 'Found something broken? Open an issue with the steps to make it happen again.',
    links: [{ label: 'Open an issue', href: 'https://github.com/pelican/panel/issues/new/choose' }],
  },
  {
    title: 'Share eggs',
    body: 'Add or update eggs so Pelican can run more games and apps.',
    links: [
      { label: 'pelican-eggs on GitHub', href: 'https://github.com/pelican-eggs' },
      { label: 'Create an egg', href: '/docs/eggs/creating-a-custom-egg/' },
    ],
  },
  {
    title: 'Build plugins',
    body: 'Add features without touching the core, then publish your plugin on Pelican Hub.',
    links: [
      { label: 'Plugin docs', href: '/docs/panel/advanced/plugins/' },
      { label: 'Plugins on the Hub', href: 'https://hub.pelican.dev/plugins' },
    ],
  },
  {
    title: 'Help others on Discord',
    body: 'Answer questions from people setting up their panels.',
    links: [{ label: 'Join the Discord', href: supportLinks.discord }],
  },
];

export type FaqItem = {
  q: string;
  a: string;
  link?: { label: string; href: string };
};

// Only questions the Hub, GitHub Sponsors or the Pelican FAQ answer.
export const supportFaq: FaqItem[] = [
  {
    q: 'How do I pay?',
    a: 'On Pelican Hub, after you sign in with Discord. Payments are handled by Stripe, and Pelican never sees or stores your card details.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, any time, from your profile on Pelican Hub. Your perks end when the subscription is cancelled or lapses.',
  },
  {
    q: 'Can I get a refund?',
    a: "No. The Hub's terms treat sponsorships as voluntary contributions, not purchases, so they are non-refundable.",
    link: { label: 'Pelican Hub terms', href: supportLinks.hubTerms },
  },
  {
    q: 'How do I get the Discord role?',
    a: 'It is added for you. Your sponsorship is linked to the Discord account you sign in with, and the Hub keeps your role in step with your sponsorship.',
  },
  {
    q: 'Can I sponsor monthly on GitHub instead?',
    a: "You can, but GitHub's page says monthly sponsoring there does not include the plan perks. Use GitHub Sponsors for one-time gifts, and Pelican Hub for a plan.",
  },
  {
    q: 'Do I need the commercial license?',
    a: 'Only if all three are true: you changed Pelican\'s source files, those changes are not open source, and your panel is publicly available. Using or building plugins and themes never needs it.',
    link: { label: 'Licensing FAQ', href: supportLinks.licensingFaq },
  },
  {
    q: 'What does the commercial license cover?',
    a: 'The Company plan includes one, but its terms are not published on the site. Ask before you sign up: open a ticket on Pelican Hub or ask on Discord.',
    link: { label: 'Open a ticket', href: supportLinks.hubTickets },
  },
  {
    q: 'Will my name be shown?',
    a: "Supporters are thanked on the Hub's Wall of Awesome, with their Discord display name and avatar.",
    link: { label: 'Wall of Awesome', href: supportLinks.wall },
  },
  {
    q: 'Can the perks change?',
    a: "Yes. The Hub's terms say perks are a thank-you, are not guaranteed and may change over time.",
  },
];
