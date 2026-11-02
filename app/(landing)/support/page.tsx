import type { Metadata } from 'next';
import { ArrowRight, Bug, Check, Code, Egg, Heart, Languages, MessageCircle, Plug, Plus } from 'lucide-react';
import { SiteHeader } from '@/components/home/site-header';
import { SiteFooterNav } from '@/components/home/sections';
import { compareRows, funding, helpWays, plans, signupSteps, supportFaq, supportLinks } from '@/lib/support';

export const metadata: Metadata = {
  title: 'Support Pelican',
  description:
    'Pelican is free and always will be. See what each monthly plan costs and gives, where the money goes, how to give once, and how to help without paying.',
};

const HELP_ICONS = [Code, Languages, Bug, Egg, Plug, MessageCircle];

/** /support: why to sponsor, the three plans, where the money goes and how to help without paying. */
export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pl-sup">
        {/* ---- Hero ---- */}
        <section className="pl-sup-hero" aria-labelledby="page-title">
          <div className="pl-wrap pl-sup-hero__grid">
            <div>
              <h1 id="page-title" className="d pl-page__title">
                Support Pelican
              </h1>
              <p className="pl-page__lede">
                Pelican is free and always will be. It&apos;s built by volunteers, and sponsors pay the people who build
                it, plus bug bounties and moderators. Here&apos;s what each plan costs, what it gives you, and how to help
                without paying.
              </p>
            </div>
            <nav className="pl-card pl-sup-ways" aria-labelledby="ways-title">
              <h2 id="ways-title" className="pl-sup-ways__title">
                Three ways to help
              </h2>
              <ol>
                <li>
                  <a href="#plans">
                    <strong className="d">Sponsor monthly</strong>
                    <span>From $19 per month, with perks on Discord</span>
                    <ArrowRight size={22} aria-hidden />
                  </a>
                </li>
                <li>
                  <a href="#once">
                    <strong className="d">Give once</strong>
                    <span>Any amount, through GitHub Sponsors</span>
                    <ArrowRight size={22} aria-hidden />
                  </a>
                </li>
                <li>
                  <a href="#help">
                    <strong className="d">Help without paying</strong>
                    <span>Code, translations, bug reports, eggs, plugins</span>
                    <ArrowRight size={22} aria-hidden />
                  </a>
                </li>
              </ol>
            </nav>
          </div>
        </section>

        {/* ---- Plans ---- */}
        <section id="plans" className="pl-sup-plans" aria-labelledby="plans-title">
          <div className="pl-wrap">
            <div className="pl-sup-head">
              <p className="pl-kicker">Monthly plans</p>
              <h2 id="plans-title" className="d pl-h2">
                Pick a plan. Cancel any time.
              </h2>
              <p className="pl-sup-head__lede">
                Each plan is a monthly subscription on Pelican Hub. All three fund the same work; bigger plans add perks
                and cover more people on Discord.
              </p>
            </div>

            <ul className="pl-sup-plans__grid">
              {plans.map((plan) => (
                <li key={plan.id} className="pl-sup-plan">
                  <h3 id={`plan-${plan.id}`} className="d pl-sup-plan__name">
                    {plan.name}
                  </h3>
                  <p className="pl-sup-plan__for">{plan.forWho}</p>
                  <p className="pl-sup-plan__price">
                    <span className="d pl-sup-plan__amount">${plan.price}</span>{' '}
                    <span className="pl-sup-plan__per">per month</span>
                  </p>
                  <a href={supportLinks.hubSponsor} className="pl-btn pl-btn--ink pl-sup-plan__cta">
                    Choose {plan.name}
                    <span className="sr-only"> on Pelican Hub</span>
                    <ArrowRight size={18} aria-hidden />
                  </a>
                  <div className="pl-sup-plan__perks">
                    {plan.includes.length > 0 && (
                      <>
                        <p className="pl-sup-plan__group">{plan.addsOver ? `Same as ${plan.addsOver}` : 'Includes'}</p>
                        <ul>
                          {plan.includes.map((b) => (
                            <li key={b.label}>
                              <Check size={18} strokeWidth={3} aria-hidden className="pl-sup-plan__mark" />
                              <span>
                                {b.label}
                                {b.detail && <small>{b.detail}</small>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {plan.adds.length > 0 && (
                      <>
                        <p className="pl-sup-plan__group pl-sup-plan__group--adds">Adds over {plan.addsOver}</p>
                        <ul>
                          {plan.adds.map((b) => (
                            <li key={b.label} className="is-new">
                              <Plus size={18} strokeWidth={3} aria-hidden className="pl-sup-plan__mark" />
                              <span>
                                {b.label}
                                {b.detail && <small>{b.detail}</small>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="pl-sup-plans__note">
              All three buttons open the Sponsor page on Pelican Hub, where you pick the same plan. Prices and perks as
              listed there on 2 November 2026.
            </p>

            <div className="pl-sup-steps">
              <h3 className="d pl-sup-sub">How signing up works</h3>
              <ol>
                {signupSteps.map((step, i) => (
                  <li key={step.title}>
                    <span className="d pl-sup-steps__n" aria-hidden>
                      {i + 1}
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pl-sup-compare">
              <h3 id="compare-title" className="d pl-sup-sub">
                Compare the plans
              </h3>
              <div className="pl-sup-compare__scroll" role="region" aria-labelledby="compare-title" tabIndex={0}>
                {/* Explicit roles keep it a table for screen readers when phones restyle the rows. */}
                <table role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        <span className="sr-only">Perk</span>
                      </th>
                      {plans.map((plan) => (
                        <th key={plan.id} scope="col" role="columnheader">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {compareRows.map((row) => (
                      <tr key={row.label} role="row">
                        <th scope="row" role="rowheader">
                          {row.label}
                        </th>
                        {row.values.map((value, i) => (
                          <td key={plans[i].id} role="cell">
                            {value === 'No' ? (
                              <>
                                <span aria-hidden className="pl-sup-compare__no">
                                  –
                                </span>
                                <span className="sr-only">No</span>
                              </>
                            ) : value === 'Yes' ? (
                              <>
                                <Check size={18} strokeWidth={3} aria-hidden />
                                <span className="sr-only">Yes</span>
                              </>
                            ) : (
                              value
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Where the money goes + sponsors (navy) ---- */}
        <section id="money" className="pl-sup-money on-ink" aria-labelledby="money-title">
          <div className="pl-wrap">
            <div className="pl-sup-money__grid">
              <div>
                <p className="pl-kicker">Where the money goes</p>
                <h2 id="money-title" className="d pl-h2">
                  Split three ways.
                </h2>
                <p className="pl-sup-money__lede">
                  Every plan and every one-time gift goes into the same pot, shared out like this. Using Pelican stays
                  free either way.
                </p>
              </div>
              <div className="pl-fund">
                <p className="pl-fund__label">Published funding plan</p>
                <div className="pl-fund__bar" aria-hidden>
                  {funding.map((share) => (
                    <span key={share.label} className={`is-${share.tone}`} style={{ flexGrow: share.pct }}>
                      <strong className="d">{share.pct}%</strong> {share.label}
                    </span>
                  ))}
                </div>
                <dl className="pl-sup-money__list">
                  {funding.map((share) => (
                    <div key={share.label}>
                      <dt>
                        <span className={`pl-sup-money__swatch is-${share.tone}`} aria-hidden />
                        <strong className="d">{share.pct}%</strong> {share.label}
                      </dt>
                      <dd>
                        {share.body}
                        {share.label === 'Bug bounties' && (
                          <>
                            {' '}
                            <a href={supportLinks.bountyRules}>Bounty rules</a> ·{' '}
                            <a href={supportLinks.bounties}>Open bounties</a>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="pl-fund__note">This is the project&apos;s published plan, not audited spending.</p>
              </div>
            </div>

            <div className="pl-sup-thanks">
              <h3 className="d pl-sup-sub">Thank you to our sponsors</h3>
              <div className="pl-sponsors">
                <a href="https://cloud.dataforest.net/?mtm_campaign=pelican&mtm_kwd=main">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/homepage/sponsor/df-cloud-logo-darkmode.svg" alt="DataForest" height={32} />
                </a>
                <a href="https://www.dreamhost.com/hosting/vps/pelican/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/homepage/sponsor/dreamhost-logo-darkmode.png" alt="DreamHost" height={28} />
                </a>
              </div>
              <p className="pl-sup-thanks__wall">
                And thank you to every community sponsor on the{' '}
                <a href={supportLinks.wall} className="pl-textlink pl-textlink--ink">
                  Wall of Awesome
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ---- One-time (sky) ---- */}
        <section id="once" className="pl-sup-once" aria-labelledby="once-title">
          <div className="pl-wrap pl-sup-once__grid">
            <div>
              <p className="pl-kicker">One-time support</p>
              <h2 id="once-title" className="d pl-h2">
                Give once.
              </h2>
            </div>
            <div className="pl-sup-once__body">
              <p>
                Prefer a one-off gift? Give any amount through GitHub Sponsors. You&apos;ll need a GitHub account, and
                GitHub adds a Public Sponsor badge to your profile.
              </p>
              <p className="pl-sup-once__fine">
                Use GitHub Sponsors for one-time gifts only. GitHub&apos;s page notes that monthly sponsoring there
                doesn&apos;t include the plan perks; for those, <a href="#plans">choose a plan</a>.
              </p>
              <a href={supportLinks.oneTime} className="pl-btn pl-btn--ink pl-btn--big">
                <Heart size={20} aria-hidden fill="currentColor" /> Give once on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ---- Help without paying ---- */}
        <section id="help" className="pl-sup-help" aria-labelledby="help-title">
          <div className="pl-wrap">
            <div className="pl-sup-head">
              <p className="pl-kicker">No money needed</p>
              <h2 id="help-title" className="d pl-h2">
                Help without paying.
              </h2>
              <p className="pl-sup-head__lede">
                Pelican is built and maintained by volunteers, so your time helps as much as money. Pick whatever suits
                you.
              </p>
            </div>
            <ul className="pl-sup-help__grid">
              {helpWays.map((way, i) => {
                const Icon = HELP_ICONS[i];
                return (
                  <li key={way.title} className="pl-sup-help__card">
                    <Icon size={28} aria-hidden className="pl-sup-help__icon" />
                    <h3 className="d">{way.title}</h3>
                    <p>{way.body}</p>
                    <ul className="pl-sup-help__links">
                      {way.links.map((link) => (
                        <li key={link.href}>
                          <a href={link.href}>
                            {link.label} <ArrowRight size={16} aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            <p className="pl-sup-help__more">
              Or just tell other server owners about Pelican. That helps too.
            </p>
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section id="faq" className="pl-sup-faq" aria-labelledby="faq-title">
          <div className="pl-wrap pl-sup-faq__grid">
            <div>
              <p className="pl-kicker">Questions</p>
              <h2 id="faq-title" className="d pl-h2">
                Sponsoring, answered.
              </h2>
              <p className="pl-sup-head__lede">
                Something else? Ask on <a href={supportLinks.discord}>Discord</a> or open a{' '}
                <a href={supportLinks.hubTickets}>ticket on Pelican Hub</a>.
              </p>
            </div>
            <div className="pl-sup-faq__list">
              {supportFaq.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>
                    {item.a}
                    {item.link && (
                      <>
                        {' '}
                        <a href={item.link.href}>{item.link.label}</a>
                      </>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooterNav />
    </>
  );
}
