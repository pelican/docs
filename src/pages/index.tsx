import React, {JSX} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageWhy from '@site/src/components/HomepageFeatures/why';
import HomepageWhat from '@site/src/components/HomepageFeatures/what';
import HomepageLook from '@site/src/components/HomepageFeatures/look';
import HomepageSponsors from '@site/src/components/HomepageFeatures/sponsors'
import Heading from '@theme/Heading';
import { Icon } from '@iconify/react/dist/iconify.js';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            style={{ fontSize: '26px' }}
            className="button button--secondary button--md"
            to="/docs/getting-started"
          >Install</Link>
          <Link
            style={{ fontSize: '26px', margin: '15px' }}
            className="button button--secondary button--md"
            to="https://demo.pelican.dev"
          >Demo</Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Home`}
      description="Caww-Kaww">
      <HomepageHeader />
      <main>
        <HomepageWhat />
        <HomepageWhy />
        <HomepageLook />
        <HomepageSponsors />
      </main>
    </Layout>
  );
}
